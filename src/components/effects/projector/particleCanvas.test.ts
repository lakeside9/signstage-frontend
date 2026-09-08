import { describe, expect, it } from 'vitest';
import {
  dampedOscillation,
  edgeFade,
  expDecay,
  expRise,
  measureStage,
  stepFlutterParticle,
  stepGlowSpark,
  type FlutterParticle,
  type GlowSpark,
} from './particleCanvas';

const baseFlutterParticle = (): FlutterParticle => ({
  x: 0,
  y: 0,
  vx: 10,
  vy: 0,
  gravity: 100,
  drag: 0,
  rotation: 0,
  angularVelocity: 2,
  flutterFreq: 1,
  flutterPhase: 0,
  color: '#fff',
  width: 1,
  height: 1,
  delay: 0,
});

describe('stepFlutterParticle', () => {
  it('accelerates downward under gravity with no drag', () => {
    const particle = baseFlutterParticle();
    stepFlutterParticle(particle, 1);
    expect(particle.vy).toBe(100);
    expect(particle.y).toBe(100);
  });

  it('decays horizontal velocity proportionally to drag', () => {
    const particle = { ...baseFlutterParticle(), drag: 0.5 };
    stepFlutterParticle(particle, 1);
    expect(particle.vx).toBe(5);
    expect(particle.x).toBe(5);
  });

  it('advances rotation by angularVelocity * dt', () => {
    const particle = baseFlutterParticle();
    stepFlutterParticle(particle, 0.5);
    expect(particle.rotation).toBe(1);
  });

  it('approaches terminal velocity (gravity / drag) instead of accelerating forever', () => {
    // dv/dt = g - drag*v 의 해석해는 v(t) = (g/drag)(1 - e^(-drag*t)).
    // t=10s, drag=1이면 e^-10 ≈ 4.5e-5로 사실상 종단속도(200)에 수렴한다.
    const particle = { ...baseFlutterParticle(), gravity: 200, drag: 1 };
    for (let i = 0; i < 1000; i += 1) stepFlutterParticle(particle, 0.01);
    expect(particle.vy).toBeCloseTo(200, 1);
  });
});

describe('stepGlowSpark', () => {
  const baseSpark = (): GlowSpark => ({ x: 0, y: 0, vx: 10, vy: -10, gravity: 20, drag: 0, color: '#fff', length: 10, delay: 0 });

  it('integrates position from velocity', () => {
    const spark = baseSpark();
    stepGlowSpark(spark, 1);
    expect(spark.x).toBe(10);
  });

  it('gravity pulls the spark downward over time', () => {
    const spark = baseSpark();
    stepGlowSpark(spark, 1);
    expect(spark.vy).toBe(10); // -10 + 20*1
  });
});

describe('edgeFade', () => {
  it('is zero at both edges of the span', () => {
    expect(edgeFade(0, 10, 2)).toBe(0);
    expect(edgeFade(10, 10, 2)).toBe(0);
  });

  it('is 1 well within the span', () => {
    expect(edgeFade(5, 10, 2)).toBe(1);
  });

  it('ramps linearly inside the fade zone', () => {
    expect(edgeFade(1, 10, 2)).toBe(0.5);
    expect(edgeFade(9, 10, 2)).toBe(0.5);
  });
});

describe('expRise', () => {
  it('starts at 0 and asymptotically approaches 1', () => {
    expect(expRise(0, 1)).toBe(0);
    expect(expRise(5, 1)).toBeGreaterThan(0.99);
  });
});

describe('expDecay', () => {
  it('starts at 1 and asymptotically approaches 0', () => {
    expect(expDecay(0, 1)).toBe(1);
    expect(expDecay(5, 1)).toBeLessThan(0.01);
  });
});

describe('dampedOscillation', () => {
  it('starts at 0 and eventually settles near 0 as it decays', () => {
    expect(dampedOscillation(0, 10, 0.3)).toBe(0);
    expect(Math.abs(dampedOscillation(5, 10, 0.3))).toBeLessThan(0.01);
  });

  it('oscillates through both positive and negative lobes when lightly damped', () => {
    const samples = Array.from({ length: 200 }, (_, i) => dampedOscillation(i * 0.02, 10, 0.1));
    expect(samples.some(v => v > 0.1)).toBe(true);
    expect(samples.some(v => v < -0.1)).toBe(true);
  });
});

describe('measureStage', () => {
  it('uses the portal target element size when provided', () => {
    const portalTarget = { clientWidth: 480, clientHeight: 270 } as HTMLElement;
    expect(measureStage(portalTarget)).toEqual({ width: 480, height: 270 });
  });

  it('falls back to the viewport size when no portal target is given', () => {
    const size = measureStage(undefined);
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
  });
});
