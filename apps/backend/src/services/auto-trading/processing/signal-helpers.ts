import type { Interval, Kline, PositionSide, TimeInterval, TradingSetup } from '@marketmind/types';
import { TRADING_DEFAULTS } from '@marketmind/types';
import { TIME_MS, UNIT_MS } from '../../../constants';
import { db } from '../../../db';
import { signalSuggestions } from '../../../db/schema';
import type { WatcherLogBuffer, SetupLogEntry, WatcherResult } from '../../watcher-batch-logger';
import { autoTradingLogBuffer, type FrontendLogEntry } from '../../auto-trading-log-buffer';
import { getWebSocketService } from '../../websocket';
import { generateEntityId } from '../../../utils/id';
import type { AutoTradingConfig } from '../../../db/schema';
import type { ActiveWatcher, SignalProcessorDeps } from '../types';
import type { PineStrategy } from '../../pine/types';
import { detectSetups } from '../../indicator-engine';
import { fetchKlinesFromDbWithBackfill } from '../../backtesting/kline-fetcher';
import { BACKTEST_ENGINE } from '../../../constants';

/**
 * Process-local HTF kline cache for the live watcher loop. Keyed by
 * `${symbol}_${tf}`. Each entry stores the klines + the last-fetched
 * timestamp; we refresh when the entry's age exceeds the HTF interval
 * (so each HTF bar gets at most one DB hit per LTF tick window).
 *
 * Without this cache the watcher would re-fetch HTF history on EVERY
 * LTF bar close — for a 15m watcher with a 4h HTF, that's 16 fetches
 * for the same 4h candle, each pulling ~200 bars of warmup. Cache
 * brings it to 1 fetch per 4h.
 */
interface HtfCacheEntry {
  klines: Kline[];
  fetchedAt: number;
  htfIntervalMs: number;
}
const htfCache = new Map<string, HtfCacheEntry>();

const cacheTfKey = (symbol: string, tf: string): string => `${symbol}_${tf}`;

const tfToIntervalMs = (tf: string): number => {
  const match = tf.match(/^(\d+)([mhdw])$/);
  if (!match?.[1] || !match[2]) return 4 * TIME_MS.HOUR;
  const unitMs = UNIT_MS[match[2]];
  if (!unitMs) return 4 * TIME_MS.HOUR;
  return parseInt(match[1]) * unitMs;
};

/**
 * Fetch HTF klines (with EMA200 warmup) for every timeframe declared
 * via `@requires-tf` across the given strategies. Returns a map keyed
 * by TF label, suitable to pass as `detectSetups({ secondaryKlines })`.
 * Cache-aware: skips the DB roundtrip when the cached entry is fresher
 * than one HTF bar.
 */
const fetchSecondaryKlinesForStrategies = async (
  symbol: string,
  marketType: 'SPOT' | 'FUTURES',
  strategies: PineStrategy[],
): Promise<Record<string, Kline[]>> => {
  const requiredTfs = new Set<string>();
  for (const s of strategies) {
    for (const tf of s.metadata.requiresTimeframes ?? []) requiredTfs.add(tf);
  }
  if (requiredTfs.size === 0) return {};

  const out: Record<string, Kline[]> = {};
  const now = Date.now();

  for (const tf of requiredTfs) {
    const cacheKey = cacheTfKey(symbol, tf);
    const htfIntervalMs = tfToIntervalMs(tf);
    const cached = htfCache.get(cacheKey);

    if (cached && now - cached.fetchedAt < htfIntervalMs) {
      out[tf] = cached.klines;
      continue;
    }

    // EMA200 warmup so HTF indicators have history. The DB query
    // includes the live window automatically via end=now.
    const warmupMs = BACKTEST_ENGINE.EMA200_WARMUP_BARS * htfIntervalMs;
    const startTime = new Date(now - warmupMs);
    const endTime = new Date(now);

    const klines = await fetchKlinesFromDbWithBackfill(
      symbol,
      tf as Interval,
      marketType,
      startTime,
      endTime,
    );
    htfCache.set(cacheKey, { klines, fetchedAt: now, htfIntervalMs });
    out[tf] = klines;
  }

  return out;
};

/**
 * Test/CLI helper. Strips the live HTF cache so a backtest harness or
 * vitest suite can run against fresh fetches without process-restart.
 */
export const __resetHtfCacheForTests = (): void => {
  htfCache.clear();
};

export const getIntervalMs = (interval: string): number => {
  const match = interval.match(/^(\d+)([mhdw])$/);
  if (!match?.[1] || !match[2]) return 4 * TIME_MS.HOUR;
  const unitMs = UNIT_MS[match[2]];
  if (!unitMs) return 4 * TIME_MS.HOUR;
  return parseInt(match[1]) * unitMs;
};

export const runSetupDetection = async (
  closedKlines: Kline[],
  filteredStrategies: PineStrategy[],
  effectiveConfig: AutoTradingConfig | null,
  directionMode: string,
  watcher: ActiveWatcher,
  logBuffer: WatcherLogBuffer
): Promise<TradingSetup[]> => {
  const currentIndex = closedKlines.length - 1;

  const minRRLong = effectiveConfig?.minRiskRewardRatioLong
    ? parseFloat(effectiveConfig.minRiskRewardRatioLong)
    : TRADING_DEFAULTS.MIN_RISK_REWARD_RATIO;
  const minRRShort = effectiveConfig?.minRiskRewardRatioShort
    ? parseFloat(effectiveConfig.minRiskRewardRatioShort)
    : TRADING_DEFAULTS.MIN_RISK_REWARD_RATIO;

  // Multi-TF wiring: if any of the filtered strategies declares
  // `@requires-tf 4h, 1d` etc., pre-load those HTF klines from the
  // DB (with EMA200 warmup) before invoking detectSetups. Without
  // this, the strategy's `request.security(...)` call throws "no
  // klines registered" at run time. Cached across watcher ticks so
  // we don't refetch on every 15m close.
  const marketType: 'SPOT' | 'FUTURES' = (watcher.marketType ?? 'FUTURES') as 'SPOT' | 'FUTURES';
  const secondaryKlines = await fetchSecondaryKlinesForStrategies(
    watcher.symbol,
    marketType,
    filteredStrategies,
  );

  const detectionResults = await detectSetups({
    klines: closedKlines,
    strategies: filteredStrategies,
    currentIndex,
    config: {
      minConfidence: 50,
      minRiskReward: Math.min(minRRLong, minRRShort),
      silent: true,
      interval: watcher.interval as TimeInterval,
      directionMode: directionMode !== 'auto' ? directionMode as 'long_only' | 'short_only' : undefined,
      maxFibonacciEntryProgressPercentLong: effectiveConfig?.maxFibonacciEntryProgressPercentLong ? parseFloat(effectiveConfig.maxFibonacciEntryProgressPercentLong) : undefined,
      maxFibonacciEntryProgressPercentShort: effectiveConfig?.maxFibonacciEntryProgressPercentShort ? parseFloat(effectiveConfig.maxFibonacciEntryProgressPercentShort) : undefined,
      fibonacciSwingRange: (effectiveConfig?.fibonacciSwingRange) ?? undefined,
    },
    ...(Object.keys(secondaryKlines).length > 0 ? { secondaryKlines } : {}),
  });

  const detectedSetups: TradingSetup[] = [];

  for (const result of detectionResults) {
    const strategy = filteredStrategies.find(s => s.metadata.id === result.strategyId);
    const strategyName = strategy?.metadata.name ?? result.strategyId;

    if (result.rejection) {
      const rejectionDirection = result.rejection.details?.['direction'] as string | undefined;
      const entryPrice = result.rejection.details?.['entryPrice'] as number | undefined;

      if (rejectionDirection && rejectionDirection !== '-') {
        const lastKline = closedKlines[closedKlines.length - 1];
        const currentPrice = lastKline ? parseFloat(lastKline.close) : 0;

        logBuffer.startSetupValidation({
          type: strategyName,
          direction: rejectionDirection as PositionSide,
          entryPrice: entryPrice ?? currentPrice,
          confidence: result.confidence ?? 0,
        });

        const reasonKey = result.rejection.reason.split(':')[0]?.trim() ?? result.rejection.reason;
        const detailValues = result.rejection.details
          ? Object.entries(result.rejection.details)
              .filter(([k]) => k !== 'direction' && k !== 'entryPrice')
              .map(([k, v]) => `${k}=${v}`)
              .join(', ')
          : '';

        logBuffer.addValidationCheck({
          name: reasonKey,
          passed: false,
          reason: detailValues || result.rejection.reason,
        });

        logBuffer.completeSetupValidation('blocked', result.rejection.reason);
      }

      logBuffer.addRejection({
        setupType: strategyName,
        direction: rejectionDirection ?? '-',
        reason: result.rejection.reason,
        details: result.rejection.details,
      });
    }

    if (result.setup && result.confidence >= 50) {
      const setupWithTriggerData = {
        ...result.setup,
        triggerKlineIndex: result.triggerKlineIndex,
      };
      detectedSetups.push(setupWithTriggerData);

      const setupEntry: SetupLogEntry = {
        type: result.setup.type,
        direction: result.setup.direction,
        confidence: result.confidence,
        entryPrice: result.setup.entryPrice?.toFixed(6) ?? '-',
        stopLoss: result.setup.stopLoss?.toFixed(6) ?? '-',
        takeProfit: result.setup.takeProfit?.toFixed(6) ?? '-',
        riskReward: result.setup.riskRewardRatio?.toFixed(2) ?? '-',
      };
      logBuffer.addSetup(setupEntry);
      logBuffer.log('>', 'Setup detected', {
        type: result.setup.type,
        direction: result.setup.direction,
        confidence: result.confidence,
      });
    }
  }

  return detectedSetups;
};

export const handleSemiAssistedSetups = async (
  detectedSetups: TradingSetup[],
  watcher: ActiveWatcher,
  watcherId: string,
  effectiveConfig: AutoTradingConfig | null,
  filteredStrategies: PineStrategy[],
  closedKlines: Kline[],
  lastCandle: Kline,
  deps: SignalProcessorDeps,
  logBuffer: WatcherLogBuffer
): Promise<void> => {
  const wsService = getWebSocketService();
  const userId = effectiveConfig?.userId ?? watcher.userId;
  const defaultPositionSizePercent = effectiveConfig?.positionSizePercent ?? '10';
  const intervalMs = getIntervalMs(watcher.interval);
  const expiresAt = new Date(Date.now() + intervalMs * 3);

  for (const setup of detectedSetups) {
    const passesFilters = await deps.validateSetupFilters(
      watcher, setup, filteredStrategies, closedKlines, logBuffer
    );
    if (!passesFilters) {
      logBuffer.log('~', 'Setup filtered out (semi-assisted)', {
        type: setup.type,
        direction: setup.direction,
      });
      continue;
    }

    const suggestionId = generateEntityId();

    await db.insert(signalSuggestions).values({
      id: suggestionId,
      userId,
      walletId: watcher.walletId,
      watcherId,
      symbol: watcher.symbol,
      interval: watcher.interval,
      side: setup.direction,
      setupType: setup.type,
      strategyId: setup.type,
      entryPrice: String(setup.entryPrice ?? 0),
      stopLoss: setup.stopLoss !== null && setup.stopLoss !== undefined ? String(setup.stopLoss) : null,
      takeProfit: setup.takeProfit !== null && setup.takeProfit !== undefined ? String(setup.takeProfit) : null,
      riskRewardRatio: setup.riskRewardRatio !== null && setup.riskRewardRatio !== undefined ? String(setup.riskRewardRatio) : null,
      confidence: setup.confidence ?? null,
      fibonacciProjection: setup.fibonacciProjection ? JSON.stringify(setup.fibonacciProjection) : null,
      triggerKlineOpenTime: lastCandle.openTime,
      status: 'pending',
      positionSizePercent: defaultPositionSizePercent,
      expiresAt,
    });

    logBuffer.log('>', 'Signal suggestion created (semi-assisted)', {
      type: setup.type,
      direction: setup.direction,
      entryPrice: setup.entryPrice,
    });

    if (wsService) {
      wsService.emitSignalSuggestion(userId, {
        id: suggestionId,
        walletId: watcher.walletId,
        symbol: watcher.symbol,
        interval: watcher.interval,
        side: setup.direction,
        setupType: setup.type,
        entryPrice: String(setup.entryPrice ?? 0),
        stopLoss: setup.stopLoss !== null && setup.stopLoss !== undefined ? String(setup.stopLoss) : null,
        takeProfit: setup.takeProfit !== null && setup.takeProfit !== undefined ? String(setup.takeProfit) : null,
        riskRewardRatio: setup.riskRewardRatio !== null && setup.riskRewardRatio !== undefined ? String(setup.riskRewardRatio) : null,
        confidence: setup.confidence ?? null,
        expiresAt: expiresAt.toISOString(),
      });
    }
  }
};

export const emitLogsToWebSocket = (
  watcherResults: WatcherResult[],
  activeWatchers: Map<string, ActiveWatcher>
): void => {
  const wsService = getWebSocketService();
  if (!wsService) return;

  for (const result of watcherResults) {
    const watcher = activeWatchers.get(result.watcherId);
    if (!watcher) continue;

    for (const logEntry of result.logs) {
      const entry: FrontendLogEntry = autoTradingLogBuffer.addLog(watcher.walletId, {
        timestamp: logEntry.timestamp.getTime(),
        level: logEntry.level,
        emoji: logEntry.emoji,
        message: logEntry.message,
        symbol: result.symbol,
        interval: result.interval,
      });
      wsService.emitAutoTradingLog(watcher.walletId, entry);
    }
  }
};
