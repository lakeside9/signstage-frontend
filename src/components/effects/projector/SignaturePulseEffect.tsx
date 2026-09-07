import React, { useMemo } from 'react';
import { createSeededRandom, hashStringToSeed } from '../../../utils/seededRandom';
import { createPulsePlan, type PulsePlan } from './signatureEffectPhysics';
import type { SignatureEffectRendererProps } from './effectRendererTypes';
import { dampedOscillation, roundRectPath, useParticleCanvas, type StageSize } from './particleCanvas';

const PADDING = 14;
const RADIUS = 12;
// COMPLETION_EFFECT_CATALOG이 아니라 SIGNATURE_EFFECT_CATALOG.PULSE.durationMs(2200ms)와 맞춘 값.
const TOTAL_SECONDS = 2.2;
const FADE_IN = 0.12;
const FADE_OUT_START = 1.7;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * 감쇠 조화 진동자 하나로 아우라와 코어를 함께 움직인다.
 * CSS keyframe으로 박자를 미리 정해두는 대신, 종을 친 것처럼 자연스럽게
 * 두어 번 진동하며 잦아드는 곡선(dampedOscillation)을 그대로 밝기/두께에 매핑한다.
 */
const draw = (ctx: CanvasRenderingContext2D, size: StageSize, plan: PulsePlan, elapsedSec: number): void => {
  const w = size.width - PADDING * 2;
  const h = size.height - PADDING * 2;
  const sceneFade = Math.min(
    clamp01(elapsedSec / FADE_IN),
    clamp01((TOTAL_SECONDS - elapsedSec) / (TOTAL_SECONDS - FADE_OUT_START)),
  );
  if (sceneFade <= 0) return;

  const auraEnvelope = Math.abs(dampedOscillation(elapsedSec, plan.omega, plan.zeta));
  const coreEnvelope = Math.abs(dampedOscillation(elapsedSec + plan.corePhaseOffset, plan.omega, plan.zeta));

  ctx.save();
  ctx.globalAlpha = sceneFade * clamp01(auraEnvelope * 1.3);
  ctx.lineWidth = 1.5 + auraEnvelope * 3.5;
  ctx.strokeStyle = 'rgba(251,191,36,0.9)';
  ctx.shadowColor = 'rgba(251,191,36,0.75)';
  ctx.shadowBlur = 6 + auraEnvelope * 18;
  roundRectPath(ctx, PADDING - auraEnvelope * 3, PADDING - auraEnvelope * 3, w + auraEnvelope * 6, h + auraEnvelope * 6, RADIUS);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = sceneFade * clamp01(coreEnvelope * 1.1) * 0.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1;
  roundRectPath(ctx, PADDING + 3, PADDING + 3, w - 6, h - 6, Math.max(2, RADIUS - 4));
  ctx.stroke();
  ctx.restore();
};

interface PulseBoxProps {
  size: StageSize;
  plan: PulsePlan;
}

const PulseBoxCanvas: React.FC<PulseBoxProps> = ({ size, plan }) => {
  const { canvasRef } = useParticleCanvas(size, (ctx, stageSize, elapsedSec) => draw(ctx, stageSize, plan, elapsedSec));
  return <canvas ref={canvasRef} width={size.width} height={size.height} style={{ width: size.width, height: size.height }} />;
};

export const SignaturePulseEffect: React.FC<SignatureEffectRendererProps> = ({ requestId, signerId, frames, fields }) => {
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
        const size: StageSize = { width: box.width + PADDING * 2, height: box.height + PADDING * 2 };
        const plan = createPulsePlan(createSeededRandom(hashStringToSeed(box.key)));
        return (
          <div
            key={box.key}
            data-testid="projector-signature-pulse"
            className="absolute"
            style={{ left: box.left - PADDING, top: box.top - PADDING, width: size.width, height: size.height }}
          >
            <PulseBoxCanvas size={size} plan={plan} />
          </div>
        );
      })}
    </div>
  );
};
