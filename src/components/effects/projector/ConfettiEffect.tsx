import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { createConfettiParticles, createSeededRandomFromRequestId } from './celebrationEffectPhysics';
import type { CompletionEffectRendererProps } from './effectRendererTypes';
import { drawFlutterParticle, measureStage, stepFlutterParticle, useParticleCanvas } from './particleCanvas';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const ConfettiEffect: React.FC<CompletionEffectRendererProps> = ({ requestId, portalTarget }) => {
  const stageSize = useMemo(() => measureStage(portalTarget), [portalTarget]);
  const particles = useMemo(
    () => createConfettiParticles(createSeededRandomFromRequestId(requestId), stageSize),
    [requestId, stageSize],
  );

  const { canvasRef, size } = useParticleCanvas(stageSize, (ctx, stage, elapsedSec, dtSec) => {
    particles.forEach(particle => {
      const localElapsed = elapsedSec - particle.delay;
      if (localElapsed < 0) return;
      stepFlutterParticle(particle, dtSec);
      const fadeIn = clamp01(localElapsed / 0.2);
      const fadeOut = clamp01((stage.height * 1.05 - particle.y) / (stage.height * 0.2));
      drawFlutterParticle(ctx, particle, elapsedSec, fadeIn * fadeOut);
    });
  });

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className={`pointer-events-none inset-0 z-[100] overflow-hidden ${portalTarget ? 'absolute' : 'fixed'}`} aria-hidden="true">
      <style>{`
        @keyframes signstage-confetti-glow {
          0%, 100% { opacity: 0; }
          18% { opacity: .2; }
          62% { opacity: .08; }
        }
      `}</style>
      <span
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(255,248,220,.28),transparent_48%)]"
        style={{ animation: 'signstage-confetti-glow 4.2s ease-out both' }}
      />
      <canvas
        ref={canvasRef}
        data-testid="projector-confetti-canvas"
        width={size.width}
        height={size.height}
        style={{ width: size.width, height: size.height }}
      />
    </div>,
    portalTarget ?? document.body,
  );
};
