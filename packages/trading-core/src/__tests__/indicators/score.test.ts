import { describe, expect, it } from 'vitest';
import { calculateChecklistScore } from '../../indicators/score';

const baseInput = {
  requiredTotal: 0,
  requiredPassed: 0,
  requiredWeightTotal: 0,
  requiredWeightPassed: 0,
  preferredTotal: 0,
  preferredPassed: 0,
  preferredWeightTotal: 0,
  preferredWeightPassed: 0,
};

describe('calculateChecklistScore', () => {
  it('returns 100 when there are no conditions', () => {
    const res = calculateChecklistScore(baseInput);
    expect(res.score).toBe(100);
    expect(res.requiredAllPassed).toBe(true);
  });

  it('weights required 2x preferred when all weights are equal', () => {
    const res = calculateChecklistScore({
      ...baseInput,
      requiredTotal: 1,
      requiredPassed: 1,
      requiredWeightTotal: 1,
      requiredWeightPassed: 1,
      preferredTotal: 1,
      preferredPassed: 0,
      preferredWeightTotal: 1,
      preferredWeightPassed: 0,
    });
    expect(res.score).toBeCloseTo((2 / 3) * 100);
  });

  it('full pass yields 100', () => {
    const res = calculateChecklistScore({
      ...baseInput,
      requiredTotal: 2,
      requiredPassed: 2,
      requiredWeightTotal: 2,
      requiredWeightPassed: 2,
      preferredTotal: 3,
      preferredPassed: 3,
      preferredWeightTotal: 3,
      preferredWeightPassed: 3,
    });
    expect(res.score).toBe(100);
    expect(res.requiredAllPassed).toBe(true);
  });

  it('full fail yields 0', () => {
    const res = calculateChecklistScore({
      ...baseInput,
      requiredTotal: 2,
      requiredPassed: 0,
      requiredWeightTotal: 2,
      requiredWeightPassed: 0,
      preferredTotal: 1,
      preferredPassed: 0,
      preferredWeightTotal: 1,
      preferredWeightPassed: 0,
    });
    expect(res.score).toBe(0);
    expect(res.requiredAllPassed).toBe(false);
  });

  it('flags requiredAllPassed false when any required failed', () => {
    const res = calculateChecklistScore({
      ...baseInput,
      requiredTotal: 3,
      requiredPassed: 2,
      requiredWeightTotal: 3,
      requiredWeightPassed: 2,
    });
    expect(res.requiredAllPassed).toBe(false);
  });

  it('higher-timeframe weights contribute more to the score', () => {
    // Preferred 15m (w=1) failed; preferred 4h (w=2) passed.
    // Both preferred, no required. Achieved = 2, total = 3 → 66.67%.
    const res = calculateChecklistScore({
      ...baseInput,
      preferredTotal: 2,
      preferredPassed: 1,
      preferredWeightTotal: 1 + 2,
      preferredWeightPassed: 2,
    });
    expect(res.score).toBeCloseTo((2 / 3) * 100);
  });

  it('required 4h (w=2) heavily outweighs preferred 15m (w=1)', () => {
    // 1 required w=2 passed + 1 preferred w=1 failed.
    // Achieved = 2*2=4; total = 2*2 + 1*1 = 5 → 80%.
    const res = calculateChecklistScore({
      ...baseInput,
      requiredTotal: 1,
      requiredPassed: 1,
      requiredWeightTotal: 2,
      requiredWeightPassed: 2,
      preferredTotal: 1,
      preferredPassed: 0,
      preferredWeightTotal: 1,
      preferredWeightPassed: 0,
    });
    expect(res.score).toBeCloseTo(80);
  });
});
