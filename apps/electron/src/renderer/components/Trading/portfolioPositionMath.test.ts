import { describe, expect, it } from 'vitest';
import {
  buildPortfolioPositions,
  computeEffectiveCapital,
  computeStopProtectedPnl,
  computeTotalExposure,
  computeTotalMargin,
  computeTpProjectedProfit,
  hasLeveragedPosition,
  type OpenExecutionInput,
} from './portfolioPositionMath';
import type { PortfolioPosition } from './portfolioTypes';

const exec = (overrides: Partial<OpenExecutionInput> = {}): OpenExecutionInput => ({
  id: overrides.id ?? `e-${Math.random().toString(36).slice(2, 8)}`,
  symbol: 'BTCUSDT',
  side: 'LONG',
  quantity: '1',
  entryPrice: '50000',
  openedAt: '2026-04-26T10:00:00Z',
  status: 'open',
  marketType: 'FUTURES',
  leverage: 1,
  ...overrides,
});

describe('buildPortfolioPositions — grouping + weighted average', () => {
  it('groups two LONG executions on the same symbol into one position with weighted-avg entry', () => {
    const out = buildPortfolioPositions(
      [
        exec({ symbol: 'BTCUSDT', side: 'LONG', quantity: '1', entryPrice: '50000' }),
        exec({ symbol: 'BTCUSDT', side: 'LONG', quantity: '3', entryPrice: '40000' }),
      ],
      { BTCUSDT: 50_000 },
      {},
    );
    expect(out).toHaveLength(1);
    // Weighted avg: (1×50000 + 3×40000) / 4 = 170000/4 = 42500
    expect(out[0]?.avgPrice).toBe(42_500);
    expect(out[0]?.quantity).toBe(4);
    expect(out[0]?.count).toBe(2);
  });

  it('LONG and SHORT on the same symbol stay as TWO positions', () => {
    const out = buildPortfolioPositions(
      [
        exec({ symbol: 'BTCUSDT', side: 'LONG', quantity: '1' }),
        exec({ symbol: 'BTCUSDT', side: 'SHORT', quantity: '1' }),
      ],
      { BTCUSDT: 50_000 },
      {},
    );
    expect(out).toHaveLength(2);
  });

  it('different symbols stay as separate positions', () => {
    const out = buildPortfolioPositions(
      [
        exec({ symbol: 'BTCUSDT', side: 'LONG' }),
        exec({ symbol: 'ETHUSDT', side: 'LONG' }),
      ],
      {},
      {},
    );
    expect(out).toHaveLength(2);
    expect(new Set(out.map((p) => p.symbol))).toEqual(new Set(['BTCUSDT', 'ETHUSDT']));
  });

  it('skips closed/pending executions', () => {
    const out = buildPortfolioPositions(
      [
        exec({ id: 'a', status: 'open' }),
        exec({ id: 'b', status: 'closed' }),
        exec({ id: 'c', status: 'pending' }),
      ],
      {},
      {},
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('a');
  });

  it('returns empty array when no executions are open', () => {
    expect(buildPortfolioPositions([exec({ status: 'closed' })], {}, {})).toEqual([]);
    expect(buildPortfolioPositions([], {}, {})).toEqual([]);
  });
});

describe('buildPortfolioPositions — pricing precedence', () => {
  it('centralizedPrice (live ws) wins over tickerPrice (REST)', () => {
    const out = buildPortfolioPositions(
      [exec({ symbol: 'BTCUSDT', entryPrice: '40000', quantity: '1', side: 'LONG' })],
      { BTCUSDT: 50_000 },
      { BTCUSDT: '45000' },
    );
    expect(out[0]?.currentPrice).toBe(50_000);
    expect(out[0]?.pnl).toBe(10_000);
  });

  it('tickerPrice (REST) wins when no centralizedPrice', () => {
    const out = buildPortfolioPositions(
      [exec({ entryPrice: '40000', quantity: '1', side: 'LONG' })],
      {},
      { BTCUSDT: '45000' },
    );
    expect(out[0]?.currentPrice).toBe(45_000);
    expect(out[0]?.pnl).toBe(5_000);
  });

  it('falls back to avgPrice when neither price source has the symbol (PnL = 0)', () => {
    const out = buildPortfolioPositions(
      [exec({ entryPrice: '40000', quantity: '1', side: 'LONG' })],
      {},
      {},
    );
    expect(out[0]?.currentPrice).toBe(40_000);
    expect(out[0]?.pnl).toBe(0);
  });

  it('parses a stringy ticker price', () => {
    const out = buildPortfolioPositions(
      [exec({ entryPrice: '40000', quantity: '1', side: 'LONG' })],
      {},
      { BTCUSDT: '45000.50' },
    );
    expect(out[0]?.currentPrice).toBe(45_000.5);
  });
});

describe('buildPortfolioPositions — PnL math', () => {
  it('LONG profitable: (current - avg) * qty', () => {
    const out = buildPortfolioPositions(
      [exec({ side: 'LONG', entryPrice: '40000', quantity: '2' })],
      { BTCUSDT: 45_000 },
      {},
    );
    expect(out[0]?.pnl).toBe(10_000); // (45000-40000) × 2
  });

  it('LONG losing: negative pnl', () => {
    const out = buildPortfolioPositions(
      [exec({ side: 'LONG', entryPrice: '50000', quantity: '1' })],
      { BTCUSDT: 45_000 },
      {},
    );
    expect(out[0]?.pnl).toBe(-5_000);
  });

  it('SHORT profitable when price drops: (avg - current) * qty', () => {
    const out = buildPortfolioPositions(
      [exec({ side: 'SHORT', entryPrice: '50000', quantity: '1' })],
      { BTCUSDT: 45_000 },
      {},
    );
    expect(out[0]?.pnl).toBe(5_000);
  });

  it('SHORT losing when price rises: negative pnl', () => {
    const out = buildPortfolioPositions(
      [exec({ side: 'SHORT', entryPrice: '50000', quantity: '1' })],
      { BTCUSDT: 55_000 },
      {},
    );
    expect(out[0]?.pnl).toBe(-5_000);
  });
});

describe('buildPortfolioPositions — pnlPercent (leverage-aware + side-aware)', () => {
  it('LONG with 1× leverage: directional pct as-is', () => {
    const out = buildPortfolioPositions(
      [exec({ side: 'LONG', entryPrice: '100', quantity: '1', leverage: 1 })],
      { BTCUSDT: 110 },
      {},
    );
    expect(out[0]?.pnlPercent).toBeCloseTo(10, 5);
  });

  it('LONG with 5× leverage: 10% notional move = 50% return', () => {
    const out = buildPortfolioPositions(
      [exec({ side: 'LONG', entryPrice: '100', quantity: '1', leverage: 5 })],
      { BTCUSDT: 110 },
      {},
    );
    expect(out[0]?.pnlPercent).toBeCloseTo(50, 5);
  });

  it('SHORT inverts the sign so a price DROP shows positive pct', () => {
    const out = buildPortfolioPositions(
      [exec({ side: 'SHORT', entryPrice: '100', quantity: '1', leverage: 1 })],
      { BTCUSDT: 90 },
      {},
    );
    expect(out[0]?.pnlPercent).toBeCloseTo(10, 5);
  });

  it('SHORT 5× with a 10% adverse move: -50% return', () => {
    const out = buildPortfolioPositions(
      [exec({ side: 'SHORT', entryPrice: '100', quantity: '1', leverage: 5 })],
      { BTCUSDT: 110 },
      {},
    );
    expect(out[0]?.pnlPercent).toBeCloseTo(-50, 5);
  });

  it('returns 0 when avgPrice is 0 (no division by zero)', () => {
    const out = buildPortfolioPositions(
      [exec({ side: 'LONG', entryPrice: '0', quantity: '1' })],
      { BTCUSDT: 50_000 },
      {},
    );
    expect(out[0]?.pnlPercent).toBe(0);
  });
});

describe('buildPortfolioPositions — passthrough fields', () => {
  it('parses stopLoss/takeProfit from string and passes other fields through', () => {
    const out = buildPortfolioPositions(
      [
        exec({
          id: 'p-1',
          symbol: 'ETHUSDT',
          side: 'LONG',
          stopLoss: '2900',
          takeProfit: '3300',
          setupType: 'breakout-retest',
          marketType: 'SPOT',
          leverage: 3,
          openedAt: '2026-04-26T08:00:00Z',
        }),
      ],
      { ETHUSDT: 3_100 },
      {},
    );
    const p = out[0]!;
    expect(p.id).toBe('p-1');
    expect(p.stopLoss).toBe(2_900);
    expect(p.takeProfit).toBe(3_300);
    expect(p.setupType).toBe('breakout-retest');
    expect(p.marketType).toBe('SPOT');
    expect(p.leverage).toBe(3);
    expect(p.isAutoTrade).toBe(true);
    expect(p.openedAt).toEqual(new Date('2026-04-26T08:00:00Z'));
  });

  it('isAutoTrade is false when setupType is null/undefined', () => {
    const out = buildPortfolioPositions(
      [exec({ setupType: null })],
      {},
      {},
    );
    expect(out[0]?.isAutoTrade).toBe(false);
  });

  it('marketType defaults to FUTURES when missing', () => {
    const out = buildPortfolioPositions(
      [exec({ marketType: undefined })],
      {},
      {},
    );
    expect(out[0]?.marketType).toBe('FUTURES');
  });

  it('leverage defaults to 1 when missing', () => {
    const out = buildPortfolioPositions(
      [exec({ leverage: null })],
      {},
      {},
    );
    expect(out[0]?.leverage).toBe(1);
  });
});

describe('computeStopProtectedPnl', () => {
  const pos = (overrides: Partial<PortfolioPosition>): PortfolioPosition => ({
    id: overrides.id ?? 'p',
    symbol: 'BTCUSDT',
    side: 'LONG',
    quantity: 1,
    avgPrice: 50_000,
    currentPrice: 50_000,
    pnl: 0,
    pnlPercent: 0,
    openedAt: new Date(),
    status: 'open',
    count: 1,
    leverage: 1,
    marketType: 'FUTURES',
    ...overrides,
  });

  it('LONG with stop below entry: negative locked-in PnL (acceptable loss)', () => {
    const out = computeStopProtectedPnl([
      pos({ side: 'LONG', avgPrice: 100, quantity: 1, stopLoss: 95 }),
    ]);
    expect(out.total).toBe(-5);
    expect(out.positionsWithStops).toBe(1);
  });

  it('LONG with stop above entry (trailing): positive locked-in PnL', () => {
    const out = computeStopProtectedPnl([
      pos({ side: 'LONG', avgPrice: 100, quantity: 1, stopLoss: 110 }),
    ]);
    expect(out.total).toBe(10);
    expect(out.positionsWithStops).toBe(1);
  });

  it('SHORT with stop above entry: negative locked-in PnL', () => {
    const out = computeStopProtectedPnl([
      pos({ side: 'SHORT', avgPrice: 100, quantity: 1, stopLoss: 105 }),
    ]);
    expect(out.total).toBe(-5);
  });

  it('skips positions without a stop', () => {
    const out = computeStopProtectedPnl([
      pos({ side: 'LONG', stopLoss: 95 }),
      pos({ side: 'LONG' }),
    ]);
    expect(out.positionsWithStops).toBe(1);
  });

  it('empty portfolio returns zero / zero', () => {
    expect(computeStopProtectedPnl([])).toEqual({ total: 0, positionsWithStops: 0 });
  });
});

describe('computeTpProjectedProfit', () => {
  const pos = (overrides: Partial<PortfolioPosition>): PortfolioPosition => ({
    id: 'p',
    symbol: 'BTCUSDT',
    side: 'LONG',
    quantity: 1,
    avgPrice: 100,
    currentPrice: 100,
    pnl: 0,
    pnlPercent: 0,
    openedAt: new Date(),
    status: 'open',
    count: 1,
    leverage: 1,
    marketType: 'FUTURES',
    ...overrides,
  });

  it('LONG: (tp - avg) × qty', () => {
    expect(
      computeTpProjectedProfit([pos({ side: 'LONG', takeProfit: 110 })]).total,
    ).toBe(10);
  });

  it('SHORT: (avg - tp) × qty', () => {
    expect(
      computeTpProjectedProfit([pos({ side: 'SHORT', takeProfit: 90 })]).total,
    ).toBe(10);
  });

  it('counts only positions with a TP set', () => {
    const out = computeTpProjectedProfit([
      pos({ takeProfit: 110 }),
      pos(),
      pos({ takeProfit: 120 }),
    ]);
    expect(out.positionsWithTp).toBe(2);
    expect(out.total).toBe(30);
  });
});

describe('computeTotalExposure / computeTotalMargin / hasLeveragedPosition', () => {
  const pos = (overrides: Partial<PortfolioPosition>): PortfolioPosition => ({
    id: 'p',
    symbol: 'BTCUSDT',
    side: 'LONG',
    quantity: 1,
    avgPrice: 100,
    currentPrice: 100,
    pnl: 0,
    pnlPercent: 0,
    openedAt: new Date(),
    status: 'open',
    count: 1,
    leverage: 1,
    marketType: 'FUTURES',
    ...overrides,
  });

  it('totalExposure sums avgPrice × quantity (no leverage adjustment)', () => {
    expect(
      computeTotalExposure([
        pos({ avgPrice: 100, quantity: 2, leverage: 5 }),
        pos({ avgPrice: 50, quantity: 4, leverage: 1 }),
      ]),
    ).toBe(400);
  });

  it('totalMargin divides notional by leverage', () => {
    expect(
      computeTotalMargin([
        pos({ avgPrice: 100, quantity: 2, leverage: 5 }), // 200 / 5 = 40
        pos({ avgPrice: 50, quantity: 4, leverage: 1 }), // 200 / 1 = 200
      ]),
    ).toBe(240);
  });

  it('hasLeveragedPosition: true when any position has leverage > 1', () => {
    expect(hasLeveragedPosition([pos({ leverage: 1 }), pos({ leverage: 3 })])).toBe(true);
    expect(hasLeveragedPosition([pos({ leverage: 1 }), pos({ leverage: 1 })])).toBe(false);
    expect(hasLeveragedPosition([])).toBe(false);
  });
});

describe('computeEffectiveCapital', () => {
  it('initialBalance + deposits - withdrawals', () => {
    expect(
      computeEffectiveCapital({ initialBalance: 1000, totalDeposits: 500, totalWithdrawals: 200 }),
    ).toBe(1300);
  });

  it('returns 0 for null/undefined wallet', () => {
    expect(computeEffectiveCapital(null)).toBe(0);
    expect(computeEffectiveCapital(undefined)).toBe(0);
  });

  it('handles zero values', () => {
    expect(computeEffectiveCapital({ initialBalance: 0, totalDeposits: 0, totalWithdrawals: 0 })).toBe(0);
  });
});
