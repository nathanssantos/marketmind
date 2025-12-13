import type { Kline, TradingSetup } from '@marketmind/types';
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
  wallets,
} from '../db/schema';
import { StrategyInterpreter, StrategyLoader } from './setup-detection/dynamic';
import { riskManagerService } from './risk-manager';
import { backfillHistoricalKlines, calculateStartTime } from './binance-historical';
import type { Interval } from '@marketmind/types';
import { mlService } from './ml';

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
    fs.appendFileSync(LOG_FILE, logLine + '\n');
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
  intervalId: NodeJS.Timeout;
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

const ML_MIN_PROBABILITY = 0.5;

export class AutoTradingScheduler {
  private activeWatchers: Map<string, ActiveWatcher> = new Map();
  private strategyLoader: StrategyLoader;
  private pollIntervalMs: number;
  private mlInitialized: boolean = false;
  private mlInitializing: boolean = false;

  constructor(pollIntervalMs: number = 60000) {
    this.strategyLoader = new StrategyLoader([STRATEGIES_DIR]);
    this.pollIntervalMs = pollIntervalMs;
    log('🚀 AutoTradingScheduler initialized', { pollIntervalMs });
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

    if (!config || !config.isEnabled) {
      log('⚠️ Auto-trading not enabled for wallet', { walletId });
      await db
        .delete(activeWatchersTable)
        .where(eq(activeWatchersTable.walletId, walletId));
      log('🗑️ Removed stale watcher from database', { walletId });
      return;
    }

    const enabledStrategies = JSON.parse(config.enabledSetupTypes) as string[];
    const mlStrategies = enabledStrategies.filter(s => ML_TRAINED_STRATEGIES.includes(s));

    if (mlStrategies.length === 0) {
      log('⚠️ No ML strategies enabled', { walletId, enabledStrategies });
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
          startedAt: new Date(),
        });
        log('💾 Persisted watcher to database', { watcherId });
      }
    }

    log('🟢 Starting watcher', {
      watcherId,
      symbol,
      interval,
      enabledStrategies: mlStrategies,
    });

    const intervalId = setInterval(async () => {
      await this.processWatcher(watcherId);
    }, this.pollIntervalMs);

    const watcher: ActiveWatcher = {
      walletId,
      userId,
      symbol,
      interval,
      enabledStrategies: mlStrategies,
      intervalId,
      lastProcessedTime: Date.now(),
    };

    this.activeWatchers.set(watcherId, watcher);

    await this.processWatcher(watcherId);
  }

  async stopWatcher(walletId: string, symbol: string, interval: string): Promise<void> {
    const watcherId = `${walletId}-${symbol}-${interval}`;
    const watcher = this.activeWatchers.get(watcherId);

    if (!watcher) {
      log('⚠️ Watcher not found', { watcherId });
      return;
    }

    clearInterval(watcher.intervalId);
    this.activeWatchers.delete(watcherId);

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

      log('📊 Scanning for setups', {
        symbol: watcher.symbol,
        strategies: filteredStrategies.length,
        klines: mappedKlines.length,
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
            entryPrice: result.setup.entryPrice,
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

            log('🔮 ML prediction', {
              setupType: setup.type,
              probability: prediction.probability.toFixed(3),
              confidence: prediction.confidence,
              label: prediction.label,
              threshold: ML_MIN_PROBABILITY,
            });

            if (prediction.probability >= ML_MIN_PROBABILITY && prediction.label === 1) {
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
                reason: prediction.label === 0 ? 'predicted_loss' : 'low_probability',
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

      for (const setup of filteredSetups) {
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

  private async executeSetup(watcher: ActiveWatcher, setup: TradingSetup): Promise<void> {
    log('🚀 Attempting to execute setup', {
      type: setup.type,
      direction: setup.direction,
      entryPrice: setup.entryPrice,
    });

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

      if (!config || !config.isEnabled) {
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

      const walletBalance = parseFloat(wallet.currentBalance || '0');
      const maxPositionSizePercent = parseFloat(config.maxPositionSize);
      const positionValue = (walletBalance * maxPositionSizePercent) / 100;

      log('💰 Position sizing', {
        walletBalance: walletBalance.toFixed(2),
        maxPositionSizePercent,
        positionValue: positionValue.toFixed(2),
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

      const existingSetup = await db
        .select()
        .from(setupDetections)
        .where(
          and(
            eq(setupDetections.symbol, watcher.symbol),
            eq(setupDetections.setupType, setup.type),
            eq(setupDetections.userId, watcher.userId)
          )
        )
        .limit(1);

      let setupId: string;

      if (existingSetup.length > 0 && existingSetup[0]) {
        setupId = existingSetup[0].id;
        log('📝 Using existing setup detection', { setupId });
      } else {
        setupId = `setup-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

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
      }

      const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const quantity = positionValue / setup.entryPrice;
      const quantityFormatted = quantity.toFixed(8);

      log('📐 Calculated position size', {
        positionValue: positionValue.toFixed(2),
        entryPrice: setup.entryPrice,
        quantity: quantityFormatted,
        walletBalance: walletBalance.toFixed(2),
        maxPositionSizePercent,
      });

      await db.insert(tradeExecutions).values({
        id: executionId,
        userId: watcher.userId,
        walletId: watcher.walletId,
        setupId,
        setupType: setup.type,
        symbol: watcher.symbol,
        side: setup.direction,
        entryPrice: setup.entryPrice.toString(),
        quantity: quantityFormatted,
        stopLoss: setup.stopLoss?.toString(),
        takeProfit: setup.takeProfit?.toString(),
        openedAt: new Date(),
        status: 'open',
      });

      log('✅ Trade execution created', {
        executionId,
        setupType: setup.type,
        symbol: watcher.symbol,
        direction: setup.direction,
        entryPrice: setup.entryPrice,
        quantity: quantityFormatted,
        positionValue: positionValue.toFixed(2),
        stopLoss: setup.stopLoss,
        takeProfit: setup.takeProfit,
        confidence: setup.confidence,
      });
    } catch (error) {
      log('❌ Error executing setup', {
        type: setup.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getActiveWatchers(): { watcherId: string; symbol: string; interval: string }[] {
    return Array.from(this.activeWatchers.entries()).map(([watcherId, watcher]) => ({
      watcherId,
      symbol: watcher.symbol,
      interval: watcher.interval,
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

  async getWatcherStatusFromDb(walletId: string): Promise<{ active: boolean; watchers: number; watcherDetails: { symbol: string; interval: string }[] }> {
    const persistedWatchers = await db
      .select()
      .from(activeWatchersTable)
      .where(eq(activeWatchersTable.walletId, walletId));

    return {
      active: persistedWatchers.length > 0,
      watchers: persistedWatchers.length,
      watcherDetails: persistedWatchers.map(w => ({
        symbol: w.symbol,
        interval: w.interval,
      })),
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
          true
        );
        log('✅ Restored watcher', { watcherId: pw.id, symbol: pw.symbol, interval: pw.interval });
      } catch (error) {
        log('❌ Failed to restore watcher', {
          watcherId: pw.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

export const autoTradingScheduler = new AutoTradingScheduler(60000);
