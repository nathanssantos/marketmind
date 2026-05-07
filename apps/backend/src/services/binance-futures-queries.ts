import type { PositionSide } from '@marketmind/types';
import type { USDMClient } from 'binance';
import type {
    AccountTradeRecord,
    AllTradeFeesResult,
    IncomeHistoryRecord,
} from '../exchange/futures-client';
import { guardBinanceCall } from './binance-api-cache';
import { logger, serializeError } from './logger';

export async function getSymbolLeverageBrackets(
  client: USDMClient,
  symbol: string
): Promise<{ bracket: number; initialLeverage: number; notionalCap: number; notionalFloor: number; maintMarginRatio: number; cum: number }[]> {
  try {
    const brackets = await guardBinanceCall(() => client.getNotionalAndLeverageBrackets({ symbol }));
    const symbolBrackets = brackets.find((b) => b.symbol === symbol);
    if (!symbolBrackets) return [];

    return symbolBrackets.brackets.map((b) => ({
      bracket: b.bracket,
      initialLeverage: b.initialLeverage,
      notionalCap: b.notionalCap,
      notionalFloor: b.notionalFloor,
      maintMarginRatio: b.maintMarginRatio,
      cum: b.cum,
    }));
  } catch (error) {
    logger.error({ error: serializeError(error), symbol }, 'Failed to get leverage brackets');
    throw error;
  }
}

export async function getIncomeHistory(
  client: USDMClient,
  params?: {
    symbol?: string;
    incomeType?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }
): Promise<IncomeHistoryRecord[]> {
  try {
    const result = await guardBinanceCall(() => client.getIncomeHistory(params as Parameters<typeof client.getIncomeHistory>[0]));

    return result.map((r) => ({
      symbol: r.symbol,
      incomeType: r.incomeType,
      income: r.income,
      asset: r.asset,
      time: r.time,
      info: r.info,
      tranId: r.tranId,
      tradeId: r.tradeId,
    }));
  } catch (error) {
    logger.error({ error: serializeError(error), params }, '[Futures] Failed to get income history');
    throw error;
  }
}

export async function getRecentTrades(
  client: USDMClient,
  symbol: string,
  limit = 10
): Promise<AccountTradeRecord[]> {
  try {
    const trades = await guardBinanceCall(() => client.getAccountTrades({ symbol, limit }));
    return trades.map((t) => ({
      symbol: t.symbol,
      id: t.id,
      orderId: String(t.orderId),
      side: t.side,
      price: String(t.price),
      qty: String(t.qty),
      realizedPnl: String(t.realizedPnl),
      quoteQty: String(t.quoteQty),
      commission: String(t.commission),
      commissionAsset: t.commissionAsset,
      time: t.time,
      buyer: t.buyer,
      maker: t.maker,
    }));
  } catch (error) {
    logger.error({ error: serializeError(error), symbol }, '[Futures] Failed to get account trades');
    throw error;
  }
}

export async function getLastClosingTrade(
  client: USDMClient,
  symbol: string,
  side: PositionSide,
  openedAt: number
): Promise<{ price: number; realizedPnl: number; commission: number } | null> {
  try {
    const trades = await guardBinanceCall(() => client.getAccountTrades({
      symbol,
      startTime: openedAt,
      limit: 100,
    }));

    const closingSide = side === 'LONG' ? 'SELL' : 'BUY';
    const closingTrades = trades.filter(
      (t) => t.side === closingSide && parseFloat(String(t.realizedPnl)) !== 0
    );

    if (closingTrades.length === 0) return null;

    const lastTrade = closingTrades[closingTrades.length - 1];
    if (!lastTrade) return null;

    let totalRealizedPnl = 0;
    let totalCommission = 0;
    let weightedPrice = 0;
    let totalQty = 0;

    for (const trade of closingTrades) {
      const qty = parseFloat(String(trade.qty));
      const price = parseFloat(String(trade.price));
      totalRealizedPnl += parseFloat(String(trade.realizedPnl));
      totalCommission += parseFloat(String(trade.commission));
      weightedPrice += price * qty;
      totalQty += qty;
    }

    const avgPrice = totalQty > 0 ? weightedPrice / totalQty : parseFloat(String(lastTrade.price));

    return {
      price: avgPrice,
      realizedPnl: totalRealizedPnl,
      commission: totalCommission,
    };
  } catch (error) {
    logger.error({ error: serializeError(error), symbol, side }, '[Futures] Failed to get last closing trade');
    return null;
  }
}

export async function getAllTradeFeesForPosition(
  client: USDMClient,
  symbol: string,
  side: PositionSide,
  openedAt: number,
  closedAt?: number,
  // Entry order id is the position's anchor — when present, we filter
  // entry trades to ONLY those that matched this orderId, instead of
  // summing every same-side trade in the time window. Without this,
  // a 2-hour orphaned-SHORT window swept up unrelated SELL trades
  // (other reverses, scalps, pyramiding, manual entries) and inflated
  // the entry fee to ~0.1% (looks like spot rate) when Binance was
  // actually charging 0.04% per trade. Same logic for exit_order_id.
  entryOrderId?: string | null,
  exitOrderId?: string | null,
): Promise<AllTradeFeesResult | null> {
  try {
    const endTime = closedAt ?? Date.now();
    const trades = await guardBinanceCall(() => client.getAccountTrades({
      symbol,
      startTime: openedAt - 5000,
      endTime: endTime + 5000,
      limit: 100,
    }));

    if (trades.length === 0) return null;

    const entrySide = side === 'LONG' ? 'BUY' : 'SELL';
    const closingSide = side === 'LONG' ? 'SELL' : 'BUY';

    let entryFee = 0;
    let exitFee = 0;
    let entryWeightedPrice = 0;
    let entryTotalQty = 0;
    let exitWeightedPrice = 0;
    let exitTotalQty = 0;
    let totalRealizedPnl = 0;
    let scopedByEntryOrderId = 0;
    let scopedByExitOrderId = 0;

    for (const trade of trades) {
      const qty = parseFloat(String(trade.qty));
      const price = parseFloat(String(trade.price));
      const commission = parseFloat(String(trade.commission));
      const realizedPnl = parseFloat(String(trade.realizedPnl));
      const tradeOrderId = String(trade.orderId);

      if (trade.side === entrySide) {
        // If we know the entry orderId, only count trades from THAT
        // specific order. Otherwise fall back to the legacy behaviour
        // (sum all same-side trades in the window) — this still
        // over-aggregates for any execution older than this fix that
        // doesn't have a tracked entryOrderId, but new positions are
        // safe.
        if (entryOrderId && tradeOrderId !== entryOrderId) continue;
        entryFee += commission;
        entryWeightedPrice += price * qty;
        entryTotalQty += qty;
        if (entryOrderId) scopedByEntryOrderId++;
      } else if (trade.side === closingSide) {
        if (exitOrderId && tradeOrderId !== exitOrderId) continue;
        exitFee += commission;
        exitWeightedPrice += price * qty;
        exitTotalQty += qty;
        totalRealizedPnl += realizedPnl;
        if (exitOrderId) scopedByExitOrderId++;
      }
    }

    const avgEntryPrice = entryTotalQty > 0 ? entryWeightedPrice / entryTotalQty : 0;
    const avgExitPrice = exitTotalQty > 0 ? exitWeightedPrice / exitTotalQty : 0;

    logger.info({
      symbol,
      side,
      entryFee,
      exitFee,
      totalFees: entryFee + exitFee,
      entryPrice: avgEntryPrice,
      exitPrice: avgExitPrice,
      realizedPnl: totalRealizedPnl,
      tradesFound: trades.length,
      entryOrderIdScoped: !!entryOrderId,
      exitOrderIdScoped: !!exitOrderId,
      scopedEntryTrades: scopedByEntryOrderId,
      scopedExitTrades: scopedByExitOrderId,
    }, '[Futures] Fetched all trade fees for position');

    return {
      entryFee,
      exitFee,
      totalFees: entryFee + exitFee,
      entryPrice: avgEntryPrice,
      exitPrice: avgExitPrice,
      realizedPnl: totalRealizedPnl,
    };
  } catch (error) {
    logger.error({ error: serializeError(error), symbol, side }, '[Futures] Failed to get all trade fees');
    return null;
  }
}

export async function getOrderEntryFee(
  client: USDMClient,
  symbol: string,
  orderId: string
): Promise<{ entryFee: number; avgPrice: number; totalQty: number } | null> {
  try {
    const trades = await guardBinanceCall(() => client.getAccountTrades({
      symbol,
      orderId: Number(orderId),
      limit: 50,
    }));

    if (trades.length === 0) return null;

    let totalFee = 0;
    let weightedPrice = 0;
    let totalQty = 0;

    for (const trade of trades) {
      const qty = parseFloat(String(trade.qty));
      const price = parseFloat(String(trade.price));
      const commission = parseFloat(String(trade.commission));

      totalFee += commission;
      weightedPrice += price * qty;
      totalQty += qty;
    }

    const avgPrice = totalQty > 0 ? weightedPrice / totalQty : 0;

    logger.info({
      symbol,
      orderId,
      entryFee: totalFee,
      avgPrice,
      totalQty,
      tradesCount: trades.length,
    }, '[Futures] Fetched entry fee for order');

    return {
      entryFee: totalFee,
      avgPrice,
      totalQty,
    };
  } catch (error) {
    logger.error({ error: serializeError(error), symbol, orderId }, '[Futures] Failed to get order entry fee');
    return null;
  }
}
