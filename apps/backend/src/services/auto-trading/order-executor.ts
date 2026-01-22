import { calculateFibonacciProjection } from '@marketmind/indicators';
import type { Kline, StrategyDefinition, TradingSetup } from '@marketmind/types';
import { getDefaultFee } from '@marketmind/types';
import { and, eq, inArray } from 'drizzle-orm';
import {
  EXIT_REASON,
  PROTECTION_ORDER_RETRY,
  RISK_ALERT_LEVELS,
  RISK_ALERT_TYPES,
  TIME_MS,
  TRADING_CONFIG,
  UNIT_MS,
} from '../../constants';
import { db } from '../../db';
import {
  autoTradingConfig,
  setupDetections,
  tradeExecutions,
  wallets,
  type Wallet,
} from '../../db/schema';
import { env } from '../../env';
import { serializeError } from '../../utils/errors';
import { withRetrySafe } from '../../utils/retry';
import { autoTradingService } from '../auto-trading';
import { createBinanceFuturesClient } from '../binance-client';
import { getOrderEntryFee } from '../binance-futures-client';
import { cooldownService } from '../cooldown';
import { ocoOrderService } from '../oco-orders';
import { positionMonitorService } from '../position-monitor';
import { pyramidingService } from '../pyramiding';
import { riskManagerService } from '../risk-manager';
import { getWebSocketService } from '../websocket';
import type { WatcherLogBuffer } from '../watcher-batch-logger';
import type { ActiveWatcher } from './types';
import { log } from './utils';
import { FilterValidator, type FilterValidatorConfig, type FilterValidatorDeps } from './filter-validator';

export interface OrderExecutorDeps extends FilterValidatorDeps {
  getCachedConfig: (walletId: string, userId?: string) => Promise<typeof autoTradingConfig.$inferSelect | null>;
  getWatcherStatus: (walletId: string) => { active: boolean; watchers: number };
}

export class OrderExecutor {
  private executingSetups: Set<string> = new Set();
  private filterValidator: FilterValidator;

  constructor(private deps: OrderExecutorDeps) {
    this.filterValidator = new FilterValidator(deps);
  }

  async executeSetupSafe(
    watcher: ActiveWatcher,
    setup: TradingSetup,
    strategies: StrategyDefinition[],
    cycleKlines: Kline[],
    logBuffer: WatcherLogBuffer
  ): Promise<boolean> {
    try {
      await this.executeSetup(watcher, setup, strategies, cycleKlines, logBuffer);
      return true;
    } catch (error) {
      logBuffer.error('❌', 'Setup execution failed', {
        setup: setup.type,
        error: serializeError(error),
      });
      return false;
    }
  }

  private async executeSetup(
    watcher: ActiveWatcher,
    setup: TradingSetup,
    strategies: StrategyDefinition[],
    cycleKlines: Kline[],
    logBuffer: WatcherLogBuffer
  ): Promise<void> {
    const executionLockKey = `${watcher.walletId}-${watcher.symbol}-${setup.type}`;

    if (this.executingSetups.has(executionLockKey)) {
      logBuffer.log('⏳', 'Setup execution already in progress, skipping duplicate', {
        type: setup.type,
        symbol: watcher.symbol,
        lockKey: executionLockKey,
      });
      return;
    }

    this.executingSetups.add(executionLockKey);

    try {
      await this.executeSetupInternal(watcher, setup, strategies, cycleKlines, logBuffer);
    } finally {
      this.executingSetups.delete(executionLockKey);
    }
  }

  private getIntervalMs(interval: string): number {
    const match = interval.match(/^(\d+)([mhdw])$/);
    if (!match?.[1] || !match[2]) return 4 * TIME_MS.HOUR;
    const unitMs = UNIT_MS[match[2]];
    if (!unitMs) return 4 * TIME_MS.HOUR;
    return parseInt(match[1]) * unitMs;
  }

  calculateFibonacciTakeProfit(
    klines: Kline[],
    _entryPrice: number,
    direction: 'LONG' | 'SHORT',
    fibonacciTargetLevel: 'auto' | '1' | '1.272' | '1.618' | '2' | '2.618' = '2',
    _interval: string = '4h'
  ): number | null {
    const currentIndex = klines.length - 1;
    const lookback = 100;
    const projection = calculateFibonacciProjection(klines, currentIndex, lookback, direction);

    if (!projection || projection.levels.length === 0) {
      log('⚠️ Fibonacci projection failed', {
        klinesCount: klines.length,
        currentIndex,
        direction,
        hasProjection: !!projection,
        levelsCount: projection?.levels?.length ?? 0,
      });
      return null;
    }

    const targetLevel = fibonacciTargetLevel === 'auto' ? 2 : parseFloat(fibonacciTargetLevel);

    const targetLevelData = projection.levels.find(
      (l) => Math.abs(l.level - targetLevel) < 0.001
    );

    if (targetLevelData) return targetLevelData.price;

    log('⚠️ Target level not found, using 161.8%', {
      targetLevel,
      availableLevels: projection.levels.map(l => l.level),
    });

    const level1618 = projection.levels.find((l) => Math.abs(l.level - 1.618) < 0.001);
    return level1618?.price ?? null;
  }

  private async executeSetupInternal(
    watcher: ActiveWatcher,
    setup: TradingSetup,
    strategies: StrategyDefinition[],
    cycleKlines: Kline[],
    logBuffer: WatcherLogBuffer
  ): Promise<void> {
    logBuffer.log('🚀', 'Attempting to execute setup', {
      type: setup.type,
      direction: setup.direction,
      entryPrice: setup.entryPrice,
    });

    const config = await this.deps.getCachedConfig(watcher.walletId, watcher.userId);

    const tpCalculationMode = config?.tpCalculationMode ?? 'default';
    const fibonacciTargetLevel = config?.fibonacciTargetLevel ?? 'auto';

    logBuffer.log('🎯', 'TP calculation config', {
      tpCalculationMode,
      fibonacciTargetLevel,
      originalTP: setup.takeProfit?.toFixed(6),
    });

    let effectiveTakeProfit = setup.takeProfit;

    if (tpCalculationMode === 'fibonacci') {
      const fibTarget = this.calculateFibonacciTakeProfit(
        cycleKlines,
        setup.entryPrice,
        setup.direction,
        fibonacciTargetLevel,
        watcher.interval
      );

      if (fibTarget !== null) {
        const isValidTarget = setup.direction === 'LONG'
          ? fibTarget > setup.entryPrice
          : fibTarget < setup.entryPrice;

        if (isValidTarget) {
          logBuffer.log('📐', 'Using Fibonacci projection for take profit', {
            originalTP: setup.takeProfit?.toFixed(6),
            fibonacciTP: fibTarget.toFixed(6),
            configLevel: fibonacciTargetLevel,
            direction: setup.direction,
          });
          effectiveTakeProfit = fibTarget;
        } else {
          logBuffer.addRejection({
            setupType: setup.type,
            direction: setup.direction,
            reason: 'Fibonacci target invalid for direction',
            details: {
              fibTarget: fibTarget.toFixed(6),
              entryPrice: setup.entryPrice.toFixed(6),
            },
          });
          logBuffer.warn('🚫', 'Fibonacci target invalid for direction', {
            setup: setup.type,
            direction: setup.direction,
          });
          return;
        }
      } else {
        logBuffer.addRejection({
          setupType: setup.type,
          direction: setup.direction,
          reason: 'No clear trend structure (ranging market)',
          details: {
            klinesCount: cycleKlines.length,
            interval: watcher.interval,
            fibLevel: fibonacciTargetLevel,
          },
        });
        logBuffer.warn('🚫', 'No clear trend structure (ranging market)', {
          setup: setup.type,
          fibLevel: fibonacciTargetLevel,
        });
        return;
      }
    }

    const rrValidation = this.validateRiskReward(setup, effectiveTakeProfit, tpCalculationMode, logBuffer);
    if (!rrValidation.valid) {
      return;
    }

    try {
      if (!config?.isEnabled) {
        logBuffer.warn('⚠️', 'Auto-trading disabled during execution');
        return;
      }

      const effectiveMaxPositionSize = parseFloat(config.maxPositionSize);

      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, watcher.walletId))
        .limit(1);

      if (!wallet) {
        logBuffer.error('❌', 'Wallet not found', { walletId: watcher.walletId });
        return;
      }

      const walletSupportsLive = wallet.walletType === 'live' || wallet.walletType === 'testnet';
      const isLiveExecution = walletSupportsLive && env.ENABLE_LIVE_TRADING;

      const activePositions = await db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, watcher.walletId),
            inArray(tradeExecutions.status, ['open', 'pending'])
          )
        );

      const openPositions = activePositions.filter(p => p.status === 'open');

      const cooldownCheck = await cooldownService.checkCooldown(
        setup.type,
        watcher.symbol,
        watcher.interval,
        watcher.walletId
      );

      if (cooldownCheck.inCooldown) {
        const remainingMs = cooldownCheck.cooldownUntil
          ? cooldownCheck.cooldownUntil.getTime() - Date.now()
          : 0;
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        logBuffer.addRejection({
          setupType: setup.type,
          direction: setup.direction,
          reason: 'Cooldown active',
          details: { remainingMinutes, cooldownReason: cooldownCheck.reason ?? 'N/A' },
        });
        logBuffer.warn('🚫', 'Cooldown active', { setup: setup.type, remainingMinutes });
        return;
      }

      const filterConfig: FilterValidatorConfig = {
        useBtcCorrelationFilter: config.useBtcCorrelationFilter,
        useFundingFilter: config.useFundingFilter,
        useMtfFilter: config.useMtfFilter,
        useMarketRegimeFilter: config.useMarketRegimeFilter,
        useVolumeFilter: config.useVolumeFilter,
        useConfluenceScoring: config.useConfluenceScoring,
        confluenceMinScore: config.confluenceMinScore,
        useStochasticFilter: config.useStochasticFilter,
        useMomentumTimingFilter: config.useMomentumTimingFilter,
        useAdxFilter: config.useAdxFilter,
        useTrendFilter: config.useTrendFilter,
      };

      const filterValidation = await this.filterValidator.validateFilters(
        watcher,
        setup,
        filterConfig,
        cycleKlines,
        strategies,
        logBuffer
      );

      if (!filterValidation.passed) {
        logBuffer.addRejection({
          setupType: setup.type,
          direction: setup.direction,
          reason: filterValidation.rejectionReason ?? 'Filter validation failed',
          details: filterValidation.rejectionDetails as Record<string, string | number | boolean | null> | undefined,
        });
        return;
      }

      const oppositeDirectionPosition = openPositions.find(
        (pos) => pos.symbol === watcher.symbol && pos.side !== setup.direction
      );

      if (oppositeDirectionPosition) {
        logBuffer.addRejection({
          setupType: setup.type,
          direction: setup.direction,
          reason: 'Opposite position exists',
          details: { existingDirection: oppositeDirectionPosition.side },
        });
        logBuffer.warn('🚫', 'Opposite position exists', { setup: setup.type, existingDirection: oppositeDirectionPosition.side });
        return;
      }

      const sameDirectionPositions = openPositions.filter(
        (pos) => pos.symbol === watcher.symbol && pos.side === setup.direction
      );

      if (sameDirectionPositions.length > 0) {
        if (!config.pyramidingEnabled) {
          logBuffer.addRejection({
            setupType: setup.type,
            direction: setup.direction,
            reason: 'Pyramiding disabled',
            details: { existingPositions: sameDirectionPositions.length },
          });
          logBuffer.warn('🚫', 'Pyramiding disabled', { setup: setup.type, existingPositions: sameDirectionPositions.length });
          return;
        }

        const stopLoss = setup.stopLoss ?? null;
        const pyramidEval = await pyramidingService.evaluatePyramidByMode(
          watcher.userId,
          watcher.walletId,
          watcher.symbol,
          setup.direction,
          setup.entryPrice,
          cycleKlines,
          stopLoss,
          setup.confidence ? setup.confidence / 100 : undefined
        );

        if (!pyramidEval.canPyramid) {
          logBuffer.addRejection({
            setupType: setup.type,
            direction: setup.direction,
            reason: pyramidEval.reason ?? 'Cannot pyramid',
            details: {
              currentEntries: pyramidEval.currentEntries,
              maxEntries: pyramidEval.maxEntries,
              mode: pyramidEval.mode ?? 'static',
              adxValue: pyramidEval.adxValue ?? null,
            },
          });
          logBuffer.warn('🚫', pyramidEval.reason ?? 'Cannot pyramid', { setup: setup.type, currentEntries: pyramidEval.currentEntries });
          return;
        }

        logBuffer.log('📈', 'Pyramiding opportunity', {
          currentEntries: pyramidEval.currentEntries,
          suggestedSize: pyramidEval.suggestedSize,
          mode: pyramidEval.mode ?? 'static',
          adxValue: pyramidEval.adxValue ?? null,
          adjustedScaleFactor: pyramidEval.adjustedScaleFactor ?? null,
          fiboLevel: pyramidEval.fiboTriggerLevel ?? null,
        });
      }

      const walletBalance = parseFloat(wallet.currentBalance ?? '0');
      const activeWatchersForWallet = this.deps.getWatcherStatus(watcher.walletId).watchers;

      const dynamicSize = await pyramidingService.calculateDynamicPositionSize(
        watcher.userId,
        watcher.walletId,
        watcher.symbol,
        setup.direction,
        walletBalance,
        setup.entryPrice,
        undefined,
        activeWatchersForWallet > 0 ? activeWatchersForWallet : undefined,
        watcher.marketType
      );

      if (dynamicSize.quantity <= 0) {
        logBuffer.addRejection({
          setupType: setup.type,
          direction: setup.direction,
          reason: 'Zero quantity from sizing',
          details: { reason: dynamicSize.reason },
        });
        logBuffer.warn('🚫', 'Zero quantity from sizing', { setup: setup.type, reason: dynamicSize.reason });
        return;
      }

      const positionValue = dynamicSize.quantity * setup.entryPrice;

      const effectiveConfig = {
        ...config,
        maxPositionSize: effectiveMaxPositionSize.toString(),
        maxConcurrentPositions: activeWatchersForWallet || config.maxConcurrentPositions,
      };

      const riskValidation = await riskManagerService.validateNewPositionLocked(
        watcher.walletId,
        effectiveConfig,
        positionValue,
        activeWatchersForWallet > 0 ? activeWatchersForWallet : undefined
      );

      if (!riskValidation.isValid) {
        logBuffer.addRejection({
          setupType: setup.type,
          direction: setup.direction,
          reason: 'Risk validation failed',
          details: { reason: riskValidation.reason ?? 'Unknown' },
        });
        logBuffer.warn('🚫', 'Risk validation failed', { setup: setup.type, reason: riskValidation.reason ?? 'Unknown' });
        return;
      }

      await this.createAndExecuteTrade(
        watcher,
        setup,
        effectiveTakeProfit,
        wallet,
        config,
        dynamicSize,
        isLiveExecution,
        logBuffer
      );
    } catch (error) {
      logBuffer.error('❌', 'Error executing setup', {
        type: setup.type,
        error: serializeError(error),
      });
    }
  }

  private validateRiskReward(
    setup: TradingSetup,
    effectiveTakeProfit: number | undefined,
    tpCalculationMode: string,
    logBuffer: WatcherLogBuffer
  ): { valid: boolean } {
    if (setup.stopLoss && effectiveTakeProfit) {
      const entryPrice = setup.entryPrice;
      const stopLoss = setup.stopLoss;
      const takeProfit = effectiveTakeProfit;

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
        logBuffer.addRejection({
          setupType: setup.type,
          direction: setup.direction,
          reason: 'Invalid stop loss - no risk',
          details: { entryPrice, stopLoss },
        });
        logBuffer.warn('🚫', 'Invalid stop loss - no risk', {
          setup: setup.type,
          direction: setup.direction,
        });
        return { valid: false };
      }

      const riskRewardRatio = reward / risk;

      if (riskRewardRatio < TRADING_CONFIG.MIN_RISK_REWARD_RATIO) {
        const usingFibonacci = tpCalculationMode === 'fibonacci' && effectiveTakeProfit !== setup.takeProfit;
        const reason = usingFibonacci ? 'Insufficient R:R (Fibonacci TP)' : 'Insufficient R:R ratio';
        logBuffer.addRejection({
          setupType: setup.type,
          direction: setup.direction,
          reason,
          details: {
            riskReward: riskRewardRatio.toFixed(2),
            minRequired: TRADING_CONFIG.MIN_RISK_REWARD_RATIO,
            tpMode: tpCalculationMode,
            takeProfit: takeProfit.toFixed(4),
            entryPrice: entryPrice.toFixed(4),
          },
        });
        logBuffer.warn('🚫', reason, {
          setup: setup.type,
          rr: riskRewardRatio.toFixed(2),
          minRR: TRADING_CONFIG.MIN_RISK_REWARD_RATIO,
        });
        return { valid: false };
      }

      logBuffer.log('✅', 'Risk/Reward ratio validated', {
        riskRewardRatio: riskRewardRatio.toFixed(2),
      });
    } else if (!setup.stopLoss) {
      logBuffer.addRejection({
        setupType: setup.type,
        direction: setup.direction,
        reason: 'Missing stop loss',
      });
      logBuffer.warn('🚫', 'Missing stop loss', { setup: setup.type, direction: setup.direction });
      return { valid: false };
    } else {
      logBuffer.log('ℹ️', 'Setup without take profit - skipping R:R validation');
    }

    return { valid: true };
  }

  private async createAndExecuteTrade(
    watcher: ActiveWatcher,
    setup: TradingSetup,
    effectiveTakeProfit: number | undefined,
    wallet: Wallet,
    config: typeof autoTradingConfig.$inferSelect,
    dynamicSize: { quantity: number; sizePercent: number; reason?: string },
    isLiveExecution: boolean,
    logBuffer: WatcherLogBuffer
  ): Promise<void> {
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
    const quantityFormatted = dynamicSize.quantity.toFixed(8);
    const walletBalance = parseFloat(wallet.currentBalance ?? '0');
    const positionValue = dynamicSize.quantity * setup.entryPrice;

    log('📐 Final position size', {
      positionValue: positionValue.toFixed(2),
      entryPrice: setup.entryPrice,
      quantity: quantityFormatted,
      walletBalance: walletBalance.toFixed(2),
      sizePercent: dynamicSize.sizePercent.toFixed(2),
    });

    const SLIPPAGE_PERCENT = 0.1;
    const commissionRate = getDefaultFee(watcher.marketType ?? 'SPOT', 'TAKER');
    const COMMISSION_PERCENT = commissionRate * 100;
    const slippageFactor = setup.direction === 'LONG' ? (1 + SLIPPAGE_PERCENT / 100) : (1 - SLIPPAGE_PERCENT / 100);
    const expectedEntryWithSlippage = setup.entryPrice * slippageFactor;

    let entryOrderId: number | null = null;
    let actualEntryPrice = isLiveExecution ? setup.entryPrice : expectedEntryWithSlippage;
    let actualQuantity = dynamicSize.quantity;
    let actualEntryFee: number | null = null;
    let stopLossOrderId: number | null = null;
    let takeProfitOrderId: number | null = null;
    let stopLossAlgoId: number | null = null;
    let takeProfitAlgoId: number | null = null;
    let stopLossIsAlgo = false;
    let takeProfitIsAlgo = false;
    let orderListId: number | null = null;

    if (isLiveExecution) {
      log('💸 Live execution - will use actual fill price from Binance', {
        setupEntry: setup.entryPrice,
        commissionPercent: COMMISSION_PERCENT,
        direction: setup.direction,
      });
    } else {
      log('💸 Paper trading - entry price adjusted for simulated slippage', {
        originalEntry: setup.entryPrice,
        expectedEntry: expectedEntryWithSlippage,
        slippagePercent: SLIPPAGE_PERCENT,
        commissionPercent: COMMISSION_PERCENT,
        direction: setup.direction,
      });
    }

    const useLimit = false;
    const orderType = 'MARKET' as const;

    if (isLiveExecution) {
      const liveResult = await this.executeLiveOrder(
        watcher,
        setup,
        effectiveTakeProfit,
        wallet,
        config,
        dynamicSize,
        executionId,
        setupId,
        orderType,
        useLimit,
        logBuffer
      );

      if (!liveResult) return;

      entryOrderId = liveResult.entryOrderId;
      actualEntryPrice = liveResult.actualEntryPrice;
      actualQuantity = liveResult.actualQuantity;
      actualEntryFee = liveResult.actualEntryFee;
      stopLossOrderId = liveResult.stopLossOrderId;
      takeProfitOrderId = liveResult.takeProfitOrderId;
      stopLossAlgoId = liveResult.stopLossAlgoId;
      takeProfitAlgoId = liveResult.takeProfitAlgoId;
      stopLossIsAlgo = liveResult.stopLossIsAlgo;
      takeProfitIsAlgo = liveResult.takeProfitIsAlgo;
      orderListId = liveResult.orderListId;
    } else {
      const paperResult = await this.executePaperOrder(
        watcher,
        setup,
        effectiveTakeProfit,
        wallet,
        dynamicSize,
        executionId,
        setupId,
        useLimit,
        expectedEntryWithSlippage,
        logBuffer
      );

      if (!paperResult) return;

      actualEntryPrice = paperResult.actualEntryPrice;
      actualQuantity = paperResult.actualQuantity;
    }

    if (setup.stopLoss && effectiveTakeProfit) {
      let risk: number;
      let reward: number;

      if (setup.direction === 'LONG') {
        risk = actualEntryPrice - setup.stopLoss;
        reward = effectiveTakeProfit - actualEntryPrice;
      } else {
        risk = setup.stopLoss - actualEntryPrice;
        reward = actualEntryPrice - effectiveTakeProfit;
      }

      if (risk <= 0) {
        logBuffer.addRejection({
          setupType: setup.type,
          direction: setup.direction,
          reason: 'Invalid SL after slippage',
          details: { actualEntry: actualEntryPrice.toFixed(4), stopLoss: setup.stopLoss },
        });
        logBuffer.warn('🚫', 'Invalid SL after slippage', { setup: setup.type, actualEntry: actualEntryPrice.toFixed(4) });
        return;
      }

      const finalRiskRewardRatio = reward / risk;

      if (finalRiskRewardRatio < TRADING_CONFIG.MIN_RISK_REWARD_RATIO) {
        logBuffer.addRejection({
          setupType: setup.type,
          direction: setup.direction,
          reason: 'R:R too low after slippage',
          details: {
            finalRR: finalRiskRewardRatio.toFixed(2),
            minRequired: TRADING_CONFIG.MIN_RISK_REWARD_RATIO,
          },
        });
        logBuffer.warn('🚫', 'R:R too low after slippage', { setup: setup.type, finalRR: finalRiskRewardRatio.toFixed(2) });
        return;
      }
    }

    try {
      const triggerCandle = setup.triggerCandleData?.find(c => c.offset === 0);
      const openedAtDate = new Date();
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
        entryFee: actualEntryFee?.toString(),
        stopLossOrderId,
        takeProfitOrderId,
        stopLossAlgoId,
        takeProfitAlgoId,
        stopLossIsAlgo,
        takeProfitIsAlgo,
        orderListId,
        quantity: actualQuantity.toFixed(8),
        stopLoss: setup.stopLoss?.toString(),
        takeProfit: effectiveTakeProfit?.toString(),
        openedAt: openedAtDate,
        status: 'open',
        entryOrderType: useLimit ? 'LIMIT' : 'MARKET',
        marketType: watcher.marketType,
        leverage: config.leverage ?? 1,
        entryInterval: watcher.interval,
        originalStopLoss: setup.stopLoss?.toString(),
        highestPriceSinceEntry: actualEntryPrice.toString(),
        lowestPriceSinceEntry: actualEntryPrice.toString(),
        triggerKlineIndex: setup.triggerKlineIndex,
        triggerKlineOpenTime: triggerCandle?.openTime,
        triggerCandleData: setup.triggerCandleData ? JSON.stringify(setup.triggerCandleData) : null,
        triggerIndicatorValues: setup.triggerIndicatorValues ? JSON.stringify(setup.triggerIndicatorValues) : null,
        fibonacciProjection: setup.fibonacciProjection ? JSON.stringify(setup.fibonacciProjection) : null,
      });

      logBuffer.addTradeExecution({
        setupType: setup.type,
        direction: setup.direction,
        entryPrice: actualEntryPrice.toFixed(6),
        quantity: actualQuantity.toFixed(8),
        stopLoss: setup.stopLoss?.toFixed(6),
        takeProfit: effectiveTakeProfit?.toFixed(6),
        orderType: useLimit ? 'LIMIT' : 'MARKET',
        status: 'executed',
      });

      const wsServiceOpen = getWebSocketService();
      if (wsServiceOpen) {
        wsServiceOpen.emitPositionUpdate(watcher.walletId, {
          id: executionId,
          symbol: watcher.symbol,
          side: setup.direction,
          status: 'open',
          entryPrice: actualEntryPrice.toString(),
          quantity: actualQuantity.toFixed(8),
          stopLoss: setup.stopLoss?.toString(),
          takeProfit: effectiveTakeProfit?.toString(),
          setupType: setup.type,
          fibonacciProjection: setup.fibonacciProjection,
        });
      }
    } catch (dbError) {
      logBuffer.error('❌', 'Failed to insert trade execution', {
        executionId,
        error: serializeError(dbError),
      });
      throw dbError;
    }

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
    } catch {
    }

    await positionMonitorService.invalidatePriceCache(watcher.symbol);
  }

  private async executeLiveOrder(
    watcher: ActiveWatcher,
    setup: TradingSetup,
    effectiveTakeProfit: number | undefined,
    wallet: Wallet,
    config: typeof autoTradingConfig.$inferSelect,
    dynamicSize: { quantity: number; sizePercent: number; reason?: string },
    executionId: string,
    setupId: string,
    orderType: 'MARKET',
    useLimit: boolean,
    _logBuffer: WatcherLogBuffer
  ): Promise<{
    entryOrderId: number | null;
    actualEntryPrice: number;
    actualQuantity: number;
    actualEntryFee: number | null;
    stopLossOrderId: number | null;
    takeProfitOrderId: number | null;
    stopLossAlgoId: number | null;
    takeProfitAlgoId: number | null;
    stopLossIsAlgo: boolean;
    takeProfitIsAlgo: boolean;
    orderListId: number | null;
  } | null> {
    let entryOrderId: number | null = null;
    let actualEntryPrice = setup.entryPrice;
    let actualQuantity = dynamicSize.quantity;
    let actualEntryFee: number | null = null;
    let stopLossOrderId: number | null = null;
    let takeProfitOrderId: number | null = null;
    let stopLossAlgoId: number | null = null;
    let takeProfitAlgoId: number | null = null;
    let stopLossIsAlgo = false;
    let takeProfitIsAlgo = false;
    let orderListId: number | null = null;

    if (watcher.marketType === 'FUTURES') {
      try {
        const configLeverage = config.leverage ?? 1;
        const configMarginType = config.marginType ?? 'ISOLATED';

        await autoTradingService.setFuturesLeverage(
          wallet,
          watcher.symbol,
          configLeverage
        );

        await autoTradingService.setFuturesMarginType(
          wallet,
          watcher.symbol,
          configMarginType
        );

        log('⚙️ Futures leverage/margin configured', {
          symbol: watcher.symbol,
          leverage: configLeverage,
          marginType: configMarginType,
        });
      } catch (leverageError) {
        const errorMsg = serializeError(leverageError);
        const isBenignError = errorMsg.includes('No need to change') ||
          errorMsg.includes('leverage not changed') ||
          errorMsg.includes('already set');

        if (isBenignError) {
          log('⚙️ Futures leverage/margin already configured (skipping)', {
            symbol: watcher.symbol,
            message: errorMsg,
          });
        } else {
          log('❌ Failed to configure leverage/margin, aborting entry', {
            error: errorMsg,
          });
          return null;
        }
      }
    }

    log(`🔴 LIVE EXECUTION - Placing ${orderType} order on Binance`, {
      walletType: wallet.walletType,
      symbol: watcher.symbol,
      side: setup.direction === 'LONG' ? 'BUY' : 'SELL',
      quantity: dynamicSize.quantity.toFixed(8),
      orderType,
      limitPrice: useLimit ? setup.limitEntryPrice : undefined,
    });

    try {
      const configLeverageForQty = config.leverage ?? 1;
      const adjustedQuantity = watcher.marketType === 'FUTURES'
        ? dynamicSize.quantity / configLeverageForQty
        : dynamicSize.quantity;

      if (watcher.marketType === 'FUTURES') {
        log('📊 Quantity adjusted for leverage', {
          originalQuantity: dynamicSize.quantity,
          adjustedQuantity,
          leverage: configLeverageForQty,
        });
      }

      const orderResult = await autoTradingService.executeBinanceOrder(
        wallet,
        {
          symbol: watcher.symbol,
          side: setup.direction === 'LONG' ? 'BUY' : 'SELL',
          type: orderType,
          quantity: adjustedQuantity,
          price: useLimit ? setup.limitEntryPrice : undefined,
          timeInForce: useLimit ? 'GTC' : undefined,
        },
        watcher.marketType
      );

      entryOrderId = orderResult.orderId;
      actualEntryPrice = parseFloat(orderResult.price) || setup.entryPrice;
      actualQuantity = parseFloat(orderResult.executedQty) || adjustedQuantity;

      const orderFilled = parseFloat(orderResult.executedQty) > 0;

      log('✅ Binance order executed', {
        orderId: entryOrderId,
        executedQty: orderResult.executedQty,
        price: orderResult.price,
        orderType,
        filled: orderFilled,
      });

      if (!orderFilled) {
        log('⚠️ MARKET order not filled (executedQty=0) - aborting trade creation', {
          orderId: entryOrderId,
          symbol: watcher.symbol,
          orderType,
          executedQty: orderResult.executedQty,
        });
        return null;
      }

      if (orderFilled && entryOrderId && watcher.marketType === 'FUTURES') {
        try {
          const client = createBinanceFuturesClient(wallet);
          const feeResult = await getOrderEntryFee(client, watcher.symbol, entryOrderId);
          if (feeResult) {
            actualEntryFee = feeResult.entryFee;
            if (feeResult.avgPrice > 0) {
              actualEntryPrice = feeResult.avgPrice;
            }
            log('💰 Entry fee captured from Binance', {
              entryOrderId,
              entryFee: actualEntryFee,
              avgPrice: feeResult.avgPrice,
            });
          }
        } catch (feeError) {
          log('⚠️ Failed to fetch entry fee, will be captured on close', {
            entryOrderId,
            error: serializeError(feeError),
          });
        }
      }

      if (orderFilled && setup.stopLoss && effectiveTakeProfit) {
        const protectionResult = await this.placeProtectionOrders(
          watcher,
          setup,
          effectiveTakeProfit,
          wallet,
          actualQuantity
        );

        stopLossOrderId = protectionResult.stopLossOrderId;
        takeProfitOrderId = protectionResult.takeProfitOrderId;
        stopLossAlgoId = protectionResult.stopLossAlgoId;
        takeProfitAlgoId = protectionResult.takeProfitAlgoId;
        stopLossIsAlgo = protectionResult.stopLossIsAlgo;
        takeProfitIsAlgo = protectionResult.takeProfitIsAlgo;
        orderListId = protectionResult.orderListId;

        const hasStopLossProtection = stopLossOrderId !== null || stopLossAlgoId !== null;
        if (!hasStopLossProtection && entryOrderId !== null && orderFilled) {
          const compensationResult = await this.handleFailedProtection(
            watcher,
            setup,
            effectiveTakeProfit,
            wallet,
            actualEntryPrice,
            actualQuantity,
            executionId,
            setupId,
            entryOrderId
          );
          if (compensationResult.shouldReturn) return null;
        }
      } else if (orderFilled && setup.stopLoss) {
        const slResult = await this.placeSingleStopLoss(
          wallet,
          watcher,
          setup,
          actualQuantity
        );

        stopLossOrderId = slResult.stopLossOrderId;
        stopLossAlgoId = slResult.stopLossAlgoId;
        stopLossIsAlgo = slResult.stopLossIsAlgo;

        const hasStopLossProtection = stopLossOrderId !== null || stopLossAlgoId !== null;
        if (!hasStopLossProtection && entryOrderId !== null && orderFilled) {
          const compensationResult = await this.handleFailedProtection(
            watcher,
            setup,
            effectiveTakeProfit,
            wallet,
            actualEntryPrice,
            actualQuantity,
            executionId,
            setupId,
            entryOrderId
          );
          if (compensationResult.shouldReturn) return null;
        }
      }
    } catch (orderError) {
      log('❌ Failed to execute Binance order', {
        error: serializeError(orderError),
      });
      return null;
    }

    return {
      entryOrderId,
      actualEntryPrice,
      actualQuantity,
      actualEntryFee,
      stopLossOrderId,
      takeProfitOrderId,
      stopLossAlgoId,
      takeProfitAlgoId,
      stopLossIsAlgo,
      takeProfitIsAlgo,
      orderListId,
    };
  }

  private async executePaperOrder(
    watcher: ActiveWatcher,
    setup: TradingSetup,
    effectiveTakeProfit: number | undefined,
    wallet: Wallet,
    dynamicSize: { quantity: number; sizePercent: number; reason?: string },
    executionId: string,
    setupId: string,
    useLimit: boolean,
    expectedEntryWithSlippage: number,
    _logBuffer: WatcherLogBuffer
  ): Promise<{ actualEntryPrice: number; actualQuantity: number } | null> {
    let actualEntryPrice = expectedEntryWithSlippage;
    const actualQuantity = dynamicSize.quantity;

    try {
      const currentMarketPrice = await positionMonitorService.getCurrentPrice(watcher.symbol, watcher.marketType);

      if (useLimit && setup.limitEntryPrice) {
        const wouldLimitFill = setup.direction === 'LONG'
          ? currentMarketPrice && currentMarketPrice <= setup.limitEntryPrice
          : currentMarketPrice && currentMarketPrice >= setup.limitEntryPrice;

        if (!wouldLimitFill) {
          log('📋 PAPER TRADING - Creating PENDING limit order', {
            walletType: wallet.walletType,
            direction: setup.direction,
            limitEntryPrice: setup.limitEntryPrice,
            currentMarketPrice,
            reason: setup.direction === 'LONG'
              ? `Waiting for price to drop to ${setup.limitEntryPrice} (pullback)`
              : `Waiting for price to rise to ${setup.limitEntryPrice} (bounce)`,
          });

          const expirationBars = setup.expirationBars ?? 3;
          const intervalMs = this.getIntervalMs(watcher.interval);
          const expiresAt = new Date(Date.now() + (expirationBars * intervalMs));

          try {
            const triggerCandle = setup.triggerCandleData?.find(c => c.offset === 0);
            const openedAtDate = new Date();
            await db.insert(tradeExecutions).values({
              id: executionId,
              userId: watcher.userId,
              walletId: watcher.walletId,
              setupId,
              setupType: setup.type,
              symbol: watcher.symbol,
              side: setup.direction,
              entryPrice: setup.limitEntryPrice.toString(),
              quantity: actualQuantity.toFixed(8),
              stopLoss: setup.stopLoss?.toString(),
              takeProfit: effectiveTakeProfit?.toString(),
              openedAt: openedAtDate,
              status: 'pending',
              entryOrderType: 'LIMIT',
              limitEntryPrice: setup.limitEntryPrice.toString(),
              expiresAt,
              marketType: watcher.marketType,
              entryInterval: watcher.interval,
              originalStopLoss: setup.stopLoss?.toString(),
              highestPriceSinceEntry: setup.limitEntryPrice.toString(),
              lowestPriceSinceEntry: setup.limitEntryPrice.toString(),
              triggerKlineIndex: setup.triggerKlineIndex,
              triggerKlineOpenTime: triggerCandle?.openTime,
              triggerCandleData: setup.triggerCandleData ? JSON.stringify(setup.triggerCandleData) : null,
              triggerIndicatorValues: setup.triggerIndicatorValues ? JSON.stringify(setup.triggerIndicatorValues) : null,
              fibonacciProjection: setup.fibonacciProjection ? JSON.stringify(setup.fibonacciProjection) : null,
            });

            log('✅ PENDING order created - waiting for price to reach limit', {
              executionId,
              limitEntryPrice: setup.limitEntryPrice,
              currentMarketPrice,
              expiresAt: expiresAt.toISOString(),
              expirationBars,
            });

            const wsService = getWebSocketService();
            if (wsService) {
              wsService.emitPositionUpdate(watcher.walletId, {
                id: executionId,
                symbol: watcher.symbol,
                side: setup.direction,
                status: 'pending',
                entryPrice: setup.limitEntryPrice.toString(),
                limitEntryPrice: setup.limitEntryPrice.toString(),
                quantity: actualQuantity.toFixed(8),
                stopLoss: setup.stopLoss?.toString(),
                takeProfit: effectiveTakeProfit?.toString(),
                setupType: setup.type,
                expiresAt: expiresAt.toISOString(),
                fibonacciProjection: setup.fibonacciProjection,
              });
            }

            await cooldownService.setCooldown(
              setup.type,
              watcher.symbol,
              watcher.interval,
              watcher.walletId,
              executionId,
              15,
              'Pending order created'
            );
          } catch (pendingError) {
            log('❌ Failed to create pending order', {
              error: serializeError(pendingError),
            });
          }

          return null;
        }

        actualEntryPrice = currentMarketPrice || setup.limitEntryPrice;
        log('📝 PAPER TRADING - LIMIT order filled immediately at market price', {
          walletType: wallet.walletType,
          direction: setup.direction,
          setupClosePrice: setup.entryPrice,
          limitEntryPrice: setup.limitEntryPrice,
          actualFillPrice: actualEntryPrice,
          orderType: 'LIMIT',
        });
      } else {
        log('📝 PAPER TRADING - Using current market price', {
          walletType: wallet.walletType,
          setupPrice: setup.entryPrice,
          orderType: 'MARKET',
        });

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
      }
    } catch (priceError) {
      log('⚠️ Failed to get market price, using setup price with slippage', {
        error: serializeError(priceError),
      });
    }

    return { actualEntryPrice, actualQuantity };
  }

  private async placeProtectionOrders(
    watcher: ActiveWatcher,
    setup: TradingSetup,
    effectiveTakeProfit: number,
    wallet: Wallet,
    actualQuantity: number
  ): Promise<{
    stopLossOrderId: number | null;
    takeProfitOrderId: number | null;
    stopLossAlgoId: number | null;
    takeProfitAlgoId: number | null;
    stopLossIsAlgo: boolean;
    takeProfitIsAlgo: boolean;
    orderListId: number | null;
  }> {
    let stopLossOrderId: number | null = null;
    let takeProfitOrderId: number | null = null;
    let stopLossAlgoId: number | null = null;
    let takeProfitAlgoId: number | null = null;
    let stopLossIsAlgo = false;
    let takeProfitIsAlgo = false;
    let orderListId: number | null = null;

    const useSeparateOrders = watcher.marketType === 'FUTURES';

    if (useSeparateOrders) {
      log('📊 FUTURES market - using separate SL/TP orders (OCO not supported)', {
        symbol: watcher.symbol,
        marketType: watcher.marketType,
        stopLoss: setup.stopLoss,
        takeProfit: effectiveTakeProfit,
      });

      const slRetryResult = await withRetrySafe(
        () => autoTradingService.createStopLossOrder(
          wallet,
          watcher.symbol,
          actualQuantity,
          setup.stopLoss!,
          setup.direction,
          watcher.marketType
        ),
        { maxRetries: PROTECTION_ORDER_RETRY.MAX_ATTEMPTS, initialDelayMs: PROTECTION_ORDER_RETRY.INITIAL_DELAY_MS }
      );

      if (slRetryResult.success) {
        const slResult = slRetryResult.result;
        stopLossIsAlgo = slResult.isAlgoOrder;
        if (slResult.isAlgoOrder) {
          stopLossAlgoId = slResult.algoId;
        } else {
          stopLossOrderId = slResult.orderId;
        }
        log('🛡️ FUTURES stop loss order placed', {
          stopLossOrderId,
          stopLossAlgoId,
          stopLoss: setup.stopLoss,
          isAlgoOrder: slResult.isAlgoOrder,
        });
      } else {
        log('❌ FUTURES: Failed to place stop loss order after retries', {
          error: serializeError(slRetryResult.lastError),
          stopLoss: setup.stopLoss,
          quantity: actualQuantity,
        });
      }

      const tpRetryResult = await withRetrySafe(
        () => autoTradingService.createTakeProfitOrder(
          wallet,
          watcher.symbol,
          actualQuantity,
          effectiveTakeProfit,
          setup.direction,
          watcher.marketType
        ),
        { maxRetries: PROTECTION_ORDER_RETRY.MAX_ATTEMPTS, initialDelayMs: PROTECTION_ORDER_RETRY.INITIAL_DELAY_MS }
      );

      if (tpRetryResult.success) {
        const tpResult = tpRetryResult.result;
        takeProfitIsAlgo = tpResult.isAlgoOrder;
        if (tpResult.isAlgoOrder) {
          takeProfitAlgoId = tpResult.algoId;
        } else {
          takeProfitOrderId = tpResult.orderId;
        }
        log('🎯 FUTURES take profit order placed', {
          takeProfitOrderId,
          takeProfitAlgoId,
          takeProfit: effectiveTakeProfit,
          isAlgoOrder: tpResult.isAlgoOrder,
        });
      } else {
        log('❌ FUTURES: Failed to place take profit order after retries', {
          error: serializeError(tpRetryResult.lastError),
          takeProfit: effectiveTakeProfit,
          quantity: actualQuantity,
        });
      }

      const hasSL = stopLossOrderId !== null || stopLossAlgoId !== null;
      const hasTP = takeProfitOrderId !== null || takeProfitAlgoId !== null;

      if (!hasSL || !hasTP) {
        log('🚨 CRITICAL: Incomplete protection orders - emitting alert', {
          symbol: watcher.symbol,
          hasSL,
          hasTP,
          stopLossAlgoId,
          takeProfitAlgoId,
        });

        const wsServiceProtection = getWebSocketService();
        if (wsServiceProtection) {
          wsServiceProtection.emitRiskAlert(watcher.walletId, {
            type: 'ORDER_REJECTED',
            level: 'critical',
            symbol: watcher.symbol,
            message: `CRITICAL: Position ${watcher.symbol} ${setup.direction} has incomplete protection. SL: ${hasSL ? 'OK' : 'MISSING'}, TP: ${hasTP ? 'OK' : 'MISSING'}. Please add missing orders manually!`,
            data: {
              reason: 'incomplete_protection_orders',
              side: setup.direction,
              hasSL,
              hasTP,
              stopLossAlgoId,
              takeProfitAlgoId,
            },
            timestamp: Date.now(),
          });
        }
      }
    } else {
      try {
        const ocoResult = await ocoOrderService.createExitOCO(
          wallet,
          watcher.symbol,
          actualQuantity,
          setup.stopLoss!,
          effectiveTakeProfit,
          setup.direction
        );

        if (ocoResult) {
          orderListId = ocoResult.orderListId;
          stopLossOrderId = ocoResult.stopLossOrderId;
          takeProfitOrderId = ocoResult.takeProfitOrderId;
          log('✅ OCO exit orders placed', {
            orderListId,
            stopLossOrderId,
            takeProfitOrderId,
            stopLoss: setup.stopLoss,
            takeProfit: effectiveTakeProfit,
          });
        } else {
          log('⚠️ OCO placement returned null, falling back to separate orders');
        }

        if (!orderListId) {
          const fallbackResult = await this.placeFallbackProtectionOrders(
            wallet,
            watcher,
            setup,
            effectiveTakeProfit,
            actualQuantity
          );

          stopLossOrderId = fallbackResult.stopLossOrderId;
          takeProfitOrderId = fallbackResult.takeProfitOrderId;
          stopLossAlgoId = fallbackResult.stopLossAlgoId;
          takeProfitAlgoId = fallbackResult.takeProfitAlgoId;
          stopLossIsAlgo = fallbackResult.stopLossIsAlgo;
          takeProfitIsAlgo = fallbackResult.takeProfitIsAlgo;
        }
      } catch (ocoError) {
        log('⚠️ Failed to place OCO exit orders, falling back to separate orders', {
          error: serializeError(ocoError),
        });

        const fallbackResult = await this.placeFallbackProtectionOrders(
          wallet,
          watcher,
          setup,
          effectiveTakeProfit,
          actualQuantity
        );

        stopLossOrderId = fallbackResult.stopLossOrderId;
        takeProfitOrderId = fallbackResult.takeProfitOrderId;
        stopLossAlgoId = fallbackResult.stopLossAlgoId;
        takeProfitAlgoId = fallbackResult.takeProfitAlgoId;
        stopLossIsAlgo = fallbackResult.stopLossIsAlgo;
        takeProfitIsAlgo = fallbackResult.takeProfitIsAlgo;
      }
    }

    return {
      stopLossOrderId,
      takeProfitOrderId,
      stopLossAlgoId,
      takeProfitAlgoId,
      stopLossIsAlgo,
      takeProfitIsAlgo,
      orderListId,
    };
  }

  private async placeFallbackProtectionOrders(
    wallet: Wallet,
    watcher: ActiveWatcher,
    setup: TradingSetup,
    effectiveTakeProfit: number,
    actualQuantity: number
  ): Promise<{
    stopLossOrderId: number | null;
    takeProfitOrderId: number | null;
    stopLossAlgoId: number | null;
    takeProfitAlgoId: number | null;
    stopLossIsAlgo: boolean;
    takeProfitIsAlgo: boolean;
  }> {
    let stopLossOrderId: number | null = null;
    let takeProfitOrderId: number | null = null;
    let stopLossAlgoId: number | null = null;
    let takeProfitAlgoId: number | null = null;
    let stopLossIsAlgo = false;
    let takeProfitIsAlgo = false;

    const slFallbackResult = await withRetrySafe(
      () => autoTradingService.createStopLossOrder(
        wallet,
        watcher.symbol,
        actualQuantity,
        setup.stopLoss!,
        setup.direction,
        watcher.marketType
      ),
      { maxRetries: PROTECTION_ORDER_RETRY.MAX_ATTEMPTS, initialDelayMs: PROTECTION_ORDER_RETRY.INITIAL_DELAY_MS }
    );

    if (slFallbackResult.success) {
      const slResult = slFallbackResult.result;
      stopLossIsAlgo = slResult.isAlgoOrder;
      if (slResult.isAlgoOrder) {
        stopLossAlgoId = slResult.algoId;
      } else {
        stopLossOrderId = slResult.orderId;
      }
      log('🛡️ Stop loss order placed (fallback)', { stopLossOrderId, stopLossAlgoId, isAlgoOrder: slResult.isAlgoOrder });
    } else {
      log('⚠️ Failed to place stop loss order (fallback) after retries', {
        error: serializeError(slFallbackResult.lastError),
      });
    }

    const tpFallbackResult = await withRetrySafe(
      () => autoTradingService.createTakeProfitOrder(
        wallet,
        watcher.symbol,
        actualQuantity,
        effectiveTakeProfit,
        setup.direction,
        watcher.marketType
      ),
      { maxRetries: PROTECTION_ORDER_RETRY.MAX_ATTEMPTS, initialDelayMs: PROTECTION_ORDER_RETRY.INITIAL_DELAY_MS }
    );

    if (tpFallbackResult.success) {
      const tpResult = tpFallbackResult.result;
      takeProfitIsAlgo = tpResult.isAlgoOrder;
      if (tpResult.isAlgoOrder) {
        takeProfitAlgoId = tpResult.algoId;
      } else {
        takeProfitOrderId = tpResult.orderId;
      }
      log('🎯 Take profit order placed (fallback)', { takeProfitOrderId, takeProfitAlgoId, isAlgoOrder: tpResult.isAlgoOrder });
    } else {
      log('⚠️ Failed to place take profit order (fallback) after retries', {
        error: serializeError(tpFallbackResult.lastError),
      });
    }

    return {
      stopLossOrderId,
      takeProfitOrderId,
      stopLossAlgoId,
      takeProfitAlgoId,
      stopLossIsAlgo,
      takeProfitIsAlgo,
    };
  }

  private async placeSingleStopLoss(
    wallet: Wallet,
    watcher: ActiveWatcher,
    setup: TradingSetup,
    actualQuantity: number
  ): Promise<{
    stopLossOrderId: number | null;
    stopLossAlgoId: number | null;
    stopLossIsAlgo: boolean;
  }> {
    let stopLossOrderId: number | null = null;
    let stopLossAlgoId: number | null = null;
    let stopLossIsAlgo = false;

    const slOnlyResult = await withRetrySafe(
      () => autoTradingService.createStopLossOrder(
        wallet,
        watcher.symbol,
        actualQuantity,
        setup.stopLoss!,
        setup.direction,
        watcher.marketType
      ),
      { maxRetries: PROTECTION_ORDER_RETRY.MAX_ATTEMPTS, initialDelayMs: PROTECTION_ORDER_RETRY.INITIAL_DELAY_MS }
    );

    if (slOnlyResult.success) {
      const slResult = slOnlyResult.result;
      stopLossIsAlgo = slResult.isAlgoOrder;
      if (slResult.isAlgoOrder) {
        stopLossAlgoId = slResult.algoId;
      } else {
        stopLossOrderId = slResult.orderId;
      }
      log('🛡️ Stop loss order placed (no TP)', { stopLossOrderId, stopLossAlgoId, stopLoss: setup.stopLoss, isAlgoOrder: slResult.isAlgoOrder });
    } else {
      log('⚠️ Failed to place stop loss order after retries', {
        error: serializeError(slOnlyResult.lastError),
      });
    }

    return { stopLossOrderId, stopLossAlgoId, stopLossIsAlgo };
  }

  private async handleFailedProtection(
    watcher: ActiveWatcher,
    setup: TradingSetup,
    effectiveTakeProfit: number | undefined,
    wallet: Wallet,
    actualEntryPrice: number,
    actualQuantity: number,
    executionId: string,
    setupId: string,
    entryOrderId: number
  ): Promise<{ shouldReturn: boolean }> {
    log('🚨 CRITICAL: SL creation failed - attempting to close entry position', {
      executionId,
      symbol: watcher.symbol,
      side: setup.direction,
      entryPrice: actualEntryPrice,
      quantity: actualQuantity,
      marketType: watcher.marketType,
    });

    try {
      const closeSide = setup.direction === 'LONG' ? 'SELL' : 'BUY';
      const closeResult = await autoTradingService.closePosition(
        wallet,
        watcher.symbol,
        actualQuantity,
        closeSide,
        watcher.marketType
      );

      if (closeResult) {
        log('✅ Compensation successful - position closed', {
          closeOrderId: closeResult.orderId,
          avgPrice: closeResult.avgPrice,
          entryPrice: actualEntryPrice,
        });

        const wsServiceCompensation = getWebSocketService();
        wsServiceCompensation?.emitRiskAlert(watcher.walletId, {
          type: RISK_ALERT_TYPES.ORDER_REJECTED,
          level: RISK_ALERT_LEVELS.WARNING,
          symbol: watcher.symbol,
          message: `Position ${watcher.symbol} was closed due to failed SL creation. Entry: ${actualEntryPrice}, Exit: ${closeResult.avgPrice}`,
          data: {
            reason: 'sl_creation_failed_compensation',
            side: setup.direction,
            entryPrice: actualEntryPrice.toString(),
            exitPrice: closeResult.avgPrice.toString(),
          },
          timestamp: Date.now(),
        });

        await db.insert(tradeExecutions).values({
          id: executionId,
          userId: watcher.userId,
          walletId: watcher.walletId,
          setupId,
          setupType: setup.type,
          symbol: watcher.symbol,
          side: setup.direction,
          entryPrice: actualEntryPrice.toString(),
          quantity: actualQuantity.toFixed(8),
          stopLoss: setup.stopLoss?.toString(),
          takeProfit: effectiveTakeProfit?.toString(),
          openedAt: new Date(),
          closedAt: new Date(),
          status: 'cancelled',
          exitReason: EXIT_REASON.SL_CREATION_FAILED,
          exitPrice: closeResult.avgPrice.toString(),
          marketType: watcher.marketType,
          entryInterval: watcher.interval,
          entryOrderId,
        });

        return { shouldReturn: true };
      }
    } catch (closeError) {
      log('❌ CRITICAL: Failed to close unprotected position', {
        error: serializeError(closeError),
      });
    }

    const wsServiceAlert = getWebSocketService();
    wsServiceAlert?.emitRiskAlert(watcher.walletId, {
      type: RISK_ALERT_TYPES.UNPROTECTED_POSITION,
      level: RISK_ALERT_LEVELS.CRITICAL,
      symbol: watcher.symbol,
      message: `CRITICAL: Position ${watcher.symbol} ${setup.direction} is UNPROTECTED. SL creation failed and compensation failed. MANUAL INTERVENTION REQUIRED!`,
      data: {
        reason: 'sl_creation_failed_compensation_failed',
        side: setup.direction,
        quantity: actualQuantity.toString(),
        entryPrice: actualEntryPrice.toString(),
        marketType: watcher.marketType,
        executionId,
      },
      timestamp: Date.now(),
    });

    return { shouldReturn: true };
  }
}
