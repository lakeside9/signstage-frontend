import React, { useMemo } from 'react';
import { createSeededRandom, hashStringToSeed } from '../../../utils/seededRandom';
import { createHighlightPlan, type HighlightPlan } from './signatureEffectPhysics';
import type { SignatureEffectRendererProps } from './effectRendererTypes';
import { drawRadialBurst, roundRectPath, useParticleCanvas, type StageSize } from './particleCanvas';

const PADDING = 16;
const RADIUS = 12;
const FADE_OUT_START = 1.1;
const FADE_OUT_DURATION = 0.5;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const AMBER_CORNERS = (w: number, h: number, pad: number) => [
  { x: pad, y: pad },
  { x: pad + w, y: pad },
  { x: pad + w, y: pad + h },
  { x: pad, y: pad + h },
];

/** 테두리가 트레이스되며 나타나고, 대각선 sheen이 한 번 훑고, 모서리가 차례로 반짝인다. */
const draw = (ctx: CanvasRenderingContext2D, size: StageSize, plan: HighlightPlan, elapsedSec: number): void => {
  const w = size.width - PADDING * 2;
  const h = size.height - PADDING * 2;
  const fadeOut = elapsedSec > FADE_OUT_START ? clamp01(1 - (elapsedSec - FADE_OUT_START) / FADE_OUT_DURATION) : 1;
  if (fadeOut <= 0) return;

  // 1 - e^(-t/tau): 빠르게 차올라 거의 즉시 테두리 전체가 드러나되, CSS opacity fade보다
  // 실제로 "그려지는" 느낌을 낸다.
  const trace = 1 - Math.exp(-elapsedSec / plan.traceTau);

  ctx.save();
  ctx.globalAlpha = fadeOut * trace;
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(245,158,11,0.95)';
  ctx.shadowColor = 'rgba(245,158,11,0.85)';
  ctx.shadowBlur = 10;
  roundRectPath(ctx, PADDING, PADDING, w, h, RADIUS);
  ctx.stroke();

  ctx.globalAlpha = fadeOut * trace * 0.12;
  ctx.fillStyle = 'rgba(253,230,138,0.9)';
  roundRectPath(ctx, PADDING, PADDING, w, h, RADIUS);
  ctx.fill();
  ctx.restore();

  // 대각선 sheen: box 안쪽만 보이도록 clip한 뒤 밝은 띠를 한 번 훑는다.
  const sheenProgress = clamp01(elapsedSec / plan.sheenDuration);
  ctx.save();
  roundRectPath(ctx, PADDING, PADDING, w, h, RADIUS);
  ctx.clip();
  const bandCenter = PADDING + (-0.25 + 1.5 * sheenProgress) * w;
  const gradient = ctx.createLinearGradient(bandCenter - w * 0.16, PADDING, bandCenter + w * 0.16, PADDING + h);
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.85)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = fadeOut;
  ctx.fillStyle = gradient;
  ctx.fillRect(PADDING, PADDING, w, h);
  ctx.restore();

  AMBER_CORNERS(w, h, PADDING).forEach((corner, index) => {
    const localT = elapsedSec - plan.cornerGlintDelays[index];
    if (localT < 0 || localT > 0.3) return;
    drawRadialBurst(ctx, corner.x, corner.y, localT / 0.3, '#fde68a', 1, 14);
  });
};

interface HighlightBoxProps {
  size: StageSize;
  plan: HighlightPlan;
}

const HighlightBoxCanvas: React.FC<HighlightBoxProps> = ({ size, plan }) => {
  const { canvasRef } = useParticleCanvas(size, (ctx, stageSize, elapsedSec) => draw(ctx, stageSize, plan, elapsedSec));
  return <canvas ref={canvasRef} width={size.width} height={size.height} style={{ width: size.width, height: size.height }} />;
};

export const SignatureHighlightEffect: React.FC<SignatureEffectRendererProps> = ({
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
        const size: StageSize = { width: box.width + PADDING * 2, height: box.height + PADDING * 2 };
        const plan = createHighlightPlan(createSeededRandom(hashStringToSeed(box.key)));
        return (
          <div
            key={box.key}
            data-testid="projector-signature-highlight"
            className="absolute"
            style={{ left: box.left - PADDING, top: box.top - PADDING, width: size.width, height: size.height }}
          >
            <HighlightBoxCanvas size={size} plan={plan} />
          </div>
        );
      })}
    </div>
  );
};
