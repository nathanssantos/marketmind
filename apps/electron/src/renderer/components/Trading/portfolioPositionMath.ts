import type { MarketType, PositionSide } from '@marketmind/types';
import type { PortfolioPosition } from './portfolioTypes';

/**
 * A trade-execution row as it lands in the React Query cache. Only the
 * fields this module actually reads are listed; the trpc shape carries
 * many additional columns we ignore. status is widened to `string | null`
 * to match what comes off the wire.
 */
export interface OpenExecutionInput {
  id: string;
  symbol: string;
  side: PositionSide;
  quantity: string | number;
  entryPrice: string | number;
  stopLoss?: string | number | null;
  takeProfit?: string | number | null;
  setupType?: string | null;
  openedAt: string | Date;
  status: string | null;
  marketType?: MarketType | null;
  leverage?: number | null;
  entryFee?: string | number | null;
}

const num = (v: string | number | null | undefined, fallback = 0): number => {
  if (v === null || v === undefined || v === '') return fallback;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Group open trade executions into one PortfolioPosition per (symbol, side)
 * pair. Within a group, compute a weighted-average entry price by quantity,
 * and aggregate the total quantity. Also computes mark-to-market PnL using
 * the supplied price source.
 *
 * Pricing precedence per group: centralizedPrice (live websocket store)
 * → tickerPrice (REST snapshot) → avgPrice (no live tick yet — PnL = 0).
 */
export const buildPortfolioPositions = (
  executions: OpenExecutionInput[],
  centralizedPrices: Record<string, number | undefined>,
  tickerPrices: Record<string, string | number | undefined>,
): PortfolioPosition[] => {
  const open = executions.filter((e) => e.status === 'open');
  const groups = new Map<string, OpenExecutionInput[]>();

  for (const e of open) {
    const key = `${e.symbol}-${e.side}`;
    const group = groups.get(key) ?? [];
    group.push(e);
    groups.set(key, group);
  }

  const out: PortfolioPosition[] = [];
  for (const group of groups.values()) {
    const primary = group[0];
    if (!primary) continue;

    const totalQty = group.reduce((sum, e) => sum + num(e.quantity), 0);
    const weightedNumerator = group.reduce((sum, e) => sum + num(e.entryPrice) * num(e.quantity), 0);
    const avgPrice = weightedNumerator / (totalQty || 1);
    const groupEntryFee = group.reduce((sum, e) => sum + num(e.entryFee), 0);

    const centralPrice = centralizedPrices[primary.symbol];
    const tickerPrice = tickerPrices[primary.symbol];
    const currentPrice =
      centralPrice ?? (tickerPrice !== undefined && tickerPrice !== null ? num(tickerPrice) : avgPrice);

    const pnl =
      primary.side === 'LONG'
        ? (currentPrice - avgPrice) * totalQty
        : (avgPrice - currentPrice) * totalQty;

    const leverage = primary.leverage ?? 1;
    const directionalPnlPct = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 * leverage : 0;
    const adjustedPnlPercent = primary.side === 'LONG' ? directionalPnlPct : -directionalPnlPct;

    out.push({
      id: primary.id,
      symbol: primary.symbol,
      side: primary.side,
      quantity: totalQty,
      avgPrice,
      currentPrice,
      pnl,
      pnlPercent: adjustedPnlPercent,
      stopLoss: primary.stopLoss !== null && primary.stopLoss !== undefined ? num(primary.stopLoss) : undefined,
      takeProfit:
        primary.takeProfit !== null && primary.takeProfit !== undefined ? num(primary.takeProfit) : undefined,
      setupType: primary.setupType ?? undefined,
      openedAt: new Date(primary.openedAt),
      status: 'open',
      marketType: primary.marketType ?? 'FUTURES',
      isAutoTrade: !!primary.setupType,
      count: group.length,
      leverage,
      entryFee: groupEntryFee,
    });
  }
  return out;
};

/**
 * Round-trip taker fees for a position at a hypothetical exit price.
 * Same logic as `computeTotalFees` for one position but parameterised on
 * the exit price (SL or TP). Uses real `entryFee` when present, falls
 * back to estimating both legs at `takerRate`.
 */
const positionFeesAtExit = (
  pos: PortfolioPosition,
  exitPrice: number,
  takerRate: number,
): number => {
  const entryNotional = pos.avgPrice * pos.quantity;
  const exitNotional = exitPrice * pos.quantity;
  const entryFee = pos.entryFee > 0 ? pos.entryFee : entryNotional * takerRate;
  const exitFee = exitNotional * takerRate;
  return entryFee + exitFee;
};

/**
 * Sum of NET P&L "locked in" by stop-loss orders across positions that have
 * a stop set: gross PnL at SL minus round-trip fees. Subtracting fees here
 * stops the panel from showing an unrealistic stop loss — the trader's real
 * downside if every stop fires is the gross PnL plus the fees they'll have
 * paid by then. Skips positions without a stop.
 */
export const computeStopProtectedPnl = (
  positions: PortfolioPosition[],
  takerRate: number,
): { total: number; positionsWithStops: number } => {
  let total = 0;
  let positionsWithStops = 0;
  for (const pos of positions) {
    if (!pos.stopLoss) continue;
    positionsWithStops += 1;
    const gross = pos.side === 'LONG'
      ? (pos.stopLoss - pos.avgPrice) * pos.quantity
      : (pos.avgPrice - pos.stopLoss) * pos.quantity;
    total += gross - positionFeesAtExit(pos, pos.stopLoss, takerRate);
  }
  return { total, positionsWithStops };
};

/**
 * Sum of NET projected profit if all positions with a take-profit hit their
 * TP — gross PnL at TP minus round-trip fees. Aligns the panel number with
 * the breakeven line semantics: "what would I actually walk away with."
 */
export const computeTpProjectedProfit = (
  positions: PortfolioPosition[],
  takerRate: number,
): { total: number; positionsWithTp: number } => {
  let total = 0;
  let positionsWithTp = 0;
  for (const pos of positions) {
    if (!pos.takeProfit) continue;
    positionsWithTp += 1;
    const gross = pos.side === 'LONG'
      ? (pos.takeProfit - pos.avgPrice) * pos.quantity
      : (pos.avgPrice - pos.takeProfit) * pos.quantity;
    total += gross - positionFeesAtExit(pos, pos.takeProfit, takerRate);
  }
  return { total, positionsWithTp };
};

/** Total notional exposure (avgPrice × quantity, unleveraged). */
export const computeTotalExposure = (positions: PortfolioPosition[]): number =>
  positions.reduce((sum, pos) => sum + pos.avgPrice * pos.quantity, 0);

/** Total margin used (notional / leverage). */
export const computeTotalMargin = (positions: PortfolioPosition[]): number =>
  positions.reduce((sum, pos) => sum + (pos.avgPrice * pos.quantity) / (pos.leverage || 1), 0);

/** True if any position has leverage > 1. */
export const hasLeveragedPosition = (positions: PortfolioPosition[]): boolean =>
  positions.some((pos) => pos.leverage > 1);

/**
 * Estimated round-trip fees across all positions. Always counts both
 * sides so the number aligns with the breakeven line (which assumes
 * round-trip taker fees in its math):
 *   - entry side: real `entryFee` from the trade-execution row when
 *     populated; otherwise estimated from `avgPrice × qty × takerRate`.
 *     Falling back avoids the case where a paper trade or a not-yet-
 *     synced live trade has `entryFee = 0` and the panel would show
 *     only the exit side.
 *   - exit side: always estimated from `currentPrice × qty × takerRate`
 *     (most exits are MARKET orders → taker).
 */
export const computeTotalFees = (
  positions: PortfolioPosition[],
  takerRate: number,
): number => {
  let total = 0;
  for (const pos of positions) {
    const entryNotional = pos.avgPrice * pos.quantity;
    const exitNotional = pos.currentPrice * pos.quantity;
    const entryFee = pos.entryFee > 0 ? pos.entryFee : entryNotional * takerRate;
    const estimatedExitFee = exitNotional * takerRate;
    total += entryFee + estimatedExitFee;
  }
  return total;
};

/**
 * Effective capital for performance calculations:
 *   initialBalance + totalDeposits - totalWithdrawals
 * Returns 0 if any input is missing.
 */
export const computeEffectiveCapital = (wallet: {
  initialBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
} | null | undefined): number => {
  if (!wallet) return 0;
  return wallet.initialBalance + wallet.totalDeposits - wallet.totalWithdrawals;
};
