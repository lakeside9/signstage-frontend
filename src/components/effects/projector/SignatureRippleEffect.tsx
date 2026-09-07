import React, { useMemo } from 'react';
import { createSeededRandom, hashStringToSeed } from '../../../utils/seededRandom';
import { createRipplePlan, type RipplePlan } from './signatureEffectPhysics';
import type { SignatureEffectRendererProps } from './effectRendererTypes';
import { expDecay, expRise, roundRectPath, useParticleCanvas, type StageSize } from './particleCanvas';

// 링이 바깥으로 얼마나 퍼질지는 필드 박스 자신의 크기에 비례해야 한다(원본의 transform:scale(1.48)과
// 같은 의도) — 그래서 고정 px 대신 박스 크기의 비율로 여백을 잡는다.
const MARGIN_FRACTION = 0.26;
const RADIUS = 12;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const drawRing = (
  ctx: CanvasRenderingContext2D,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  marginX: number,
  marginY: number,
  alpha: number,
): void => {
  if (alpha <= 0 || marginX < 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(196,181,253,0.9)';
  ctx.shadowColor = 'rgba(167,139,250,0.55)';
  ctx.shadowBlur = 8;
  roundRectPath(ctx, boxX - marginX, boxY - marginY, boxW + marginX * 2, boxH + marginY * 2, RADIUS + marginX * 0.3);
  ctx.stroke();
  ctx.restore();
};

/** 최초 flash(보라색 물결) + 서로 다른 시점에 출발하는 링 3개가 바깥으로 퍼지며 사그라든다. */
const draw = (ctx: CanvasRenderingContext2D, size: StageSize, boxW: number, boxH: number, plan: RipplePlan, elapsedSec: number): void => {
  const boxX = (size.width - boxW) / 2;
  const boxY = (size.height - boxH) / 2;
  const maxMarginX = boxW * MARGIN_FRACTION;
  const maxMarginY = boxH * MARGIN_FRACTION;

  const flashAlpha = expDecay(elapsedSec, 0.22) * 0.4;
  if (flashAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = flashAlpha;
    ctx.fillStyle = 'rgba(196,181,253,0.5)';
    roundRectPath(ctx, boxX, boxY, boxW, boxH, RADIUS);
    ctx.fill();
    ctx.restore();
  }

  plan.ringDelays.forEach((delay, index) => {
    const localT = elapsedSec - delay;
    if (localT < 0) return;
    const growth = expRise(localT, 0.5);
    const alpha = expDecay(localT, 0.42) * clamp01(1.2 - growth * 0.2);
    const scale = plan.ringScales[index];
    drawRing(ctx, boxX, boxY, boxW, boxH, maxMarginX * growth * scale, maxMarginY * growth * scale, alpha);
  });
};

interface RippleBoxProps {
  size: StageSize;
  boxW: number;
  boxH: number;
  plan: RipplePlan;
}

const RippleBoxCanvas: React.FC<RippleBoxProps> = ({ size, boxW, boxH, plan }) => {
  const { canvasRef } = useParticleCanvas(size, (ctx, stageSize, elapsedSec) => draw(ctx, stageSize, boxW, boxH, plan, elapsedSec));
  return <canvas ref={canvasRef} width={size.width} height={size.height} style={{ width: size.width, height: size.height }} />;
};

export const SignatureRippleEffect: React.FC<SignatureEffectRendererProps> = ({ requestId, signerId, frames, fields }) => {
  const boxes = useMemo(() => fields.flatMap(field => {
    if (Number(field.signerId) !== signerId) return [];
    const frame = frames.find(item => item.pageIndex === field.pageIndex);
    return frame ? [{
      key: `${requestId}-${field.id}`,
      left: frame.x + field.xRatio * frame.width,
      top: frame.y + field.yRatio * frame.height,
      width: field.widthRatio * frame.width,
      height: field.heightRatio * frame.height,
    }] : [];
  }), [fields, frames, requestId, signerId]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      {boxes.map(box => {
        const paddingX = box.width * MARGIN_FRACTION;
        const paddingY = box.height * MARGIN_FRACTION;
        const size: StageSize = { width: box.width + paddingX * 2, height: box.height + paddingY * 2 };
        const plan = createRipplePlan(createSeededRandom(hashStringToSeed(box.key)));
        return (
          <div
            key={box.key}
            data-testid="projector-signature-ripple"
            className="absolute"
            style={{ left: box.left - paddingX, top: box.top - paddingY, width: size.width, height: size.height }}
          >
            <RippleBoxCanvas size={size} boxW={box.width} boxH={box.height} plan={plan} />
          </div>
        );
      })}
    </div>
  );
};
