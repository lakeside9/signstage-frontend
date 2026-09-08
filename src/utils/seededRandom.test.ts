import { describe, expect, it } from 'vitest';
import { createSeededRandom, gaussianRandom, hashStringToSeed, randomPick, randomRange } from './seededRandom';

describe('seededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    const sequenceA = Array.from({ length: 5 }, () => a());
    const sequenceB = Array.from({ length: 5 }, () => b());
    expect(sequenceA).toEqual(sequenceB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);
    expect(a()).not.toBe(b());
  });

  it('stays within [0, 1)', () => {
    const rng = createSeededRandom(7);
    for (let i = 0; i < 200; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('hashes the same string to the same seed', () => {
    expect(hashStringToSeed('AUTO-10')).toBe(hashStringToSeed('AUTO-10'));
    expect(hashStringToSeed('AUTO-10')).not.toBe(hashStringToSeed('AUTO-11'));
  });

  it('randomRange respects bounds', () => {
    const rng = createSeededRandom(3);
    for (let i = 0; i < 100; i += 1) {
      const value = randomRange(rng, -10, 10);
      expect(value).toBeGreaterThanOrEqual(-10);
      expect(value).toBeLessThan(10);
    }
  });

  it('randomPick always returns an element of the input array', () => {
    const rng = createSeededRandom(9);
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 50; i += 1) {
      expect(items).toContain(randomPick(rng, items));
    }
  });

  it('gaussianRandom is finite and roughly centered near the mean over many samples', () => {
    const rng = createSeededRandom(11);
    const samples = Array.from({ length: 2000 }, () => gaussianRandom(rng, 5, 1));
    samples.forEach(value => expect(Number.isFinite(value)).toBe(true));
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    expect(mean).toBeCloseTo(5, 0);
  });
});
