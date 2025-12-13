import type { Interval, Kline, TradingSetup } from '@marketmind/types';
import { getThresholdForTimeframe } from '@marketmind/ml';
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
  type Wallet,
} from '../db/schema';
import { StrategyInterpreter, StrategyLoader } from './setup-detection/dynamic';
import { riskManagerService } from './risk-manager';
import { backfillHistoricalKlines, calculateStartTime } from './binance-historical';
import { mlService } from './ml';
import { pyramidingService } from './pyramiding';
import { autoTradingService } from './auto-trading';
import { env } from '../env';

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

      const existingOpenExecution = openPositions.find(
        (pos) => pos.symbol === watcher.symbol && pos.setupType === setup.type
      );

      if (existingOpenExecution) {
        log('⚠️ Duplicate execution prevented - already have open position for this setup', {
          symbol: watcher.symbol,
          setupType: setup.type,
          existingExecutionId: existingOpenExecution.id,
        });
        return;
      }

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
            profitPercent: (pyramidEval.profitPercent * 100).toFixed(2) + '%',
          });
          return;
        }

        log('📈 Pyramiding opportunity detected', {
          symbol: watcher.symbol,
          direction: setup.direction,
          currentEntries: pyramidEval.currentEntries,
          profitPercent: (pyramidEval.profitPercent * 100).toFixed(2) + '%',
          suggestedSize: pyramidEval.suggestedSize,
        });
      }

      const walletBalance = parseFloat(wallet.currentBalance || '0');

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

      const positionValue = dynamicSize.quantity * setup.entryPrice;

      log('💰 Dynamic position sizing', {
        walletBalance: walletBalance.toFixed(2),
        sizePercent: dynamicSize.sizePercent.toFixed(2),
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

      const quantityFormatted = dynamicSize.quantity.toFixed(8);

      log('📐 Final position size', {
        positionValue: positionValue.toFixed(2),
        entryPrice: setup.entryPrice,
        quantity: quantityFormatted,
        walletBalance: walletBalance.toFixed(2),
        sizePercent: dynamicSize.sizePercent.toFixed(2),
      });

      let entryOrderId: number | null = null;
      let actualEntryPrice = setup.entryPrice;
      let actualQuantity = dynamicSize.quantity;

      if (isLiveExecution) {
        log('🔴 LIVE EXECUTION - Placing order on Binance', {
          walletType: wallet.walletType,
          symbol: watcher.symbol,
          side: setup.direction === 'LONG' ? 'BUY' : 'SELL',
          quantity: quantityFormatted,
        });

        try {
          const orderResult = await autoTradingService.executeBinanceOrder(
            wallet as Wallet,
            {
              symbol: watcher.symbol,
              side: setup.direction === 'LONG' ? 'BUY' : 'SELL',
              type: 'MARKET',
              quantity: dynamicSize.quantity,
            }
          );

          entryOrderId = orderResult.orderId;
          actualEntryPrice = parseFloat(orderResult.price) || setup.entryPrice;
          actualQuantity = parseFloat(orderResult.executedQty) || dynamicSize.quantity;

          log('✅ Binance order executed', {
            orderId: entryOrderId,
            executedQty: orderResult.executedQty,
            price: orderResult.price,
          });

          if (setup.stopLoss) {
            try {
              const slOrderId = await autoTradingService.createStopLossOrder(
                wallet as Wallet,
                watcher.symbol,
                actualQuantity,
                setup.stopLoss,
                setup.direction
              );
              log('🛡️ Stop loss order placed', { slOrderId, stopLoss: setup.stopLoss });
            } catch (slError) {
              log('⚠️ Failed to place stop loss order', {
                error: slError instanceof Error ? slError.message : String(slError),
              });
            }
          }

          if (setup.takeProfit) {
            try {
              const tpOrderId = await autoTradingService.createTakeProfitOrder(
                wallet as Wallet,
                watcher.symbol,
                actualQuantity,
                setup.takeProfit,
                setup.direction
              );
              log('🎯 Take profit order placed', { tpOrderId, takeProfit: setup.takeProfit });
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
        log('📝 PAPER TRADING - Recording execution without Binance order', {
          walletType: wallet.walletType,
        });
      }

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
        quantity: actualQuantity.toFixed(8),
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
        entryPrice: actualEntryPrice,
        quantity: actualQuantity.toFixed(8),
        positionValue: (actualQuantity * actualEntryPrice).toFixed(2),
        stopLoss: setup.stopLoss,
        takeProfit: setup.takeProfit,
        confidence: setup.confidence,
        isLiveExecution,
        entryOrderId,
      });

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
