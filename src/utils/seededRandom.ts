// 완료 효과(축하 효과)의 파티클 배치에 쓰는 결정적 난수 유틸.
// Math.random()을 바로 쓰면 매 렌더마다 결과가 달라져 테스트를 스냅샷/개수로
// 검증할 수 없고, 반대로 지금처럼 (id * 47) % 101 같은 고정 수식만 쓰면
// 매번 정확히 같은 모양으로만 재생돼 라이브러리 특유의 "매번 다른 느낌"이 없다.
// requestId를 해시해 시드로 쓰면, 실제 서비스에서는 요청마다 다른 패턴이 나오면서도
// 테스트에서는 같은 requestId를 넘기는 한 항상 같은 결과가 나와 둘 다 만족한다.

export type Random = () => number;

/** FNV-1a 계열의 간단한 문자열 해시. requestId 등 임의 문자열을 32비트 정수 시드로 변환한다. */
export const hashStringToSeed = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/** mulberry32 PRNG. 의존성 없이 몇 줄로 구현되는 결정적 난수 생성기. */
export const createSeededRandom = (seed: number): Random => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const randomRange = (rng: Random, min: number, max: number): number => min + rng() * (max - min);

export const randomPick = <T>(rng: Random, items: readonly T[]): T => items[Math.floor(rng() * items.length) % items.length];

/**
 * Box-Muller 변환. 균등분포 대신 정규분포 난수를 뽑아, 파티클이 중심에 몰리고
 * 가장자리로 갈수록 옅어지는 자연스러운 밀도 분포를 만든다.
 */
export const gaussianRandom = (rng: Random, mean = 0, stdDev = 1): number => {
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = rng();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * stdDev;
};
