import { createSeededRandom, gaussianRandom, hashStringToSeed, randomPick, randomRange, type Random } from '../../../utils/seededRandom';
import { CELEBRATION_PALETTE } from './effectPalette';
import type { FlutterParticle, GlowSpark, StageSize } from './particleCanvas';

// CONFETTI/AIR_SHOT/FIREWORKS/SPARKLE의 파티클 배치를 만드는 순수 함수 모음.
// 렌더링(React 컴포넌트/canvas)과 분리해두면 물리 시뮬레이션 자체를
// DOM 없이 유닛 테스트할 수 있다. requestId를 시드로 삼기 때문에
// (createSeededRandomFromRequestId) 실제 서비스에서는 매 요청마다 다른 패턴이 나오고,
// 테스트에서는 같은 requestId를 넘기는 한 항상 같은 결과가 재현된다.
export const createSeededRandomFromRequestId = (requestId: string): Random => createSeededRandom(hashStringToSeed(requestId));

const CONFETTI_COUNT = 72;

/**
 * 종이조각을 물리 기반(중력 + 공기저항)으로 낙하시킨다.
 * 낙하 시간이 canvas 높이에 비례하도록 종단속도를 화면 높이에서 역산해,
 * 미리보기(좁은 박스)와 실제 프로젝터(전체 화면) 모두에서 자연스러운 낙하 시간을 유지한다.
 */
export const createConfettiParticles = (rng: Random, size: StageSize, count = CONFETTI_COUNT): FlutterParticle[] => (
  Array.from({ length: count }, () => {
    const fallSeconds = randomRange(rng, 3.6, 4.3);
    const drag = randomRange(rng, 0.85, 1.15);
    const terminalVy = size.height / fallSeconds;
    return {
      x: rng() * size.width,
      y: -randomRange(rng, 10, 60),
      vx: gaussianRandom(rng, 0, size.width * 0.035),
      vy: randomRange(rng, 0, terminalVy * 0.15),
      gravity: terminalVy * drag,
      drag,
      rotation: rng() * Math.PI * 2,
      angularVelocity: gaussianRandom(rng, 0, 2.2),
      flutterFreq: randomRange(rng, 4, 9),
      flutterPhase: rng() * Math.PI * 2,
      color: randomPick(rng, CELEBRATION_PALETTE),
      width: randomRange(rng, 5, 9),
      height: randomRange(rng, 10, 19),
      delay: rng() * 0.7,
    };
  })
);

const AIR_SHOT_SOURCE_FRACTIONS = [0.12, 0.36, 0.64, 0.88];
const AIR_SHOT_PARTICLES_PER_SOURCE = 21;

/**
 * stepFlutterParticle의 물리 모델(dv/dt = gravity - drag*v)로 목표 높이 targetHeight까지
 * 도달하는 데 필요한 초기 발사 속도를 뉴턴-랩슨으로 역산한다.
 *
 * v0 = sqrt(2*g*h) 같은 무항력 탄도 공식은 "상승 중에도 항력이 감속을 더한다"는 걸
 * 놓친다 — stepFlutterParticle은 낙하할 때뿐 아니라 올라갈 때도 같은 항력 항을 적용하므로
 * (항력이 항상 속도와 반대 방향으로 작용해야 물리적으로 맞다), 무항력 공식으로 구한
 * 속도로 쏘면 항력 때문에 의도한 높이의 절반 정도(화면 "중간")에서 꺾여버린다.
 * 실제 해(공기저항이 있는 포물선의 정점 높이)는
 *   H(u0) = (drag*u0 - gravity*ln(1 + drag*u0/gravity)) / drag^2
 * 로 닫힌 형태가 있지만 u0에 대해 역으로 풀 수는 없어 뉴턴-랩슨으로 근사한다.
 */
export const solveLaunchSpeedForHeight = (targetHeight: number, gravity: number, drag: number): number => {
  const heightForSpeed = (u0: number): number => (
    (drag * u0 - gravity * Math.log(1 + (drag * u0) / gravity)) / (drag * drag)
  );
  // 무항력 근사치(sqrt(2*g*h))는 실제보다 낮게 나오는 값이라 안전한 시작점이 된다.
  let u0 = Math.sqrt(2 * gravity * targetHeight);
  for (let i = 0; i < 12; i += 1) {
    const height = heightForSpeed(u0);
    // dH/du0 = u0 / (gravity + drag*u0). drag→0 극한에서 무항력 공식의 dH/du0 = u0/gravity와
    // 일치해야 하는데, 검증해보면 실제로 일치한다 — 이 도함수가 맞다는 뜻.
    const dHeightDu0 = u0 / (gravity + drag * u0);
    u0 -= (height - targetHeight) / dHeightDu0;
  }
  return Math.max(u0, 0);
};

/**
 * 발사대에서 위로 쏘아 올린 뒤 중력을 받아 포물선으로 떨어지는 캐논 파티클.
 * 도달 높이(peak)를 먼저 정하고 solveLaunchSpeedForHeight로 역산해, 화면 크기에
 * 관계없이 항상 "화면의 55~90% 높이까지 튀어오르는" 비율을 유지한다.
 */
export const createAirShotParticles = (rng: Random, size: StageSize): FlutterParticle[] => (
  AIR_SHOT_SOURCE_FRACTIONS.flatMap((sourceFraction, sourceIndex) => Array.from(
    { length: AIR_SHOT_PARTICLES_PER_SOURCE },
    () => {
      const peakHeight = size.height * randomRange(rng, 0.55, 0.9);
      const gravity = size.height * randomRange(rng, 0.9, 1.35);
      const drag = randomRange(rng, 0.5, 0.9);
      const launchSpeed = solveLaunchSpeedForHeight(peakHeight, gravity, drag);
      return {
        x: sourceFraction * size.width,
        y: size.height - randomRange(rng, 5, 30),
        vx: gaussianRandom(rng, 0, launchSpeed * 0.5),
        vy: -launchSpeed,
        gravity,
        drag,
        rotation: rng() * Math.PI * 2,
        angularVelocity: gaussianRandom(rng, 0, 2.4),
        flutterFreq: randomRange(rng, 4, 9),
        flutterPhase: rng() * Math.PI * 2,
        color: randomPick(rng, CELEBRATION_PALETTE),
        width: randomRange(rng, 5, 8.5),
        height: randomRange(rng, 10, 17),
        delay: sourceIndex * 0.13 + rng() * 0.15,
      };
    },
  ))
);

export const AIR_SHOT_SOURCES = AIR_SHOT_SOURCE_FRACTIONS;

// 로켓이 발사대(화면 하단)에서 목표 지점까지 상승하는 데 걸리는 시간과,
// 폭발 후 스파크가 사그라드는 데 걸리는 시간. COMPLETION_EFFECT_CATALOG.FIREWORKS의
// durationMs(3800ms)를 넘지 않도록 마지막 버스트(delay 2.15s) 기준으로 역산해 고정했다.
export const FIREWORK_ASCEND_DURATION = 0.4;
export const FIREWORK_SPARK_FADE_DURATION = 1.2;
const FIREWORK_SPARKS_PER_BURST = 14;

const FIREWORK_BURST_POINTS = [
  { x: 20, y: 28, delay: 0.1 },
  { x: 51, y: 20, delay: 0.65 },
  { x: 79, y: 32, delay: 1.15 },
  { x: 35, y: 48, delay: 1.7 },
  { x: 67, y: 52, delay: 2.15 },
];

export interface FireworkBurst {
  launchX: number;
  launchY: number;
  x: number;
  y: number;
  delay: number;
  color: string;
  sparks: GlowSpark[];
}

/**
 * 발사(로켓 상승) → 폭발(방사형 스파크) 2단계 구조.
 * 각 스파크의 delay는 "그 버스트의 로켓이 도착하는 시점"으로 맞춰, 상승이 끝나자마자
 * 자연스럽게 이어서 터지도록 한다.
 */
export const createFireworkBursts = (rng: Random, size: StageSize): FireworkBurst[] => (
  FIREWORK_BURST_POINTS.map(point => {
    const x = (point.x / 100) * size.width;
    const y = (point.y / 100) * size.height;
    const color = randomPick(rng, CELEBRATION_PALETTE);
    const explodeAt = point.delay + FIREWORK_ASCEND_DURATION;
    const minDimension = Math.min(size.width, size.height);
    const sparks: GlowSpark[] = Array.from({ length: FIREWORK_SPARKS_PER_BURST }, (_, sparkIndex) => {
      const angle = (sparkIndex / FIREWORK_SPARKS_PER_BURST) * Math.PI * 2 + randomRange(rng, -0.12, 0.12);
      const speed = minDimension * randomRange(rng, 0.32, 0.5);
      return {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: size.height * 0.12,
        drag: randomRange(rng, 1.4, 2.1),
        color: randomPick(rng, CELEBRATION_PALETTE),
        length: randomRange(rng, 14, 26),
        delay: explodeAt + rng() * 0.04,
      };
    });
    return { launchX: x + randomRange(rng, -6, 6), launchY: size.height, x, y, delay: point.delay, color, sparks };
  })
);

const SPARKLE_STAR_COUNT = 54;
// COMPLETION_EFFECT_CATALOG.SPARKLE.durationMs(4200ms)와 맞춘 전체 연출 길이.
export const SPARKLE_TOTAL_SECONDS = 4.2;

export interface SparkleStar {
  x: number;
  y: number;
  size: number;
  color: string;
  /** 반짝임 주기(rad/s). CSS keyframe 반복과 달리 별마다 다른 위상으로 계속 흔들린다. */
  freq: number;
  phase: number;
  appearAt: number;
}

export const createSparkleStars = (rng: Random, size: StageSize, count = SPARKLE_STAR_COUNT): SparkleStar[] => (
  Array.from({ length: count }, () => ({
    x: rng() * size.width,
    y: size.height * randomRange(rng, 0.04, 0.92),
    size: randomRange(rng, 7, 22),
    color: randomPick(rng, CELEBRATION_PALETTE),
    freq: randomRange(rng, 2, 5),
    phase: rng() * Math.PI * 2,
    appearAt: rng() * 0.9,
  }))
);

const PAPER_REEL_COUNT_PER_SIDE = 8;

export interface PaperReelStrand {
  start: { x: number; y: number };
  control: { x: number; y: number };
  end: { x: number; y: number };
  color: string;
  width: number;
  launchDelay: number;
  /** u(t) = (v0/k)(1 - e^(-k·t)) — 던져진 리본이 마찰로 감속하며 목표 지점(u=1)에 도달하는 1차원 운동. */
  v0: number;
  k: number;
  /** u(t)가 정확히 1에 도달하는 시각(초). 이 이후로는 페이드아웃만 남는다. */
  settleAt: number;
}

/**
 * 좌우 하단 모서리에서 쏘아 올려 2차 베지어 곡선을 그리며 반대편으로 날아가는 리본.
 * 곡선 형태(시작-제어점-끝점)는 그대로 두고, 그 위를 진행하는 속도만
 * "던져진 뒤 마찰로 감속" 물리로 바꿔 CSS keyframe의 고정 구간 이징보다
 * 자연스러운 감속을 낸다. v0/k 비율을 1보다 살짝 크게 잡아야 유한 시간에 u=1에 도달한다.
 */
export const createPaperReelStrands = (rng: Random, size: StageSize): PaperReelStrand[] => (
  (['LEFT', 'RIGHT'] as const).flatMap(side => Array.from({ length: PAPER_REEL_COUNT_PER_SIDE }, (_, index) => {
    const spreadFrac = 0.36 + index * 0.067 + randomRange(rng, -0.02, 0.02);
    const landingXFrac = side === 'LEFT' ? spreadFrac : 1 - spreadFrac;
    const landingYFrac = randomRange(rng, 0.94, 0.99);
    const startXFrac = side === 'LEFT' ? -0.012 : 1.012;
    const controlXFrac = (startXFrac + landingXFrac) / 2 + randomRange(rng, -0.05, 0.05);
    const controlYFrac = -randomRange(rng, 0.5, 0.75);

    const ratio = randomRange(rng, 1.03, 1.08); // v0/k: 1을 살짝 넘겨야 유한 시간 내 u=1에 도달한다.
    const k = randomRange(rng, 1.3, 1.9); // 감쇠율 — 클수록 빨리 멈춘다.
    const v0 = ratio * k;
    const settleAt = -Math.log(1 - 1 / ratio) / k;

    return {
      start: { x: startXFrac * size.width, y: 1.014 * size.height },
      control: { x: controlXFrac * size.width, y: controlYFrac * size.height },
      end: { x: landingXFrac * size.width, y: landingYFrac * size.height },
      color: randomPick(rng, CELEBRATION_PALETTE),
      width: randomRange(rng, 4, 8.5),
      launchDelay: rng() * 0.5,
      v0,
      k,
      settleAt,
    };
  }))
);
