import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { createPaperReelStrands, createSeededRandomFromRequestId, type PaperReelStrand } from './celebrationEffectPhysics';
import type { CompletionEffectRendererProps } from './effectRendererTypes';
import { drawRadialBurst, measureStage, useParticleCanvas } from './particleCanvas';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

interface Point { x: number; y: number }

const bezierPoint = (p0: Point, p1: Point, p2: Point, t: number): Point => {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
};

const REVEAL_SEGMENTS = 10;
const LANDING_FLASH_DURATION = 0.5;

/**
 * u(진행률)만큼 곡선을 따라가되, 머리(u)부터 꼬리(u-revealFraction)까지만 그려
 * "리본이 풀리며 날아가는" 구간을 재현한다. 머리 쪽은 굵고 진하게, 꼬리 쪽은
 * 가늘고 옅게 그려 테이퍼(taper)를 흉내낸다.
 */
const drawStrand = (ctx: CanvasRenderingContext2D, strand: PaperReelStrand, elapsedSec: number): void => {
  const localElapsed = elapsedSec - strand.launchDelay;
  if (localElapsed < 0) return;

  const rawU = (strand.v0 / strand.k) * (1 - Math.exp(-strand.k * localElapsed));
  const u = Math.min(1, rawU);
  if (u <= 0) return;

  const fade = localElapsed > strand.settleAt
    ? clamp01(1 - (localElapsed - strand.settleAt) / 0.6)
    : 1;
  if (fade <= 0) return;

  const revealFraction = lerp(0.5, 0.12, u);
  const uTail = Math.max(0, u - revealFraction);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = strand.color;
  ctx.shadowBlur = 3;
  for (let i = 0; i < REVEAL_SEGMENTS; i += 1) {
    const t0 = uTail + (u - uTail) * (i / REVEAL_SEGMENTS);
    const t1 = uTail + (u - uTail) * ((i + 1) / REVEAL_SEGMENTS);
    const p0 = bezierPoint(strand.start, strand.control, strand.end, t0);
    const p1 = bezierPoint(strand.start, strand.control, strand.end, t1);
    const headFraction = (i + 1) / REVEAL_SEGMENTS;
    ctx.globalAlpha = fade * lerp(0.25, 1, headFraction);
    ctx.strokeStyle = strand.color;
    ctx.lineWidth = lerp(strand.width * 0.3, strand.width, headFraction);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  ctx.restore();

  if (localElapsed >= strand.settleAt && localElapsed < strand.settleAt + LANDING_FLASH_DURATION) {
    drawRadialBurst(
      ctx,
      strand.end.x,
      strand.end.y,
      (localElapsed - strand.settleAt) / LANDING_FLASH_DURATION,
      strand.color,
      2,
      18,
    );
  }
};

export const PaperReelEffect: React.FC<CompletionEffectRendererProps> = ({ requestId, portalTarget }) => {
  const stageSize = useMemo(() => measureStage(portalTarget), [portalTarget]);
  const strands = useMemo(
    () => createPaperReelStrands(createSeededRandomFromRequestId(requestId), stageSize),
    [requestId, stageSize],
  );

  const { canvasRef, size } = useParticleCanvas(stageSize, (ctx, _stage, elapsedSec) => {
    strands.forEach(strand => drawStrand(ctx, strand, elapsedSec));
  });

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className={`pointer-events-none inset-0 z-[100] overflow-hidden ${portalTarget ? 'absolute' : 'fixed'}`} aria-hidden="true">
      <style>{`
        @keyframes signstage-paper-reel-launch {
          0% { opacity: 0; transform: scale(.2); }
          12% { opacity: .82; }
          55%, 100% { opacity: 0; transform: scale(1.7); }
        }
      `}</style>
      <span
        className="absolute -bottom-[8%] -left-[7%] h-[34%] w-[22%] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,247,214,.88),rgba(242,207,104,.25)_34%,transparent_70%)] blur-sm"
        style={{ animation: 'signstage-paper-reel-launch 1.25s ease-out both' }}
      />
      <span
        className="absolute -bottom-[8%] -right-[7%] h-[34%] w-[22%] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,247,214,.88),rgba(242,207,104,.25)_34%,transparent_70%)] blur-sm"
        style={{ animation: 'signstage-paper-reel-launch 1.25s ease-out .18s both' }}
      />
      <canvas
        ref={canvasRef}
        data-testid="projector-paper-reel-canvas"
        width={size.width}
        height={size.height}
        style={{ width: size.width, height: size.height }}
      />
    </div>,
    portalTarget ?? document.body,
  );
};
