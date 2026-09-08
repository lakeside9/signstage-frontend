import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AIR_SHOT_SOURCES, createAirShotParticles, createSeededRandomFromRequestId } from './celebrationEffectPhysics';
import type { CompletionEffectRendererProps } from './effectRendererTypes';
import { drawFlutterParticle, measureStage, stepFlutterParticle, useParticleCanvas } from './particleCanvas';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const AirShotEffect: React.FC<CompletionEffectRendererProps> = ({ requestId, portalTarget }) => {
  const stageSize = useMemo(() => measureStage(portalTarget), [portalTarget]);
  const particles = useMemo(
    () => createAirShotParticles(createSeededRandomFromRequestId(requestId), stageSize),
    [requestId, stageSize],
  );

  const { canvasRef, size } = useParticleCanvas(stageSize, (ctx, stage, elapsedSec, dtSec) => {
    particles.forEach(particle => {
      const localElapsed = elapsedSec - particle.delay;
      if (localElapsed < 0) return;
      stepFlutterParticle(particle, dtSec);
      const fadeIn = clamp01(localElapsed / 0.15);
      const fadeOut = clamp01((stage.height * 1.06 - particle.y) / (stage.height * 0.14));
      drawFlutterParticle(ctx, particle, elapsedSec, fadeIn * fadeOut);
    });
  });

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className={`pointer-events-none inset-0 z-[100] overflow-hidden ${portalTarget ? 'absolute' : 'fixed'}`} aria-hidden="true">
      <style>{`
        @keyframes signstage-air-shot-jet {
          0% { opacity: 0; transform: translate(-50%, 30%) scale(.25); }
          12% { opacity: .72; }
          52%, 100% { opacity: 0; transform: translate(-50%, -45%) scale(1.35); }
        }
      `}</style>
      {AIR_SHOT_SOURCES.map((fraction, index) => (
        <span
          key={fraction}
          className="absolute bottom-0 h-28 w-20 -translate-x-1/2 bg-[radial-gradient(ellipse_at_bottom,rgba(255,248,220,.7),rgba(255,255,255,.15)_42%,transparent_70%)] blur-sm"
          style={{ left: `${fraction * 100}%`, animation: `signstage-air-shot-jet 1.1s ease-out ${index * 0.13}s both` }}
        />
      ))}
      <canvas
        ref={canvasRef}
        data-testid="projector-air-shot-canvas"
        width={size.width}
        height={size.height}
        style={{ width: size.width, height: size.height }}
      />
    </div>,
    portalTarget ?? document.body,
  );
};
