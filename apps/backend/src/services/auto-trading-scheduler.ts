import { getThresholdForTimeframe } from '@marketmind/ml';
import type { Interval, Kline, TradingSetup } from '@marketmind/types';
import { and, desc, eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db';
import {
  activeWatchers as activeWatchersTable,
  autoTradingConfig,
  klines,
  setupDetections,
  tradeExecutions,
  tradingProfiles,
  wallets,
  type Wallet,
} from '../db/schema';
import { env } from '../env';
import { autoTradingService } from './auto-trading';
import { backfillHistoricalKlines, calculateStartTime } from './binance-historical';
import { cooldownService } from './cooldown';
import { marketContextFilter } from './market-context-filter';
import { mlService } from './ml';
import { positionMonitorService } from './position-monitor';
import { pyramidingService } from './pyramiding';
import { riskManagerService } from './risk-manager';
import { StrategyInterpreter, StrategyLoader } from './setup-detection/dynamic';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STRATEGIES_DIR = path.join(__dirname, '../../strategies/builtin');
const LOG_FILE = path.join(__dirname, '../../logs/auto-trading.log');

const ensureLogDir = (): void => {
  const logDir = path.dirname(LOG_FILE);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
};

const log = (message: string, data?: Record<string, unknown>): void => {
  const timestamp = new Date().toISOString();
  const logLine = data
    ? `[${timestamp}] ${message} ${JSON.stringify(data)}`
    : `[${timestamp}] ${message}`;

  console.log(`[Auto-Trading] ${logLine}`);

  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, `${logLine  }\n`);
  } catch {
    // Ignore file write errors
  }
};

interface ActiveWatcher {
  walletId: string;
  userId: string;
  symbol: string;
  interval: string;
  enabledStrategies: string[];
  profileId?: string;
  profileName?: string;
  intervalId: ReturnType<typeof setInterval>;
  lastProcessedTime: number;
}

const ML_TRAINED_STRATEGIES = [
  'keltner-breakout-optimized',
  'bollinger-breakout-crypto',
  'larry-williams-9-1',
  'larry-williams-9-2',
  'larry-williams-9-3',
  'larry-williams-9-4',
  'williams-momentum',
  'tema-momentum',
  'elder-ray-crypto',
  'ppo-momentum',
  'parabolic-sar-crypto',
  'supertrend-follow',
];


const INTERVAL_TO_MS: Record<string, number> = {
  '1m': 60 * 1000,
  '3m': 3 * 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '2h': 2 * 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '8h': 8 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
  '1M': 30 * 24 * 60 * 60 * 1000,
};

const getPollingIntervalForTimeframe = (interval: string): number => {
  const intervalMs = INTERVAL_TO_MS[interval];
  if (!intervalMs) {
    log(`⚠️ Unknown interval ${interval}, defaulting to 1 minute polling`);
    return 60 * 1000;
  }
  return Math.max(intervalMs, 60 * 1000);
};

export class AutoTradingScheduler {
  private activeWatchers: Map<string, ActiveWatcher> = new Map();
  private strategyLoader: StrategyLoader;
  private mlInitialized: boolean = false;
  private mlInitializing: boolean = false;

  constructor() {
    this.strategyLoader = new StrategyLoader([STRATEGIES_DIR]);
    log('🚀 AutoTradingScheduler initialized');
  }

  private async ensureMLInitialized(): Promise<boolean> {
    if (this.mlInitialized) return true;
    if (this.mlInitializing) {
      while (this.mlInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.mlInitialized;
    }

    this.mlInitializing = true;
    try {
      const result = await mlService.initialize('setup-classifier');
      this.mlInitialized = result.success;
      log('🤖 ML Service initialized', {
        success: result.success,
        modelVersion: result.modelVersion,
        featureCount: result.featureCount,
      });
      return result.success;
    } catch (error) {
      log('⚠️ ML Service initialization failed (will continue without ML filter)', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.mlInitialized = false;
      return false;
    } finally {
      this.mlInitializing = false;
    }
  }

  async startWatcher(
    walletId: string,
    userId: string,
    symbol: string,
    interval: string,
    profileId?: string,
    skipDbPersist: boolean = false
  ): Promise<void> {
    const watcherId = `${walletId}-${symbol}-${interval}`;

    if (this.activeWatchers.has(watcherId)) {
      log('⚠️ Watcher already exists', { watcherId });
      return;
    }

    const [config] = await db
      .select()
      .from(autoTradingConfig)
      .where(
        and(
          eq(autoTradingConfig.walletId, walletId),
          eq(autoTradingConfig.userId, userId)
        )
      )
      .limit(1);

    if (!config?.isEnabled) {
      log('⚠️ Auto-trading not enabled for wallet', { walletId });
      await db
        .delete(activeWatchersTable)
        .where(eq(activeWatchersTable.walletId, walletId));
      log('🗑️ Removed stale watcher from database', { walletId });
      return;
    }

    let enabledStrategies: string[];
    let profileName: string | undefined;

    if (profileId) {
      const [profile] = await db
        .select()
        .from(tradingProfiles)
        .where(eq(tradingProfiles.id, profileId))
        .limit(1);

      if (profile) {
        enabledStrategies = JSON.parse(profile.enabledSetupTypes) as string[];
        profileName = profile.name;
        log('📋 Using trading profile', { profileId, profileName, strategies: enabledStrategies.length });
      } else {
        log('⚠️ Profile not found, falling back to global config', { profileId });
        enabledStrategies = JSON.parse(config.enabledSetupTypes) as string[];
      }
    } else {
      enabledStrategies = JSON.parse(config.enabledSetupTypes) as string[];
    }

    const mlStrategies = enabledStrategies.filter(s => ML_TRAINED_STRATEGIES.includes(s));

    if (mlStrategies.length === 0) {
      log('⚠️ No ML strategies enabled', { walletId, enabledStrategies, profileId });
      return;
    }

    if (!skipDbPersist) {
      const existingWatcher = await db
        .select()
        .from(activeWatchersTable)
        .where(
          and(
            eq(activeWatchersTable.walletId, walletId),
            eq(activeWatchersTable.symbol, symbol),
            eq(activeWatchersTable.interval, interval)
          )
        )
        .limit(1);

      if (existingWatcher.length === 0) {
        await db.insert(activeWatchersTable).values({
          id: watcherId,
          userId,
          walletId,
          symbol,
          interval,
          profileId: profileId ?? null,
          startedAt: new Date(),
        });
        log('💾 Persisted watcher to database', { watcherId, profileId });
      } else if (existingWatcher[0] && existingWatcher[0].profileId !== profileId) {
        await db
          .update(activeWatchersTable)
          .set({ profileId: profileId ?? null })
          .where(eq(activeWatchersTable.id, watcherId));
        log('💾 Updated watcher profile in database', { watcherId, profileId });
      }
    }

    const pollIntervalMs = getPollingIntervalForTimeframe(interval);
    const now = Date.now();
    const nextCandleClose = Math.ceil(now / pollIntervalMs) * pollIntervalMs;
    const delayUntilNextCandle = nextCandleClose - now;

    log('🟢 Starting watcher', {
      watcherId,
      symbol,
      interval,
      enabledStrategies: mlStrategies,
      profileId,
      profileName,
      pollIntervalMs: `${pollIntervalMs / 1000}s`,
      nextCandleClose: new Date(nextCandleClose).toISOString(),
      delayUntilSync: `${Math.round(delayUntilNextCandle / 1000)}s`,
    });

    const syncTimeoutId = setTimeout(() => {
      log('🔄 Watcher synchronized with candle close', {
        watcherId,
        symbol,
        interval,
        syncedAt: new Date().toISOString(),
      });

      void this.processWatcher(watcherId);

      const intervalId = setInterval(() => {
        void this.processWatcher(watcherId);
      }, pollIntervalMs);

      const watcher = this.activeWatchers.get(watcherId);
      if (watcher) {
        watcher.intervalId = intervalId;
      }
    }, delayUntilNextCandle);

    const watcher: ActiveWatcher = {
      walletId,
      userId,
      symbol,
      interval,
      enabledStrategies: mlStrategies,
      profileId,
      profileName,
      intervalId: syncTimeoutId as unknown as ReturnType<typeof setInterval>,
      lastProcessedTime: Date.now(),
    };

    this.activeWatchers.set(watcherId, watcher);

    const { binanceKlineStreamService } = await import('./binance-kline-stream');
    binanceKlineStreamService.subscribe(symbol, interval);
    log('📊 Subscribed to kline stream', { symbol, interval });
  }

  async stopWatcher(walletId: string, symbol: string, interval: string): Promise<void> {
    const watcherId = `${walletId}-${symbol}-${interval}`;
    const watcher = this.activeWatchers.get(watcherId);

    if (!watcher) {
      log('⚠️ Watcher not found', { watcherId });
      return;
    }

    clearInterval(watcher.intervalId);
    clearTimeout(watcher.intervalId);
    this.activeWatchers.delete(watcherId);

    const { binanceKlineStreamService } = await import('./binance-kline-stream');
    binanceKlineStreamService.unsubscribe(symbol, interval);
    log('📊 Unsubscribed from kline stream', { symbol, interval });

    await db
      .delete(activeWatchersTable)
      .where(
        and(
          eq(activeWatchersTable.walletId, walletId),
          eq(activeWatchersTable.symbol, symbol),
          eq(activeWatchersTable.interval, interval)
        )
      );

    log('🔴 Watcher stopped', { watcherId });
  }

  async stopAllWatchersForWallet(walletId: string): Promise<void> {
    const watchersToStop: string[] = [];

    for (const [watcherId, watcher] of this.activeWatchers) {
      if (watcher.walletId === walletId) {
        watchersToStop.push(watcherId);
      }
    }

    for (const watcherId of watchersToStop) {
      const watcher = this.activeWatchers.get(watcherId);
      if (watcher) {
        clearInterval(watcher.intervalId);
        this.activeWatchers.delete(watcherId);
      }
    }

    await db
      .delete(activeWatchersTable)
      .where(eq(activeWatchersTable.walletId, walletId));

    log('🔴 All watchers stopped for wallet', { walletId, count: watchersToStop.length });
  }

  // eslint-disable-next-line complexity
  private async processWatcher(watcherId: string): Promise<void> {
    const watcher = this.activeWatchers.get(watcherId);
    if (!watcher) return;

    log('🔍 Processing watcher', {
      watcherId,
      symbol: watcher.symbol,
      interval: watcher.interval,
    });

    try {
      const klinesData = await db.query.klines.findMany({
        where: and(
          eq(klines.symbol, watcher.symbol),
          eq(klines.interval, watcher.interval)
        ),
        orderBy: [desc(klines.openTime)],
        limit: 500,
      });

      if (klinesData.length < 50) {
        log('📥 Insufficient klines data, fetching historical...', { count: klinesData.length, required: 50 });
        try {
          const startTime = calculateStartTime(watcher.interval as Interval, 500);
          const inserted = await backfillHistoricalKlines(
            watcher.symbol,
            watcher.interval as Interval,
            startTime
          );
          log('✅ Historical klines fetched', { symbol: watcher.symbol, interval: watcher.interval, inserted });

          if (inserted < 50) {
            log('⚠️ Still insufficient klines after backfill', { inserted });
            return;
          }

          const refreshedKlines = await db.query.klines.findMany({
            where: and(
              eq(klines.symbol, watcher.symbol),
              eq(klines.interval, watcher.interval)
            ),
            orderBy: [desc(klines.openTime)],
            limit: 500,
          });

          if (refreshedKlines.length < 50) {
            log('⚠️ Still insufficient klines after refresh', { count: refreshedKlines.length });
            return;
          }

          klinesData.length = 0;
          klinesData.push(...refreshedKlines);
        } catch (error) {
          log('❌ Failed to fetch historical klines', { error: error instanceof Error ? error.message : String(error) });
          return;
        }
      }

      klinesData.reverse();

      const mappedKlines: Kline[] = klinesData.map((k) => ({
        symbol: k.symbol,
        interval: k.interval,
        openTime: k.openTime.getTime(),
        closeTime: k.openTime.getTime(),
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume,
        quoteVolume: k.quoteVolume ?? '0',
        trades: k.trades ?? 0,
        takerBuyBaseVolume: k.takerBuyBaseVolume ?? '0',
        takerBuyQuoteVolume: k.takerBuyQuoteVolume ?? '0',
      }));

      const strategies = await this.strategyLoader.loadAll({ includeUnprofitable: false });
      const filteredStrategies = strategies.filter((s) =>
        watcher.enabledStrategies.includes(s.id)
      );

      const lastCandle = mappedKlines[mappedKlines.length - 1];
      if (!lastCandle) {
        log('⚠️ No candles available', { symbol: watcher.symbol });
        return;
      }

      const now = Date.now();
      const intervalMs = INTERVAL_TO_MS[watcher.interval] ?? 60000;
      const candleCloseTime = lastCandle.openTime + intervalMs;
      const isCandleClosed = now >= candleCloseTime;

      if (!isCandleClosed) {
        const remainingMs = candleCloseTime - now;
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        log('⏳ Waiting for candle to close', {
          symbol: watcher.symbol,
          interval: watcher.interval,
          candleOpenTime: new Date(lastCandle.openTime).toISOString(),
          candleCloseTime: new Date(candleCloseTime).toISOString(),
          remainingMinutes,
        });
        return;
      }

      log('📊 Scanning for setups', {
        symbol: watcher.symbol,
        strategies: filteredStrategies.length,
        klines: mappedKlines.length,
        lastCandleTime: new Date(lastCandle.openTime).toISOString(),
      });

      const detectedSetups: TradingSetup[] = [];
      const currentIndex = mappedKlines.length - 1;

      for (const strategy of filteredStrategies) {
        const interpreter = new StrategyInterpreter({
          enabled: true,
          minConfidence: 50,
          minRiskReward: 1.0,
          strategy,
        });

        const result = interpreter.detect(mappedKlines, currentIndex);

        if (result.setup && result.confidence >= 50) {
          detectedSetups.push(result.setup);
          log('📍 Setup detected', {
            type: result.setup.type,
            direction: result.setup.direction,
            confidence: result.confidence,
            entryPrice: result.setup.entryPrice?.toFixed(6),
            stopLoss: result.setup.stopLoss?.toFixed(6),
            takeProfit: result.setup.takeProfit?.toFixed(6),
            riskRewardRatio: result.setup.riskRewardRatio?.toFixed(2),
            candleCloseTime: new Date(candleCloseTime).toISOString(),
          });
        }
      }

      if (detectedSetups.length === 0) {
        log('📭 No setups found');
        watcher.lastProcessedTime = Date.now();
        return;
      }

      const mlReady = await this.ensureMLInitialized();
      let filteredSetups = detectedSetups;

      if (mlReady) {
        log('🤖 Filtering setups with ML model', { setupCount: detectedSetups.length });

        filteredSetups = [];
        for (const setup of detectedSetups) {
          try {
            const prediction = await mlService.predictSetup(
              mappedKlines,
              setup,
              undefined,
              watcher.symbol,
              watcher.interval
            );

            const mlThreshold = getThresholdForTimeframe(watcher.interval);

            log('🔮 ML prediction', {
              setupType: setup.type,
              probability: prediction.probability.toFixed(3),
              confidence: prediction.confidence,
              label: prediction.label,
              threshold: mlThreshold.minProbability,
              interval: watcher.interval,
            });

            if (prediction.probability >= mlThreshold.minProbability) {
              filteredSetups.push({
                ...setup,
                confidence: Math.round((setup.confidence + prediction.confidence) / 2),
              });
              log('✅ Setup passed ML filter', {
                type: setup.type,
                mlProbability: prediction.probability.toFixed(3),
                blendedConfidence: Math.round((setup.confidence + prediction.confidence) / 2),
              });
            } else {
              log('❌ Setup rejected by ML filter', {
                type: setup.type,
                mlProbability: prediction.probability.toFixed(3),
                reason: 'low_probability',
              });
            }
          } catch (error) {
            log('⚠️ ML prediction failed, using original setup', {
              type: setup.type,
              error: error instanceof Error ? error.message : String(error),
            });
            filteredSetups.push(setup);
          }
        }

        log('📊 ML filtering complete', {
          original: detectedSetups.length,
          afterFilter: filteredSetups.length,
          rejected: detectedSetups.length - filteredSetups.length,
        });
      } else {
        log('⚠️ ML not available, using all detected setups');
      }

      if (filteredSetups.length === 0) {
        log('📭 No setups passed ML filter');
        watcher.lastProcessedTime = Date.now();
        return;
      }

      log('🌍 Applying market context filter', { setupCount: filteredSetups.length });

      const contextFilteredSetups: TradingSetup[] = [];

      for (const setup of filteredSetups) {
        try {
          const contextResult = await marketContextFilter.validateSetup(
            setup,
            watcher.symbol,
            watcher.walletId
          );

          if (!contextResult.shouldTrade) {
            log('⛔ Setup rejected by market context filter', {
              type: setup.type,
              reason: contextResult.reason,
              appliedFilters: contextResult.appliedFilters.map(f => f.filter),
            });
            continue;
          }

          const adjustedSetup = { ...setup };

          if (contextResult.positionSizeMultiplier < 1.0) {
            adjustedSetup.positionSizeMultiplier = contextResult.positionSizeMultiplier;
            log('📉 Position size reduced by market context', {
              type: setup.type,
              multiplier: contextResult.positionSizeMultiplier.toFixed(2),
            });
          }

          if (contextResult.confidenceAdjustment !== 0) {
            adjustedSetup.confidence = Math.max(0, Math.min(100,
              setup.confidence + contextResult.confidenceAdjustment
            ));
            log('📊 Confidence adjusted by market context', {
              type: setup.type,
              original: setup.confidence,
              adjusted: adjustedSetup.confidence,
              adjustment: contextResult.confidenceAdjustment,
            });
          }

          if (contextResult.warnings.length > 0) {
            log('⚠️ Market context warnings', {
              type: setup.type,
              warnings: contextResult.warnings,
            });
          }

          contextFilteredSetups.push(adjustedSetup);
        } catch (error) {
          log('⚠️ Market context filter failed, using original setup', {
            type: setup.type,
            error: error instanceof Error ? error.message : String(error),
          });
          contextFilteredSetups.push(setup);
        }
      }

      log('📊 Market context filtering complete', {
        original: filteredSetups.length,
        afterFilter: contextFilteredSetups.length,
        rejected: filteredSetups.length - contextFilteredSetups.length,
      });

      if (contextFilteredSetups.length === 0) {
        log('📭 No setups passed market context filter');
        watcher.lastProcessedTime = Date.now();
        return;
      }

      for (const setup of contextFilteredSetups) {
        await this.executeSetup(watcher, setup);
      }

      watcher.lastProcessedTime = Date.now();
    } catch (error) {
      log('❌ Error processing watcher', {
        watcherId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // eslint-disable-next-line complexity
  private async executeSetup(watcher: ActiveWatcher, setup: TradingSetup): Promise<void> {
    log('🚀 Attempting to execute setup', {
      type: setup.type,
      direction: setup.direction,
      entryPrice: setup.entryPrice,
    });

    const MIN_RISK_REWARD_RATIO = 1.25;

    if (setup.stopLoss && setup.takeProfit) {
      const entryPrice = setup.entryPrice;
      const stopLoss = setup.stopLoss;
      const takeProfit = setup.takeProfit;

      let risk: number;
      let reward: number;

      if (setup.direction === 'LONG') {
        risk = entryPrice - stopLoss;
        reward = takeProfit - entryPrice;
      } else {
        risk = stopLoss - entryPrice;
        reward = entryPrice - takeProfit;
      }

      if (risk <= 0) {
        log('❌ Invalid stop loss - no risk', {
          type: setup.type,
          direction: setup.direction,
          entryPrice,
          stopLoss,
        });
        return;
      }

      const riskRewardRatio = reward / risk;

      if (riskRewardRatio < MIN_RISK_REWARD_RATIO) {
        log('❌ Setup rejected - insufficient risk/reward ratio', {
          type: setup.type,
          direction: setup.direction,
          entryPrice,
          stopLoss,
          takeProfit,
          risk: risk.toFixed(2),
          reward: reward.toFixed(2),
          riskRewardRatio: riskRewardRatio.toFixed(2),
          minRequired: MIN_RISK_REWARD_RATIO,
        });
        return;
      }

      log('✅ Risk/Reward ratio validated', {
        type: setup.type,
        direction: setup.direction,
        entryPrice: entryPrice.toFixed(6),
        stopLoss: stopLoss.toFixed(6),
        takeProfit: takeProfit.toFixed(6),
        risk: risk.toFixed(6),
        reward: reward.toFixed(6),
        riskRewardRatio: riskRewardRatio.toFixed(2),
      });
    } else if (!setup.stopLoss) {
      log('⚠️ Missing stop loss - cannot execute', {
        type: setup.type,
      });
      return;
    } else {
      log('ℹ️ Setup without take profit - skipping R:R validation', {
        type: setup.type,
      });
    }

    try {
      const [config] = await db
        .select()
        .from(autoTradingConfig)
        .where(
          and(
            eq(autoTradingConfig.walletId, watcher.walletId),
            eq(autoTradingConfig.userId, watcher.userId)
          )
        )
        .limit(1);

      if (!config?.isEnabled) {
        log('⚠️ Auto-trading disabled during execution');
        return;
      }

      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, watcher.walletId))
        .limit(1);

      if (!wallet) {
        log('❌ Wallet not found', { walletId: watcher.walletId });
        return;
      }

      const walletSupportsLive = wallet.walletType === 'live' || wallet.walletType === 'testnet';
      const isLiveExecution = walletSupportsLive && env.ENABLE_LIVE_TRADING;

      if (walletSupportsLive && !env.ENABLE_LIVE_TRADING) {
        log('⚠️ Live trading disabled via ENABLE_LIVE_TRADING=false, using paper mode', {
          walletType: wallet.walletType,
        });
      }

      log('📋 Wallet type', { walletType: wallet.walletType, isLiveExecution, enableLiveTrading: env.ENABLE_LIVE_TRADING });

      const openPositions = await db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, watcher.walletId),
            eq(tradeExecutions.status, 'open')
          )
        );

      log('📊 Current positions', {
        open: openPositions.length,
        max: config.maxConcurrentPositions,
      });

      if (openPositions.length >= config.maxConcurrentPositions) {
        log('⚠️ Max concurrent positions reached');
        return;
      }

      log('🔍 Checking cooldown', {
        setupType: setup.type,
        symbol: watcher.symbol,
        interval: watcher.interval,
        walletId: watcher.walletId,
      });

      const cooldownCheck = await cooldownService.checkCooldown(
        setup.type,
        watcher.symbol,
        watcher.interval,
        watcher.walletId
      );

      log('🔎 Cooldown check result', {
        setupType: setup.type,
        inCooldown: cooldownCheck.inCooldown,
        cooldownUntil: cooldownCheck.cooldownUntil,
        reason: cooldownCheck.reason,
      });

      if (cooldownCheck.inCooldown) {
        const remainingMs = cooldownCheck.cooldownUntil
          ? cooldownCheck.cooldownUntil.getTime() - Date.now()
          : 0;
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        log('⏳ Trade cooldown active', {
          setupType: setup.type,
          direction: setup.direction,
          reason: cooldownCheck.reason,
          remainingMinutes,
        });
        return;
      }

      log('✅ No cooldown active - proceeding with execution', {
        setupType: setup.type,
      });

      const oppositeDirectionPosition = openPositions.find(
        (pos) => pos.symbol === watcher.symbol && pos.side !== setup.direction
      );

      if (oppositeDirectionPosition) {
        log('⚠️ Opposite direction position exists - cannot open both LONG and SHORT (One-Way Mode)', {
          symbol: watcher.symbol,
          existingDirection: oppositeDirectionPosition.side,
          newDirection: setup.direction,
          existingExecutionId: oppositeDirectionPosition.id,
        });
        return;
      }

      const sameDirectionPositions = openPositions.filter(
        (pos) => pos.symbol === watcher.symbol && pos.side === setup.direction
      );

      if (sameDirectionPositions.length > 0) {
        const pyramidEval = await pyramidingService.evaluatePyramid(
          watcher.userId,
          watcher.walletId,
          watcher.symbol,
          setup.direction,
          setup.entryPrice,
          setup.confidence ? setup.confidence / 100 : undefined
        );

        if (!pyramidEval.canPyramid) {
          log('⚠️ Position exists but cannot pyramid', {
            symbol: watcher.symbol,
            direction: setup.direction,
            reason: pyramidEval.reason,
            currentEntries: pyramidEval.currentEntries,
            maxEntries: pyramidEval.maxEntries,
            profitPercent: `${(pyramidEval.profitPercent * 100).toFixed(2)  }%`,
          });
          return;
        }

        log('📈 Pyramiding opportunity detected', {
          symbol: watcher.symbol,
          direction: setup.direction,
          currentEntries: pyramidEval.currentEntries,
          profitPercent: `${(pyramidEval.profitPercent * 100).toFixed(2)  }%`,
          suggestedSize: pyramidEval.suggestedSize,
        });
      }

      const walletBalance = parseFloat(wallet.currentBalance ?? '0');

      const dynamicSize = await pyramidingService.calculateDynamicPositionSize(
        watcher.userId,
        watcher.walletId,
        watcher.symbol,
        setup.direction,
        walletBalance,
        setup.entryPrice,
        setup.confidence ? setup.confidence / 100 : undefined
      );

      if (dynamicSize.quantity <= 0) {
        log('⚠️ Dynamic sizing returned zero quantity', { reason: dynamicSize.reason });
        return;
      }

      let adjustedQuantity = dynamicSize.quantity;
      let adjustedSizePercent = dynamicSize.sizePercent;

      if (setup.positionSizeMultiplier && setup.positionSizeMultiplier < 1.0) {
        adjustedQuantity = dynamicSize.quantity * setup.positionSizeMultiplier;
        adjustedSizePercent = dynamicSize.sizePercent * setup.positionSizeMultiplier;
        log('🌍 Market context size adjustment applied', {
          originalQuantity: dynamicSize.quantity.toFixed(8),
          multiplier: setup.positionSizeMultiplier.toFixed(2),
          adjustedQuantity: adjustedQuantity.toFixed(8),
        });
      }

      const positionValue = adjustedQuantity * setup.entryPrice;

      log('💰 Dynamic position sizing', {
        walletBalance: walletBalance.toFixed(2),
        sizePercent: adjustedSizePercent.toFixed(2),
        positionValue: positionValue.toFixed(2),
        reason: dynamicSize.reason,
      });

      const riskValidation = await riskManagerService.validateNewPosition(
        watcher.walletId,
        config,
        positionValue
      );

      if (!riskValidation.isValid) {
        log('⚠️ Risk validation failed', { reason: riskValidation.reason });
        return;
      }

      const setupId = `setup-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await db.insert(setupDetections).values({
        id: setupId,
        userId: watcher.userId,
        symbol: watcher.symbol,
        interval: watcher.interval,
        setupType: setup.type,
        direction: setup.direction,
        entryPrice: setup.entryPrice.toString(),
        stopLoss: setup.stopLoss?.toString(),
        takeProfit: setup.takeProfit?.toString(),
        confidence: Math.round(setup.confidence),
        riskReward: setup.riskRewardRatio.toString(),
        detectedAt: new Date(),
        expiresAt,
      });

      log('📝 Created setup detection', { setupId });

      const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const quantityFormatted = adjustedQuantity.toFixed(8);

      log('📐 Final position size', {
        positionValue: positionValue.toFixed(2),
        entryPrice: setup.entryPrice,
        quantity: quantityFormatted,
        walletBalance: walletBalance.toFixed(2),
        sizePercent: adjustedSizePercent.toFixed(2),
      });

      const SLIPPAGE_PERCENT = 0.1;
      const COMMISSION_PERCENT = 0.1;
      const slippageFactor = setup.direction === 'LONG' ? (1 + SLIPPAGE_PERCENT / 100) : (1 - SLIPPAGE_PERCENT / 100);
      const expectedEntryWithSlippage = setup.entryPrice * slippageFactor;

      let entryOrderId: number | null = null;
      let actualEntryPrice = expectedEntryWithSlippage;
      let actualQuantity = adjustedQuantity;
      let stopLossOrderId: number | null = null;
      let takeProfitOrderId: number | null = null;

      log('💸 Entry price adjusted for slippage', {
        originalEntry: setup.entryPrice,
        expectedEntry: expectedEntryWithSlippage,
        slippagePercent: SLIPPAGE_PERCENT,
        commissionPercent: COMMISSION_PERCENT,
        direction: setup.direction,
      });

      const useLimit = setup.entryOrderType === 'LIMIT' && setup.limitEntryPrice;
      const orderType = useLimit ? 'LIMIT' : 'MARKET';

      if (isLiveExecution) {
        log(`🔴 LIVE EXECUTION - Placing ${orderType} order on Binance`, {
          walletType: wallet.walletType,
          symbol: watcher.symbol,
          side: setup.direction === 'LONG' ? 'BUY' : 'SELL',
          quantity: quantityFormatted,
          orderType,
          limitPrice: useLimit ? setup.limitEntryPrice : undefined,
        });

        try {
          const orderResult = await autoTradingService.executeBinanceOrder(
            wallet as Wallet,
            {
              symbol: watcher.symbol,
              side: setup.direction === 'LONG' ? 'BUY' : 'SELL',
              type: orderType,
              quantity: adjustedQuantity,
              price: useLimit ? setup.limitEntryPrice : undefined,
            }
          );

          entryOrderId = orderResult.orderId;
          actualEntryPrice = parseFloat(orderResult.price) || setup.entryPrice;
          actualQuantity = parseFloat(orderResult.executedQty) || adjustedQuantity;

          log('✅ Binance order executed', {
            orderId: entryOrderId,
            executedQty: orderResult.executedQty,
            price: orderResult.price,
          });

          if (setup.stopLoss) {
            try {
              stopLossOrderId = await autoTradingService.createStopLossOrder(
                wallet as Wallet,
                watcher.symbol,
                actualQuantity,
                setup.stopLoss,
                setup.direction
              );
              log('🛡️ Stop loss order placed', { stopLossOrderId, stopLoss: setup.stopLoss });
            } catch (slError) {
              log('⚠️ Failed to place stop loss order', {
                error: slError instanceof Error ? slError.message : String(slError),
              });
            }
          }

          if (setup.takeProfit) {
            try {
              takeProfitOrderId = await autoTradingService.createTakeProfitOrder(
                wallet as Wallet,
                watcher.symbol,
                actualQuantity,
                setup.takeProfit,
                setup.direction
              );
              log('🎯 Take profit order placed', { takeProfitOrderId, takeProfit: setup.takeProfit });
            } catch (tpError) {
              log('⚠️ Failed to place take profit order', {
                error: tpError instanceof Error ? tpError.message : String(tpError),
              });
            }
          }
        } catch (orderError) {
          log('❌ Failed to execute Binance order', {
            error: orderError instanceof Error ? orderError.message : String(orderError),
          });
          return;
        }
      } else {
        if (useLimit && setup.limitEntryPrice) {
          actualEntryPrice = setup.limitEntryPrice;
          log('📝 PAPER TRADING - Using LIMIT entry price', {
            walletType: wallet.walletType,
            setupClosePrice: setup.entryPrice,
            limitEntryPrice: setup.limitEntryPrice,
            orderType: 'LIMIT',
            improvement: `${(((setup.entryPrice - setup.limitEntryPrice) / setup.entryPrice) * 100).toFixed(2)}%`,
          });
        } else {
          log('📝 PAPER TRADING - Using current market price', {
            walletType: wallet.walletType,
            setupPrice: setup.entryPrice,
            orderType: 'MARKET',
          });

          try {
            const currentMarketPrice = await positionMonitorService.getCurrentPrice(watcher.symbol);

            if (currentMarketPrice) {
              actualEntryPrice = currentMarketPrice;
              log('✅ Using live market price for paper trading', {
                setupPrice: setup.entryPrice,
                marketPrice: currentMarketPrice,
                difference: `${((currentMarketPrice - setup.entryPrice) / setup.entryPrice * 100).toFixed(2)}%`,
              });
            } else {
              log('⚠️ No live price available, using setup price with slippage', {
                setupPrice: setup.entryPrice,
                priceUsed: expectedEntryWithSlippage,
              });
            }
          } catch (priceError) {
            log('⚠️ Failed to get market price, using setup price with slippage', {
              error: priceError instanceof Error ? priceError.message : String(priceError),
            });
          }
        }
      }

      if (setup.stopLoss && setup.takeProfit) {
        let risk: number;
        let reward: number;

        if (setup.direction === 'LONG') {
          risk = actualEntryPrice - setup.stopLoss;
          reward = setup.takeProfit - actualEntryPrice;
        } else {
          risk = setup.stopLoss - actualEntryPrice;
          reward = actualEntryPrice - setup.takeProfit;
        }

        if (risk <= 0) {
          log('❌ Invalid stop loss after price adjustment - no risk', {
            type: setup.type,
            direction: setup.direction,
            actualEntryPrice,
            stopLoss: setup.stopLoss,
          });
          return;
        }

        const finalRiskRewardRatio = reward / risk;
        const MIN_RISK_REWARD_RATIO = 1.25;

        if (finalRiskRewardRatio < MIN_RISK_REWARD_RATIO) {
          log('❌ Setup rejected after price adjustment - insufficient final R:R ratio', {
            type: setup.type,
            direction: setup.direction,
            setupEntryPrice: setup.entryPrice,
            actualEntryPrice,
            stopLoss: setup.stopLoss,
            takeProfit: setup.takeProfit,
            risk: risk.toFixed(2),
            reward: reward.toFixed(2),
            originalRR: setup.riskRewardRatio.toFixed(2),
            finalRR: finalRiskRewardRatio.toFixed(2),
            minRequired: MIN_RISK_REWARD_RATIO,
            priceDeviation: ((actualEntryPrice - setup.entryPrice) / setup.entryPrice * 100).toFixed(2) + '%',
          });
          return;
        }

        log('✅ Final Risk/Reward ratio validated after price adjustment', {
          type: setup.type,
          direction: setup.direction,
          setupEntryPrice: setup.entryPrice.toFixed(6),
          actualEntryPrice: actualEntryPrice.toFixed(6),
          stopLoss: setup.stopLoss.toFixed(6),
          takeProfit: setup.takeProfit.toFixed(6),
          risk: risk.toFixed(6),
          reward: reward.toFixed(6),
          originalRR: setup.riskRewardRatio.toFixed(2),
          finalRR: finalRiskRewardRatio.toFixed(2),
        });
      }

      log('💾 Inserting trade execution into database', {
        executionId,
        setupType: setup.type,
        symbol: watcher.symbol,
        direction: setup.direction,
        finalEntryPrice: actualEntryPrice,
      });

      try {
        await db.insert(tradeExecutions).values({
          id: executionId,
          userId: watcher.userId,
          walletId: watcher.walletId,
          setupId,
          setupType: setup.type,
          symbol: watcher.symbol,
          side: setup.direction,
          entryPrice: actualEntryPrice.toString(),
          entryOrderId,
          stopLossOrderId,
          takeProfitOrderId,
          quantity: actualQuantity.toFixed(8),
          stopLoss: setup.stopLoss?.toString(),
          takeProfit: setup.takeProfit?.toString(),
          openedAt: new Date(),
          status: 'open',
        });

        log('✅ Trade execution inserted into database', { executionId });
      } catch (dbError) {
        log('❌ Failed to insert trade execution into database', {
          executionId,
          error: dbError instanceof Error ? dbError.message : String(dbError),
          stack: dbError instanceof Error ? dbError.stack : undefined,
        });
        throw dbError;
      }

      log('⏱️ Setting cooldown', {
        setupType: setup.type,
        symbol: watcher.symbol,
        interval: watcher.interval,
        walletId: watcher.walletId,
        cooldownMinutes: 15,
      });

      try {
        await cooldownService.setCooldown(
          setup.type,
          watcher.symbol,
          watcher.interval,
          watcher.walletId,
          executionId,
          15,
          'Trade executed'
        );

        log('✅ Cooldown set successfully', {
          setupType: setup.type,
          cooldownMinutes: 15,
        });
      } catch (cooldownError) {
        log('❌ Failed to set cooldown', {
          setupType: setup.type,
          error: cooldownError instanceof Error ? cooldownError.message : String(cooldownError),
        });
      }

      log('✅ Trade execution created', {
        executionId,
        setupType: setup.type,
        symbol: watcher.symbol,
        direction: setup.direction,
        entryPrice: actualEntryPrice,
        quantity: actualQuantity.toFixed(8),
        positionValue: (actualQuantity * actualEntryPrice).toFixed(2),
        stopLoss: setup.stopLoss,
        takeProfit: setup.takeProfit,
        confidence: setup.confidence,
        isLiveExecution,
        entryOrderId,
        cooldownMinutes: 15,
      });

      await positionMonitorService.invalidatePriceCache(watcher.symbol);

      const allOpenExecutions = await db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, watcher.walletId),
            eq(tradeExecutions.symbol, watcher.symbol),
            eq(tradeExecutions.side, setup.direction),
            eq(tradeExecutions.status, 'open')
          )
        );

      if (allOpenExecutions.length > 1) {
        const newStopLoss = await pyramidingService.adjustStopLossForPyramid(
          allOpenExecutions,
          setup.direction
        );

        if (newStopLoss !== null) {
          for (const exec of allOpenExecutions) {
            await db
              .update(tradeExecutions)
              .set({ stopLoss: newStopLoss.toString() })
              .where(eq(tradeExecutions.id, exec.id));
          }

          log('🛡️ Stop loss adjusted for pyramid position', {
            symbol: watcher.symbol,
            direction: setup.direction,
            entries: allOpenExecutions.length,
            newStopLoss: newStopLoss.toFixed(2),
          });
        }
      }
    } catch (error) {
      log('❌ Error executing setup', {
        type: setup.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getActiveWatchers(): { watcherId: string; symbol: string; interval: string; profileId?: string; profileName?: string }[] {
    return Array.from(this.activeWatchers.entries()).map(([watcherId, watcher]) => ({
      watcherId,
      symbol: watcher.symbol,
      interval: watcher.interval,
      profileId: watcher.profileId,
      profileName: watcher.profileName,
    }));
  }

  getWatcherStatus(walletId: string): { active: boolean; watchers: number } {
    let count = 0;
    for (const watcher of this.activeWatchers.values()) {
      if (watcher.walletId === walletId) {
        count++;
      }
    }
    return { active: count > 0, watchers: count };
  }

  async getWatcherStatusFromDb(walletId: string): Promise<{ active: boolean; watchers: number; watcherDetails: { symbol: string; interval: string; profileId?: string; profileName?: string }[] }> {
    const persistedWatchers = await db
      .select()
      .from(activeWatchersTable)
      .where(eq(activeWatchersTable.walletId, walletId));

    const watcherDetails: { symbol: string; interval: string; profileId?: string; profileName?: string }[] = [];

    for (const w of persistedWatchers) {
      let profileName: string | undefined;
      if (w.profileId) {
        const [profile] = await db
          .select({ name: tradingProfiles.name })
          .from(tradingProfiles)
          .where(eq(tradingProfiles.id, w.profileId))
          .limit(1);
        profileName = profile?.name;
      }
      watcherDetails.push({
        symbol: w.symbol,
        interval: w.interval,
        profileId: w.profileId ?? undefined,
        profileName,
      });
    }

    return {
      active: persistedWatchers.length > 0,
      watchers: persistedWatchers.length,
      watcherDetails,
    };
  }

  async restoreWatchersFromDb(): Promise<void> {
    log('🔄 Restoring watchers from database...');

    const persistedWatchers = await db
      .select()
      .from(activeWatchersTable);

    if (persistedWatchers.length === 0) {
      log('📭 No persisted watchers found');
      return;
    }

    log(`📋 Found ${persistedWatchers.length} persisted watcher(s)`);

    for (const pw of persistedWatchers) {
      try {
        await this.startWatcher(
          pw.walletId,
          pw.userId,
          pw.symbol,
          pw.interval,
          pw.profileId ?? undefined,
          true
        );
        log('✅ Restored watcher', { watcherId: pw.id, symbol: pw.symbol, interval: pw.interval, profileId: pw.profileId });
      } catch (error) {
        log('❌ Failed to restore watcher', {
          watcherId: pw.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

export const autoTradingScheduler = new AutoTradingScheduler();
