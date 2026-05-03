import type { Interval } from '@marketmind/types';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { pairMaintenanceLog, tradeExecutions } from '../../db/schema';
import { binanceKlineStreamService, binanceFuturesKlineStreamService } from '../binance-kline-stream';
import { getCustomSymbolService } from '../custom-symbol-service';
import { logger, serializeError } from '../logger';
import type { ActivePair } from './types';

export const getActivePairsWithSubscriptions = async (): Promise<ActivePair[]> => {
  const pairs: ActivePair[] = [];
  const seen = new Set<string>();
  // Custom symbols (POLITIFI etc.) are composite indices computed from
  // constituent klines via CustomSymbolService — they don't live on the
  // exchange, so the Binance gap-filler can't touch them. Filter them out
  // up-front so we don't even attempt detectGaps → fillGap on them.
  const customSymbolService = getCustomSymbolService();
  const isCustom = (symbol: string) => customSymbolService?.isCustomSymbolSync(symbol) ?? false;

  const watchers = await db.query.activeWatchers.findMany();
  for (const watcher of watchers) {
    if (isCustom(watcher.symbol)) continue;
    const key = `${watcher.symbol}@${watcher.interval}@${watcher.marketType}`;
    if (!seen.has(key)) {
      seen.add(key);
      pairs.push({
        symbol: watcher.symbol,
        interval: watcher.interval as Interval,
        marketType: watcher.marketType,
      });
    }
  }

  try {
    const spotSubs = binanceKlineStreamService.getActiveSubscriptions();
    for (const sub of spotSubs) {
      if (isCustom(sub.symbol)) continue;
      const key = `${sub.symbol}@${sub.interval}@SPOT`;
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push({ symbol: sub.symbol, interval: sub.interval as Interval, marketType: 'SPOT' });
      }
    }

    const futuresSubs = binanceFuturesKlineStreamService.getActiveSubscriptions();
    for (const sub of futuresSubs) {
      if (isCustom(sub.symbol)) continue;
      const key = `${sub.symbol}@${sub.interval}@FUTURES`;
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push({ symbol: sub.symbol, interval: sub.interval as Interval, marketType: 'FUTURES' });
      }
    }
  } catch (error) {
    logger.trace({ error: serializeError(error) }, '[KlineMaintenance] Stream services not available (expected during startup)');
  }

  try {
    const openExecs = await db.query.tradeExecutions.findMany({
      where: inArray(tradeExecutions.status, ['open', 'pending']),
      columns: { symbol: true, marketType: true },
    });
    const uniqueOpen = [...new Map(
      openExecs.map(e => [`${e.symbol}@${e.marketType}`, e])
    ).values()];

    for (const exec of uniqueOpen) {
      if (isCustom(exec.symbol)) continue;
      const logEntries = await db.query.pairMaintenanceLog.findMany({
        where: and(
          eq(pairMaintenanceLog.symbol, exec.symbol),
          eq(pairMaintenanceLog.marketType, exec.marketType ?? 'FUTURES')
        ),
        columns: { interval: true },
      });
      for (const log of logEntries) {
        const key = `${exec.symbol}@${log.interval}@${exec.marketType}`;
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push({ symbol: exec.symbol, interval: log.interval as Interval, marketType: (exec.marketType ?? 'FUTURES') });
        }
      }
    }
  } catch (error) {
    logger.trace({ error: serializeError(error) }, '[KlineMaintenance] Error fetching open executions for active pairs');
  }

  return pairs;
};
