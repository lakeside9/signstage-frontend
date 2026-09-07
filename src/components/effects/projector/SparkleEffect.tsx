import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { createSeededRandomFromRequestId, createSparkleStars, SPARKLE_TOTAL_SECONDS } from './celebrationEffectPhysics';
import type { CompletionEffectRendererProps } from './effectRendererTypes';
import { measureStage, useParticleCanvas } from './particleCanvas';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** 시작 0.4s/종료 0.6s를 부드럽게 여닫는 전체 연출 봉투(envelope). */
const sceneEnvelope = (elapsedSec: number): number => {
  const fadeIn = clamp01(elapsedSec / 0.4);
  const fadeOut = clamp01((SPARKLE_TOTAL_SECONDS - elapsedSec) / 0.6);
  return Math.min(fadeIn, fadeOut);
};

export const SparkleEffect: React.FC<CompletionEffectRendererProps> = ({ requestId, portalTarget }) => {
  const stageSize = useMemo(() => measureStage(portalTarget), [portalTarget]);
  const stars = useMemo(
    () => createSparkleStars(createSeededRandomFromRequestId(requestId), stageSize),
    [requestId, stageSize],
  );

  const { canvasRef, size } = useParticleCanvas(stageSize, (ctx, _stage, elapsedSec) => {
    const envelope = sceneEnvelope(elapsedSec);
    if (envelope <= 0) return;
    stars.forEach(star => {
      const appear = clamp01((elapsedSec - star.appearAt) / 0.3);
      const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(elapsedSec * star.freq + star.phase));
      const alpha = envelope * appear * twinkle;
      if (alpha <= 0.02) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha;
      ctx.fillStyle = star.color;
      ctx.shadowColor = star.color;
      ctx.shadowBlur = star.size * 0.9;
      ctx.font = `${star.size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✦', star.x, star.y);
      ctx.restore();
    });
  });

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`pointer-events-none inset-0 z-[100] overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(255,248,220,.18),rgba(49,46,129,.08)_48%,transparent_74%)] ${portalTarget ? 'absolute' : 'fixed'}`}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        data-testid="projector-sparkle-canvas"
        width={size.width}
        height={size.height}
        style={{ width: size.width, height: size.height }}
      />
    </div>,
    portalTarget ?? document.body,
  );
};
