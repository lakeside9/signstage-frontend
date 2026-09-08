import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  createFireworkBursts,
  createSeededRandomFromRequestId,
  FIREWORK_ASCEND_DURATION,
  FIREWORK_SPARK_FADE_DURATION,
  type FireworkBurst,
} from './celebrationEffectPhysics';
import type { CompletionEffectRendererProps } from './effectRendererTypes';
import { drawGlowSpark, drawRadialBurst, measureStage, stepGlowSpark, useParticleCanvas } from './particleCanvas';

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const drawRocketTrail = (ctx: CanvasRenderingContext2D, burst: FireworkBurst, ascendElapsed: number): void => {
  [0, 0.06, 0.12, 0.18].forEach((offset, index) => {
    const t = clamp01((ascendElapsed - offset) / FIREWORK_ASCEND_DURATION);
    const eased = easeOutCubic(t);
    const px = lerp(burst.launchX, burst.x, eased);
    const py = lerp(burst.launchY, burst.y, eased);
    const alpha = [1, 0.6, 0.35, 0.15][index] * clamp01(ascendElapsed / 0.05);
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = burst.color;
    ctx.shadowColor = burst.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(px, py, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
};

export const FireworksEffect: React.FC<CompletionEffectRendererProps> = ({ requestId, portalTarget }) => {
  const stageSize = useMemo(() => measureStage(portalTarget), [portalTarget]);
  const bursts = useMemo(
    () => createFireworkBursts(createSeededRandomFromRequestId(requestId), stageSize),
    [requestId, stageSize],
  );

  const { canvasRef, size } = useParticleCanvas(stageSize, (ctx, _stage, elapsedSec, dtSec) => {
    bursts.forEach(burst => {
      const ascendElapsed = elapsedSec - burst.delay;
      if (ascendElapsed >= 0 && ascendElapsed < FIREWORK_ASCEND_DURATION) {
        drawRocketTrail(ctx, burst, ascendElapsed);
      }

      const explosionElapsed = elapsedSec - (burst.delay + FIREWORK_ASCEND_DURATION);
      if (explosionElapsed < 0) return;
      if (explosionElapsed < 0.3) drawRadialBurst(ctx, burst.x, burst.y, clamp01(explosionElapsed / 0.3), burst.color);

      burst.sparks.forEach(spark => {
        const localElapsed = elapsedSec - spark.delay;
        if (localElapsed < 0) return;
        stepGlowSpark(spark, dtSec);
        const alpha = clamp01(1 - localElapsed / FIREWORK_SPARK_FADE_DURATION);
        drawGlowSpark(ctx, spark, alpha);
      });
    });
  });

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`pointer-events-none inset-0 z-[100] overflow-hidden bg-[radial-gradient(circle_at_50%_50%,rgba(30,27,75,.12),transparent_72%)] ${portalTarget ? 'absolute' : 'fixed'}`}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        data-testid="projector-fireworks-canvas"
        width={size.width}
        height={size.height}
        style={{ width: size.width, height: size.height }}
      />
    </div>,
    portalTarget ?? document.body,
  );
};
