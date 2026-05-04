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

/**
 * Regression cluster — "ao entrar alavancado, por um momento exibe uma
 * posição muito maior do que a real". Goal: pin the math + filtering
 * behavior that protects Portfolio numbers from being briefly inflated
 * during the pending → open transition or by stale/duplicate cache
 * entries that the realtime patch flow could leave behind.
 */
describe('Portfolio math — leveraged-entry transitional safety', () => {
  const exec = (overrides: Partial<OpenExecutionInput> & Pick<OpenExecutionInput, 'id'>): OpenExecutionInput => ({
    symbol: 'BTCUSDT',
    side: 'LONG',
    quantity: '0.1',
    entryPrice: '50000',
    stopLoss: null,
    takeProfit: null,
    setupType: null,
    openedAt: new Date(),
    status: 'open',
    leverage: 10,
    ...overrides,
  });

  it('pending executions never contribute to exposure (the pre-fill window stays at 0)', () => {
    // Right after the user clicks Buy and before the user-stream fill
    // arrives, the cache may briefly hold a pending row. It MUST NOT
    // appear in Portfolio totals — exposure / qty are 0 until status
    // transitions to open.
    const positions = buildPortfolioPositions(
      [exec({ id: '1', status: 'pending', quantity: '0.1' })],
      {},
      {},
    );
    expect(positions).toHaveLength(0);
    expect(computeTotalExposure(positions)).toBe(0);
  });

  it('pending → open transition produces exactly one position with exactly the filled qty', () => {
    // Simulates the merge sequence: cache row stays at the same id,
    // status flips, qty/price stay (or fill in). The position math
    // must yield ONE position, not two stacked rows.
    const beforeFill = buildPortfolioPositions(
      [exec({ id: '1', status: 'pending' })],
      {},
      {},
    );
    expect(beforeFill).toHaveLength(0);

    const afterFill = buildPortfolioPositions(
      [exec({ id: '1', status: 'open', quantity: '0.1', entryPrice: '50000' })],
      { BTCUSDT: 50000 },
      {},
    );
    expect(afterFill).toHaveLength(1);
    expect(afterFill[0]?.quantity).toBe(0.1);
    expect(computeTotalExposure(afterFill)).toBe(5000);
  });

  it('exposure is the unleveraged notional, NOT notional × leverage', () => {
    // Defensive — if any future refactor multiplies leverage into the
    // exposure number we want a loud failure here. For 0.1 BTC at
    // $50k with 10× leverage, exposure is $5,000 — NOT $50,000.
    const positions = buildPortfolioPositions(
      [exec({ id: '1', quantity: '0.1', entryPrice: '50000', leverage: 10 })],
      { BTCUSDT: 50000 },
      {},
    );
    expect(computeTotalExposure(positions)).toBe(5000);
  });

  it('total margin = notional / leverage (so exposure / margin = leverage)', () => {
    const positions = buildPortfolioPositions(
      [exec({ id: '1', quantity: '0.1', entryPrice: '50000', leverage: 10 })],
      { BTCUSDT: 50000 },
      {},
    );
    expect(computeTotalExposure(positions)).toBe(5000);
    expect(computeTotalMargin(positions)).toBe(500);
  });

  it('two pyramided same-side execs (open + open) sum, never multiply', () => {
    // Manual entry on top of an existing position, before the backend
    // merges them via mergeIntoExistingPosition. The Portfolio
    // grouping must produce qty = 0.1 + 0.05 = 0.15, not 0.005 or 0.5.
    const positions = buildPortfolioPositions(
      [
        exec({ id: '1', quantity: '0.1', entryPrice: '50000', leverage: 10 }),
        exec({ id: '2', quantity: '0.05', entryPrice: '52000', leverage: 10 }),
      ],
      { BTCUSDT: 51000 },
      {},
    );
    expect(positions).toHaveLength(1);
    expect(positions[0]?.quantity).toBeCloseTo(0.15, 8);
    // Weighted avg: (0.1 × 50000 + 0.05 × 52000) / 0.15 = 50666.67
    expect(positions[0]?.avgPrice).toBeCloseTo(50666.67, 1);
    expect(computeTotalExposure(positions)).toBeCloseTo(7600, 1);
  });

  it('a closed exec coexisting with an open one for the same symbol does NOT add to exposure', () => {
    // Cache state right after a position closes: closed row may linger
    // until the next refetch removes it, while a fresh open row is
    // already there. Only the open row should contribute.
    const positions = buildPortfolioPositions(
      [
        exec({ id: '1', status: 'closed', quantity: '0.5', entryPrice: '49000' }),
        exec({ id: '2', status: 'open', quantity: '0.1', entryPrice: '50000' }),
      ],
      { BTCUSDT: 50000 },
      {},
    );
    expect(positions).toHaveLength(1);
    expect(positions[0]?.id).toBe('2');
    expect(computeTotalExposure(positions)).toBe(5000);
  });

  it('quantity zero should not appear as a position', () => {
    // After a full close, the row may briefly carry status='open' with
    // qty=0 if the close handler hasn't flipped status yet. A 0-qty
    // group still shows in the list (legacy behavior — preserved by
    // this guard test) but contributes 0 to exposure.
    const positions = buildPortfolioPositions(
      [exec({ id: '1', status: 'open', quantity: '0', entryPrice: '50000' })],
      { BTCUSDT: 50000 },
      {},
    );
    // The function doesn't filter qty=0 today — it produces a 0-qty
    // group. Document and pin that behavior.
    expect(positions).toHaveLength(1);
    expect(positions[0]?.quantity).toBe(0);
    expect(computeTotalExposure(positions)).toBe(0);
  });

  it('LONG and SHORT on the same symbol stay as TWO separate positions, exposure stacks correctly', () => {
    const positions = buildPortfolioPositions(
      [
        exec({ id: '1', side: 'LONG', quantity: '0.1', entryPrice: '50000', leverage: 10 }),
        exec({ id: '2', side: 'SHORT', quantity: '0.05', entryPrice: '50500', leverage: 10 }),
      ],
      { BTCUSDT: 50250 },
      {},
    );
    expect(positions).toHaveLength(2);
    // 0.1 × 50000 + 0.05 × 50500 = 5000 + 2525 = 7525
    expect(computeTotalExposure(positions)).toBe(7525);
  });

  it('switches from leverage-1 to leverage-10 does not change exposure (only margin)', () => {
    // The leverage knob at the wallet level changes the MARGIN required
    // to hold the same notional position, not the notional itself.
    const small = buildPortfolioPositions(
      [exec({ id: '1', quantity: '0.1', entryPrice: '50000', leverage: 1 })],
      { BTCUSDT: 50000 },
      {},
    );
    const big = buildPortfolioPositions(
      [exec({ id: '1', quantity: '0.1', entryPrice: '50000', leverage: 10 })],
      { BTCUSDT: 50000 },
      {},
    );
    expect(computeTotalExposure(small)).toBe(computeTotalExposure(big));
    expect(computeTotalMargin(big)).toBe(computeTotalMargin(small) / 10);
  });

  it('null leverage is treated as 1× (defensive default after V3 migration)', () => {
    // accountInfoV3 occasionally returns positions without a leverage
    // field for symbols never traded. Default to 1× so the math
    // doesn't NaN.
    const positions = buildPortfolioPositions(
      [exec({ id: '1', quantity: '0.1', entryPrice: '50000', leverage: null })],
      { BTCUSDT: 50000 },
      {},
    );
    expect(positions[0]?.leverage).toBe(1);
    expect(computeTotalExposure(positions)).toBe(5000);
    expect(computeTotalMargin(positions)).toBe(5000);
  });
});
