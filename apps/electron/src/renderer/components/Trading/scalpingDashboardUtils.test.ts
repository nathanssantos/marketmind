import { describe, expect, it } from 'vitest';
import { formatScalpingPnl, scalpingPnlColor } from './scalpingDashboardUtils';

describe('formatScalpingPnl', () => {
  it('positive values get a leading + sign', () => {
    expect(formatScalpingPnl(12.34)).toBe('+$12.34');
    expect(formatScalpingPnl(0.5)).toBe('+$0.50');
  });

  it('zero is treated as non-negative (gets leading +)', () => {
    expect(formatScalpingPnl(0)).toBe('+$0.00');
  });

  it('negative values produce "$-X.XX" (sign stays inside the dollar prefix — current production format)', () => {
    expect(formatScalpingPnl(-7.5)).toBe('$-7.50');
  });

  it('always 2 decimals', () => {
    expect(formatScalpingPnl(1)).toBe('+$1.00');
    expect(formatScalpingPnl(1.234)).toBe('+$1.23');
    expect(formatScalpingPnl(1.235)).toBe('+$1.24');
  });
});

describe('scalpingPnlColor', () => {
  it('positive → fg.success', () => {
    expect(scalpingPnlColor(0.01)).toBe('fg.success');
    expect(scalpingPnlColor(100)).toBe('fg.success');
  });

  it('negative → fg.error', () => {
    expect(scalpingPnlColor(-0.01)).toBe('fg.error');
    expect(scalpingPnlColor(-100)).toBe('fg.error');
  });

  it('exactly zero → fg.default (not green — fresh-session neutrality)', () => {
    expect(scalpingPnlColor(0)).toBe('fg.default');
  });
});
