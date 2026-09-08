import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../../../utils/seededRandom';
import { createFlashPlan, createHighlightPlan, createPulsePlan, createRipplePlan } from './signatureEffectPhysics';

describe('createHighlightPlan', () => {
  it('produces positive timings and 4 distinct, increasing corner glint delays', () => {
    const plan = createHighlightPlan(createSeededRandom(1));
    expect(plan.traceTau).toBeGreaterThan(0);
    expect(plan.sheenDuration).toBeGreaterThan(0);
    expect(plan.cornerGlintDelays).toHaveLength(4);
    for (let i = 1; i < plan.cornerGlintDelays.length; i += 1) {
      expect(plan.cornerGlintDelays[i]).toBeGreaterThan(plan.cornerGlintDelays[i - 1]);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = createHighlightPlan(createSeededRandom(2));
    const b = createHighlightPlan(createSeededRandom(2));
    expect(a).toEqual(b);
  });
});

describe('createPulsePlan', () => {
  it('produces a positive oscillation frequency and damping ratio', () => {
    const plan = createPulsePlan(createSeededRandom(3));
    expect(plan.omega).toBeGreaterThan(0);
    expect(plan.zeta).toBeGreaterThan(0);
    expect(plan.zeta).toBeLessThan(1); // underdamped: 진동이 실제로 보여야 한다
  });
});

describe('createRipplePlan', () => {
  it('starts the first ring immediately and staggers the rest', () => {
    const plan = createRipplePlan(createSeededRandom(4));
    expect(plan.ringDelays[0]).toBe(0);
    expect(plan.ringDelays[1]).toBeGreaterThan(plan.ringDelays[0]);
    expect(plan.ringDelays[2]).toBeGreaterThan(plan.ringDelays[1]);
  });

  it('keeps ring scale jitter close to 1 (subtle variation only)', () => {
    const plan = createRipplePlan(createSeededRandom(5));
    plan.ringScales.forEach(scale => {
      expect(scale).toBeGreaterThan(0.9);
      expect(scale).toBeLessThan(1.1);
    });
  });
});

describe('createFlashPlan', () => {
  it('rises much faster than it decays (a sharp camera-flash attack, not a slow fade-in)', () => {
    const plan = createFlashPlan(createSeededRandom(6));
    expect(plan.riseTau).toBeGreaterThan(0);
    expect(plan.decayTau).toBeGreaterThan(0);
    expect(plan.riseTau).toBeLessThan(plan.decayTau / 5);
  });

  it('is deterministic for the same seed', () => {
    const a = createFlashPlan(createSeededRandom(7));
    const b = createFlashPlan(createSeededRandom(7));
    expect(a).toEqual(b);
  });
});
