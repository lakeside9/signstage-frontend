import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../../../utils/seededRandom';
import {
  createAirShotParticles,
  createConfettiParticles,
  createFireworkBursts,
  createPaperReelStrands,
  createSparkleStars,
  solveLaunchSpeedForHeight,
} from './celebrationEffectPhysics';
import { stepFlutterParticle, type FlutterParticle } from './particleCanvas';

/** solveLaunchSpeedForHeight로 구한 속도로 실제 stepFlutterParticle을 밟아, 진짜 도달 높이를 잰다. */
const simulatePeakHeight = (launchSpeed: number, gravity: number, drag: number): number => {
  const particle: FlutterParticle = {
    x: 0, y: 0, vx: 0, vy: -launchSpeed, gravity, drag,
    rotation: 0, angularVelocity: 0, flutterFreq: 0, flutterPhase: 0,
    color: '#fff', width: 1, height: 1, delay: 0,
  };
  let minY = 0;
  const dt = 0.001;
  for (let t = 0; t < 10 && particle.vy < 0; t += dt) {
    stepFlutterParticle(particle, dt);
    if (particle.y < minY) minY = particle.y;
  }
  return -minY;
};

const STAGE = { width: 1000, height: 800 };

describe('solveLaunchSpeedForHeight', () => {
  it.each([
    [800, 0.5, 300],
    [800, 0.9, 300],
    [1080, 0.7, 900],
    [600, 0.5, 200],
  ])('case #%# reaches within 2 percent of the target height once actually stepped through stepFlutterParticle (gravity=%d, drag=%d, target=%d)', (gravity, drag, targetHeight) => {
    const launchSpeed = solveLaunchSpeedForHeight(targetHeight, gravity, drag);
    const achievedHeight = simulatePeakHeight(launchSpeed, gravity, drag);
    expect(achievedHeight).toBeGreaterThan(targetHeight * 0.98);
    expect(achievedHeight).toBeLessThan(targetHeight * 1.02);
  });

  it('needs a launch speed well above the naive no-drag ballistic formula (sqrt(2*g*h))', () => {
    // 이게 바로 AIR_SHOT이 "중간 정도까지만" 올라가던 버그의 원인이었다 — 무항력 공식으로
    // 구한 속도로는 항력 때문에 목표 높이에 한참 못 미친다.
    const gravity = 800;
    const drag = 0.7;
    const targetHeight = 500;
    const noDragSpeed = Math.sqrt(2 * gravity * targetHeight);
    const correctedSpeed = solveLaunchSpeedForHeight(targetHeight, gravity, drag);
    expect(correctedSpeed).toBeGreaterThan(noDragSpeed * 1.2);

    const shortfall = simulatePeakHeight(noDragSpeed, gravity, drag);
    expect(shortfall).toBeLessThan(targetHeight * 0.8); // 무항력 속도로는 목표에 못 미친다
  });
});

describe('createConfettiParticles', () => {
  it('creates 72 particles that start above the visible area', () => {
    const particles = createConfettiParticles(createSeededRandom(1), STAGE);
    expect(particles).toHaveLength(72);
    particles.forEach(particle => {
      expect(particle.x).toBeGreaterThanOrEqual(0);
      expect(particle.x).toBeLessThan(STAGE.width);
      expect(particle.y).toBeLessThan(0);
      expect(particle.delay).toBeGreaterThanOrEqual(0);
      expect(particle.delay).toBeLessThan(0.7);
    });
  });

  it('is deterministic for the same seed', () => {
    const a = createConfettiParticles(createSeededRandom(99), STAGE);
    const b = createConfettiParticles(createSeededRandom(99), STAGE);
    expect(a).toEqual(b);
  });
});

describe('createAirShotParticles', () => {
  it('launches 84 particles upward from 4 sources near the bottom edge', () => {
    const particles = createAirShotParticles(createSeededRandom(2), STAGE);
    expect(particles).toHaveLength(84);
    particles.forEach(particle => {
      expect(particle.vy).toBeLessThan(0); // 위로 발사
      expect(particle.y).toBeGreaterThan(STAGE.height * 0.9);
    });
  });

  it('actually reaches at least half the stage height once stepped through the real physics (regression: used to stall around mid-screen)', () => {
    const particles = createAirShotParticles(createSeededRandom(2), STAGE);
    particles.forEach(particle => {
      const achievedHeight = simulatePeakHeight(-particle.vy, particle.gravity, particle.drag);
      // 목표 범위는 화면의 55~90%지만, 파티클마다 다른 목표라 여기선 "최소한 절반 이상은
      // 올라간다"는 느슨한 회귀 기준만 확인한다 — 정확한 목표치 일치는 solveLaunchSpeedForHeight
      // 테스트에서 이미 검증한다.
      expect(achievedHeight).toBeGreaterThan(STAGE.height * 0.5);
    });
  });
});

describe('createFireworkBursts', () => {
  it('creates 5 bursts with 14 sparks each', () => {
    const bursts = createFireworkBursts(createSeededRandom(3), STAGE);
    expect(bursts).toHaveLength(5);
    bursts.forEach(burst => expect(burst.sparks).toHaveLength(14));
  });

  it('schedules each spark to explode only after its rocket has ascended', () => {
    const bursts = createFireworkBursts(createSeededRandom(3), STAGE);
    bursts.forEach(burst => {
      burst.sparks.forEach(spark => {
        expect(spark.delay).toBeGreaterThan(burst.delay);
      });
    });
  });
});

describe('createSparkleStars', () => {
  it('creates 54 stars spread across the stage', () => {
    const stars = createSparkleStars(createSeededRandom(4), STAGE);
    expect(stars).toHaveLength(54);
    stars.forEach(star => {
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThanOrEqual(STAGE.height);
    });
  });
});

describe('createPaperReelStrands', () => {
  it('creates 16 strands launched from the left and right edges', () => {
    const strands = createPaperReelStrands(createSeededRandom(5), STAGE);
    expect(strands).toHaveLength(16);

    const leftStrands = strands.filter(strand => strand.start.x < 0);
    const rightStrands = strands.filter(strand => strand.start.x > STAGE.width);
    expect(leftStrands).toHaveLength(8);
    expect(rightStrands).toHaveLength(8);
  });

  it('bows the control point high above the stage, between the start and landing point horizontally', () => {
    const strands = createPaperReelStrands(createSeededRandom(6), STAGE);
    strands.forEach(strand => {
      expect(strand.control.y).toBeLessThan(0); // 화면 위로 솟는 아치
      const [minX, maxX] = [strand.start.x, strand.end.x].sort((a, b) => a - b);
      expect(strand.control.x).toBeGreaterThan(minX - STAGE.width * 0.1);
      expect(strand.control.x).toBeLessThan(maxX + STAGE.width * 0.1);
    });
  });

  it('reaches u=1 (fully unfurled) at settleAt, within the PAPER_REEL duration budget', () => {
    const strands = createPaperReelStrands(createSeededRandom(7), STAGE);
    strands.forEach(strand => {
      const rawU = (strand.v0 / strand.k) * (1 - Math.exp(-strand.k * strand.settleAt));
      expect(rawU).toBeCloseTo(1, 5);
      // launchDelay(<0.5s) + settleAt + 페이드아웃(0.6s)이 카탈로그 durationMs(5000ms)를 넘지 않아야 한다.
      expect(strand.launchDelay + strand.settleAt + 0.6).toBeLessThan(5);
    });
  });

  it('is deterministic for the same seed', () => {
    const a = createPaperReelStrands(createSeededRandom(42), STAGE);
    const b = createPaperReelStrands(createSeededRandom(42), STAGE);
    expect(a).toEqual(b);
  });
});
