import React, { useMemo } from 'react';
import { createSeededRandom, hashStringToSeed } from '../../../utils/seededRandom';
import { createFlashPlan, type FlashPlan } from './signatureEffectPhysics';
import type { SignatureEffectRendererProps } from './effectRendererTypes';
import { expDecay, expRise, roundRectPath, useParticleCanvas, type StageSize } from './particleCanvas';

const RADIUS = 12;
// 한 번만 번쩍이면 관객이 놓치기 쉽다는 피드백을 반영해, 카메라 연사처럼 짧은 간격으로
// 여러 번 반복한다. 늘리거나 줄이려면 이 값만 바꾸면 된다.
const FLASH_COUNT = 3;
const FLASH_INTERVAL = 0.15;

/** 서명란 크기에 비례해 여백을 잡아, 작은 서명란도 충분히 큰 후광을 가질 공간을 확보한다. */
const marginFor = (boxWidth: number, boxHeight: number): number => (
  Math.max(60, Math.max(boxWidth, boxHeight) * 0.55)
);

/** FLASH_COUNT번의 expRise×expDecay 펄스를 합산한다 — 아직 시작 안 한 펄스는 건너뛴다. */
const flashIntensity = (plan: FlashPlan, elapsedSec: number): number => {
  let intensity = 0;
  for (let i = 0; i < FLASH_COUNT; i += 1) {
    const localT = elapsedSec - i * FLASH_INTERVAL;
    if (localT < 0) continue;
    intensity += expRise(localT, plan.riseTau) * expDecay(localT, plan.decayTau);
  }
  return intensity;
};

/**
 * 카메라 플래시처럼 서명란 주변이 몇 차례 연속으로 번쩍인다.
 * 테두리 stroke만으로는 화면 전체 기준으로 눈에 잘 띄지 않아, 박스 크기에 비례한
 * 큰 후광(radial bloom)을 더해 존재감을 키웠다.
 */
const draw = (ctx: CanvasRenderingContext2D, size: StageSize, plan: FlashPlan, margin: number, elapsedSec: number): void => {
  const w = size.width - margin * 2;
  const h = size.height - margin * 2;
  const intensity = Math.min(1.4, flashIntensity(plan, elapsedSec));
  if (intensity <= 0.015) return;

  const alpha = Math.min(1, intensity);
  const cx = size.width / 2;
  const cy = size.height / 2;
  const bloomRadius = Math.max(w, h) * 0.5 + margin;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, bloomRadius);
  bloom.addColorStop(0, `rgba(255,251,235,${0.6 * alpha})`);
  bloom.addColorStop(0.55, `rgba(255,247,214,${0.28 * alpha})`);
  bloom.addColorStop(1, 'rgba(255,251,235,0)');
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(cx, cy, bloomRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = alpha;
  ctx.lineWidth = 3 + intensity * 9;
  ctx.strokeStyle = 'rgba(255,251,235,0.98)';
  ctx.shadowColor = 'rgba(255,247,214,0.95)';
  ctx.shadowBlur = 10 + intensity * 34;
  roundRectPath(ctx, margin, margin, w, h, RADIUS);
  ctx.stroke();

  ctx.globalAlpha = alpha * 0.5;
  ctx.fillStyle = 'rgba(255,251,235,0.95)';
  roundRectPath(ctx, margin, margin, w, h, RADIUS);
  ctx.fill();
  ctx.restore();
};

interface FlashBoxProps {
  size: StageSize;
  plan: FlashPlan;
  margin: number;
}

const FlashBoxCanvas: React.FC<FlashBoxProps> = ({ size, plan, margin }) => {
  const { canvasRef } = useParticleCanvas(size, (ctx, stageSize, elapsedSec) => draw(ctx, stageSize, plan, margin, elapsedSec));
  return <canvas ref={canvasRef} width={size.width} height={size.height} style={{ width: size.width, height: size.height }} />;
};

export const SignatureFlashEffect: React.FC<SignatureEffectRendererProps> = ({
  requestId,
  signerId,
  frames,
  fields,
}) => {
  const boxes = useMemo(() => fields.flatMap(field => {
    if (Number(field.signerId) !== signerId) return [];
    const frame = frames.find(item => item.pageIndex === field.pageIndex);
    if (!frame) return [];
    return [{
      key: `${requestId}-${field.id}`,
      left: frame.x + field.xRatio * frame.width,
      top: frame.y + field.yRatio * frame.height,
      width: field.widthRatio * frame.width,
      height: field.heightRatio * frame.height,
    }];
  }), [fields, frames, requestId, signerId]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      {boxes.map(box => {
        const margin = marginFor(box.width, box.height);
        const size: StageSize = { width: box.width + margin * 2, height: box.height + margin * 2 };
        const plan = createFlashPlan(createSeededRandom(hashStringToSeed(box.key)));
        return (
          <div
            key={box.key}
            data-testid="projector-signature-flash"
            className="absolute"
            style={{ left: box.left - margin, top: box.top - margin, width: size.width, height: size.height }}
          >
            <FlashBoxCanvas size={size} plan={plan} margin={margin} />
          </div>
        );
      })}
    </div>
  );
};
