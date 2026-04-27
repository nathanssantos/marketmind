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
    });
  }
  return out;
};

/**
 * Sum of how much PnL is "locked in" by stop-loss orders across positions
 * that have a stop set. Negative when stops are below entry (long) / above
 * entry (short). Skips positions without a stop.
 */
export const computeStopProtectedPnl = (
  positions: PortfolioPosition[],
): { total: number; positionsWithStops: number } => {
  let total = 0;
  let positionsWithStops = 0;
  for (const pos of positions) {
    if (!pos.stopLoss) continue;
    positionsWithStops += 1;
    if (pos.side === 'LONG') total += (pos.stopLoss - pos.avgPrice) * pos.quantity;
    else total += (pos.avgPrice - pos.stopLoss) * pos.quantity;
  }
  return { total, positionsWithStops };
};

/**
 * Sum of profit if all positions with a take-profit hit their TP. Skips
 * positions without a TP.
 */
export const computeTpProjectedProfit = (
  positions: PortfolioPosition[],
): { total: number; positionsWithTp: number } => {
  let total = 0;
  let positionsWithTp = 0;
  for (const pos of positions) {
    if (!pos.takeProfit) continue;
    positionsWithTp += 1;
    if (pos.side === 'LONG') total += (pos.takeProfit - pos.avgPrice) * pos.quantity;
    else total += (pos.avgPrice - pos.takeProfit) * pos.quantity;
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
