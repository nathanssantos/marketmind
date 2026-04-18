import { describe, expect, it } from 'vitest';
import { calculateChecklistScore } from '../../indicators/score';

describe('calculateChecklistScore', () => {
  it('returns 100 when there are no conditions', () => {
    const res = calculateChecklistScore({
      requiredTotal: 0,
      requiredPassed: 0,
      preferredTotal: 0,
      preferredPassed: 0,
    });
    expect(res.score).toBe(100);
    expect(res.requiredAllPassed).toBe(true);
  });

  it('weights required 2x preferred', () => {
    const res = calculateChecklistScore({
      requiredTotal: 1,
      requiredPassed: 1,
      preferredTotal: 1,
      preferredPassed: 0,
    });
    expect(res.score).toBeCloseTo((2 / 3) * 100);
  });

  it('full pass yields 100', () => {
    const res = calculateChecklistScore({
      requiredTotal: 2,
      requiredPassed: 2,
      preferredTotal: 3,
      preferredPassed: 3,
    });
    expect(res.score).toBe(100);
    expect(res.requiredAllPassed).toBe(true);
  });

  it('full fail yields 0', () => {
    const res = calculateChecklistScore({
      requiredTotal: 2,
      requiredPassed: 0,
      preferredTotal: 1,
      preferredPassed: 0,
    });
    expect(res.score).toBe(0);
    expect(res.requiredAllPassed).toBe(false);
  });

  it('flags requiredAllPassed false when any required failed', () => {
    const res = calculateChecklistScore({
      requiredTotal: 3,
      requiredPassed: 2,
      preferredTotal: 0,
      preferredPassed: 0,
    });
    expect(res.requiredAllPassed).toBe(false);
  });
});
