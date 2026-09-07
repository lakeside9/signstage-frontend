import { useCallback, useEffect, useRef, useState } from 'react';

// CONFETTI/AIR_SHOT/FIREWORKS/SPARKLE가 공유하는 canvas 파티클 물리 유틸.
// canvas-confetti 같은 외부 라이브러리를 추가하지 않고, 그 라이브러리들이 쓰는 것과
// 같은 방식(rAF마다 속도-중력-공기저항을 직접 적분)을 자체 구현한다.
// CSS keyframe의 고정 이징 곡선과 달리, 매 프레임 실제로 속도를 갱신하기 때문에
// 파티클마다 자연스럽게 다른 가속/감속 궤적이 나온다.

export interface FlutterParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** px/s^2. 중력가속도. */
  gravity: number;
  /** 초당 속도 감쇠 비율(0~1에 가까운 값). 공기저항 역할. */
  drag: number;
  rotation: number;
  angularVelocity: number;
  flutterFreq: number;
  flutterPhase: number;
  color: string;
  width: number;
  height: number;
  /** 이 시간(초)이 지나기 전에는 등장하지 않는다. */
  delay: number;
}

/** 중력-공기저항 모델: dv/dt = g - drag*v. 시간이 지나면 종단속도(g/drag)로 수렴한다. */
export const stepFlutterParticle = (particle: FlutterParticle, dt: number): void => {
  particle.vy += (particle.gravity - particle.drag * particle.vy) * dt;
  particle.vx *= Math.max(0, 1 - particle.drag * dt);
  particle.x += particle.vx * dt;
  particle.y += particle.vy * dt;
  particle.rotation += particle.angularVelocity * dt;
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** 진입/퇴장 시 알파를 살짝 페이드시켜 파티클이 화면에서 뚝 끊겨 사라지지 않게 한다. */
export const edgeFade = (position: number, span: number, fadeSpan: number): number => {
  const fadeIn = clamp01(position / fadeSpan);
  const fadeOut = clamp01((span - position) / fadeSpan);
  return Math.min(fadeIn, fadeOut);
};

export const drawFlutterParticle = (
  ctx: CanvasRenderingContext2D,
  particle: FlutterParticle,
  elapsedSec: number,
  alpha: number,
): void => {
  if (alpha <= 0) return;
  const flip = Math.cos(elapsedSec * particle.flutterFreq + particle.flutterPhase);
  const shade = 0.75 + 0.25 * flip;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(particle.x, particle.y);
  ctx.rotate(particle.rotation);
  ctx.scale(Math.max(0.14, Math.abs(flip)), 1);
  ctx.fillStyle = particle.color;
  ctx.globalAlpha = alpha * shade;
  ctx.fillRect(-particle.width / 2, -particle.height / 2, particle.width, particle.height);
  ctx.restore();
};

export interface GlowSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  color: string;
  length: number;
  delay: number;
}

export const stepGlowSpark = (spark: GlowSpark, dt: number): void => {
  spark.vy += (spark.gravity - spark.drag * spark.vy) * dt;
  spark.vx *= Math.max(0, 1 - spark.drag * dt);
  spark.x += spark.vx * dt;
  spark.y += spark.vy * dt;
};

/** 진행 방향으로 짧은 발광 선(streak)을 그린다. 불꽃놀이 스파크용. */
export const drawGlowSpark = (ctx: CanvasRenderingContext2D, spark: GlowSpark, alpha: number): void => {
  if (alpha <= 0) return;
  const speed = Math.hypot(spark.vx, spark.vy) || 1;
  const dirX = spark.vx / speed;
  const dirY = spark.vy / speed;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = spark.color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.shadowColor = spark.color;
  ctx.shadowBlur = 10;
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();
  ctx.moveTo(spark.x - dirX * spark.length, spark.y - dirY * spark.length);
  ctx.lineTo(spark.x, spark.y);
  ctx.stroke();
  ctx.restore();
};

/** 중심에서 퍼지며 사그라드는 발광 원. 불꽃 폭발 섬광이나 리본 착지 섬광처럼 짧게 번쩍이는 연출에 재사용한다. */
export const drawRadialBurst = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  progress: number,
  color: string,
  minRadius = 6,
  maxRadius = 46,
): void => {
  const t = clamp01(progress);
  const alpha = 1 - t;
  if (alpha <= 0) return;
  const radius = minRadius + t * (maxRadius - minRadius);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `${color}ff`);
  gradient.addColorStop(0.4, `${color}88`);
  gradient.addColorStop(1, `${color}00`);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/** 1 - e^(-t/tau). 어떤 값이 목표치로 부드럽게 "차오르는" 과정(테두리 트레이스 등)에 쓴다. */
export const expRise = (t: number, tau: number): number => 1 - Math.exp(-t / tau);

/** e^(-t/tau). 어떤 값이 부드럽게 "사그라드는" 과정(플래시, 페이드아웃 등)에 쓴다. */
export const expDecay = (t: number, tau: number): number => Math.exp(-t / tau);

/**
 * 감쇠 조화 진동자의 임펄스 응답: e^(-zeta·omega·t)·sin(omega·t).
 * 종을 한 번 쳤을 때처럼 빠르게 커졌다가 진동하며 잦아드는 곡선 — CSS keyframe으로
 * 흉내낸 고정 박동(heartbeat)보다 자연스러운 pulse/ripple 연출에 쓴다.
 */
export const dampedOscillation = (t: number, omega: number, zeta: number): number => (
  Math.exp(-zeta * omega * t) * Math.sin(omega * t)
);

/** 둥근 사각형 경로. 서명란 앵커 효과(HIGHLIGHT/PULSE/RIPPLE)가 공유하는 기본 도형. */
export const roundRectPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number): void => {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

export interface StageSize {
  width: number;
  height: number;
}

/** portalTarget(관리자 미리보기 컨테이너)이 있으면 그 크기, 없으면 전체 뷰포트 크기를 쓴다. */
export const measureStage = (portalTarget: HTMLElement | undefined): StageSize => ({
  width: portalTarget?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1280),
  height: portalTarget?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 720),
});

/**
 * canvas 엘리먼트 하나를 소유하고, 주어진 크기(size)에 맞춰 devicePixelRatio까지
 * 대응한 뒤 requestAnimationFrame 루프를 돌려 매 프레임 onFrame을 호출한다.
 * 컴포넌트가 unmount되면 루프를 정리한다.
 *
 * size는 호출부에서 결정한다 — 완료 효과는 measureStage(portalTarget)로 화면/미리보기
 * 크기를, 서명란 앵커 효과는 필드 박스 크기를 그대로 넘긴다. 요청마다 새로 mount되는
 * 일회성 연출이라 mount 시점의 크기만 알면 충분하고, 이후 리사이즈에 반응할 필요는 없다.
 */
export const useParticleCanvas = (
  initialSize: StageSize,
  onFrame: (ctx: CanvasRenderingContext2D, size: StageSize, elapsedSec: number, dtSec: number) => void,
): { canvasRef: (node: HTMLCanvasElement | null) => void; size: StageSize } => {
  const [size] = useState<StageSize>(() => initialSize);
  const canvasNodeRef = useRef<HTMLCanvasElement | null>(null);
  const [attached, setAttached] = useState(false);
  const canvasRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasNodeRef.current = node;
    setAttached(node != null);
  }, []);

  const onFrameRef = useRef(onFrame);
  useEffect(() => {
    onFrameRef.current = onFrame;
  });

  useEffect(() => {
    const canvas = canvasNodeRef.current;
    if (!attached || !canvas) return undefined;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.max(1, Math.round(size.width * dpr));
    canvas.height = Math.max(1, Math.round(size.height * dpr));
    const ctx = canvas.getContext('2d');
    // jsdom(테스트 환경)은 2D 컨텍스트를 제공하지 않는다 — 그릴 게 없으면 조용히 종료한다.
    if (!ctx) return undefined;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let frameHandle = 0;
    let lastTime = 0;
    let startTime = 0;

    const loop = (now: number): void => {
      if (startTime === 0) {
        startTime = now;
        lastTime = now;
      }
      const dtSec = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      ctx.clearRect(0, 0, size.width, size.height);
      onFrameRef.current(ctx, size, (now - startTime) / 1000, dtSec);
      frameHandle = window.requestAnimationFrame(loop);
    };
    frameHandle = window.requestAnimationFrame(loop);

    return () => window.cancelAnimationFrame(frameHandle);
  }, [attached, size]);

  return { canvasRef, size };
};
