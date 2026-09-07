import { randomRange, type Random } from '../../../utils/seededRandom';

// HIGHLIGHT/PULSE/RIPPLE(서명란에 앵커되는 효과)의 미세 변주 계획을 만드는 순수 함수 모음.
// 이 셋은 celebration 효과와 달리 파티클 샤워가 아니라 필드 사각형 하나에 붙는
// 단발성 액센트라, 굳이 canvas 파티클 엔진을 쓰기보다 dampedOscillation/expRise 같은
// 물리 기반 시간 함수(particleCanvas.ts)를 CSS 대신 canvas에 직접 그려 넣는 방식을 쓴다.
// 여기서는 그 연출들의 타이밍에 seed 기반의 작은 변주만 준다 — 같은 서명란이라도
// 매번 완전히 똑같은 박자로 반복되지 않게 하기 위함이다.

export interface HighlightPlan {
  /** 테두리가 그려지는 빠르기(초). 작을수록 빠르게 트레이스된다. */
  traceTau: number;
  /** 대각선 sheen이 한 번 훑고 지나가는 데 걸리는 시간(초). */
  sheenDuration: number;
  /** 네 모서리가 반짝이는 시점(초, elapsed 기준). */
  cornerGlintDelays: [number, number, number, number];
}

export const createHighlightPlan = (rng: Random): HighlightPlan => ({
  traceTau: randomRange(rng, 0.09, 0.14),
  sheenDuration: randomRange(rng, 1.0, 1.3),
  cornerGlintDelays: [
    randomRange(rng, 0.12, 0.22),
    randomRange(rng, 0.3, 0.42),
    randomRange(rng, 0.48, 0.6),
    randomRange(rng, 0.66, 0.8),
  ],
});

export interface PulsePlan {
  /** 진동 각속도(rad/s). */
  omega: number;
  /** 감쇠비 — 클수록 더 빨리 잦아든다. */
  zeta: number;
  /** 코어 글로우가 아우라 대비 갖는 위상차(rad). */
  corePhaseOffset: number;
}

export const createPulsePlan = (rng: Random): PulsePlan => ({
  omega: randomRange(rng, 7.5, 9.5),
  zeta: randomRange(rng, 0.16, 0.26),
  corePhaseOffset: randomRange(rng, 0.35, 0.55),
});

export interface RipplePlan {
  ringDelays: [number, number, number];
  /** 링마다 최대 확장 반경에 곱해지는 미세 스케일(0.9~1.1 정도). */
  ringScales: [number, number, number];
}

export const createRipplePlan = (rng: Random): RipplePlan => ({
  ringDelays: [0, randomRange(rng, 0.22, 0.34), randomRange(rng, 0.5, 0.64)],
  ringScales: [randomRange(rng, 0.94, 1.06), randomRange(rng, 0.94, 1.06), randomRange(rng, 0.94, 1.06)],
});

export interface FlashPlan {
  /** 테두리가 최고 밝기까지 치솟는 빠르기(초). 카메라 플래시처럼 거의 순간적이어야 한다. */
  riseTau: number;
  /** 최고 밝기 이후 잦아드는 빠르기(초). */
  decayTau: number;
}

export const createFlashPlan = (rng: Random): FlashPlan => ({
  riseTau: randomRange(rng, 0.012, 0.02),
  // 카메라 연사처럼 여러 번(SignatureFlashEffect.FLASH_COUNT) 겹쳐서 재생하므로,
  // 한 번의 감쇠가 너무 느리면 다음 번쩍임과 겹쳐 뭉개진다 — 0.26s보다 좁혀둔다.
  decayTau: randomRange(rng, 0.14, 0.18),
});
