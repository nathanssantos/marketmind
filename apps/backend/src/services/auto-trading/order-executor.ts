import { calculateADX, calculateFibonacciProjection } from '@marketmind/indicators';
import type { Kline, StrategyDefinition, TradingSetup } from '@marketmind/types';
import { FILTER_THRESHOLDS, getDefaultFee } from '@marketmind/types';
import { and, eq, inArray } from 'drizzle-orm';
import {
  BACKTEST_DEFAULTS,
  TIME_MS,
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
import { autoTradingService } from '../auto-trading';
import { createBinanceFuturesClient } from '../binance-client';
import { getOrderEntryFee } from '../binance-futures-client';
import { cooldownService } from '../cooldown';
import { positionMonitorService } from '../position-monitor';
import { pyramidingService } from '../pyramiding';
import { riskManagerService } from '../risk-manager';
import { getWebSocketService } from '../websocket';
import type { WatcherLogBuffer } from '../watcher-batch-logger';
import type { ActiveWatcher } from './types';
import { log } from './utils';
import { FilterValidator, type FilterValidatorConfig, type FilterValidatorDeps } from './filter-validator';
import { protectionOrderHandler } from './protection-order-handler';

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

  private getAdxBasedFibonacciLevel(klines: Kline[], _direction: 'LONG' | 'SHORT'): number {
    const { ADX_MIN, ADX_STRONG, ADX_VERY_STRONG } = FILTER_THRESHOLDS;
    const MIN_KLINES_FOR_ADX = 35;

    if (klines.length < MIN_KLINES_FOR_ADX) {
      log('⚠️ Insufficient klines for ADX calculation, using default level', {
        klinesCount: klines.length,
        required: MIN_KLINES_FOR_ADX,
      });
      return 1.272;
    }

    const adxResult = calculateADX(klines, 14);
    const adx = adxResult.adx[adxResult.adx.length - 1];

    if (adx == null) {
      log('⚠️ ADX calculation returned null, using default level');
      return 1.272;
    }

    let targetLevel: number;

    if (adx >= ADX_VERY_STRONG) targetLevel = 2.0;
    else if (adx >= ADX_STRONG) targetLevel = 1.618;
    else if (adx >= ADX_MIN) targetLevel = 1.382;
    else targetLevel = 1.272;

    log('📊 ADX-based Fibonacci level selected', {
      adx: adx.toFixed(2),
      targetLevel,
      thresholds: { ADX_MIN, ADX_STRONG, ADX_VERY_STRONG },
    });

    return targetLevel;
  }

  calculateFibonacciTakeProfit(
    klines: Kline[],
    _entryPrice: number,
    direction: 'LONG' | 'SHORT',
    fibonacciTargetLevel: 'auto' | '1' | '1.272' | '1.382' | '1.5' | '1.618' | '2' | '2.272' | '2.618' = '2',
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

    const targetLevel = fibonacciTargetLevel === 'auto'
      ? this.getAdxBasedFibonacciLevel(klines, direction)
      : parseFloat(fibonacciTargetLevel);

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

    logBuffer.startSetupValidation({
      type: setup.type,
      direction: setup.direction,
      entryPrice: setup.entryPrice,
      stopLoss: setup.stopLoss ?? undefined,
      takeProfit: setup.takeProfit ?? undefined,
      confidence: setup.confidence ?? 0,
      riskReward: setup.riskRewardRatio ?? undefined,
    });

    const config = await this.deps.getCachedConfig(watcher.walletId, watcher.userId);

    const tpCalculationMode = config?.tpCalculationMode ?? 'default';
    const fibonacciTargetLevelLong = config?.fibonacciTargetLevelLong ?? config?.fibonacciTargetLevel ?? '2';
    const fibonacciTargetLevelShort = config?.fibonacciTargetLevelShort ?? config?.fibonacciTargetLevel ?? '1.272';
    const effectiveFibLevel = setup.direction === 'LONG' ? fibonacciTargetLevelLong : fibonacciTargetLevelShort;

    logBuffer.log('🎯', 'TP calculation config', {
      tpCalculationMode,
      fibonacciTargetLevel: effectiveFibLevel,
      fibonacciTargetLevelLong,
      fibonacciTargetLevelShort,
      originalTP: setup.takeProfit?.toFixed(6),
    });

    let effectiveTakeProfit = setup.takeProfit;

    if (tpCalculationMode === 'fibonacci') {
      const fibTarget = this.calculateFibonacciTakeProfit(
        cycleKlines,
        setup.entryPrice,
        setup.direction,
        effectiveFibLevel,
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
            configLevel: effectiveFibLevel,
            direction: setup.direction,
          });
          effectiveTakeProfit = fibTarget;
        } else {
          logBuffer.addValidationCheck({
            name: 'Fibonacci Target',
            passed: false,
            value: fibTarget.toFixed(2),
            expected: setup.direction === 'LONG' ? '> entry' : '< entry',
            reason: 'Target invalid for direction',
          });
          logBuffer.addRejection({
            setupType: setup.type,
            direction: setup.direction,
            reason: 'Fibonacci target invalid for direction',
            details: {
              fibTarget: fibTarget.toFixed(6),
              entryPrice: setup.entryPrice.toFixed(6),
            },
          });
          logBuffer.completeSetupValidation('blocked', 'Fibonacci target invalid');
          return;
        }
      } else {
        logBuffer.addValidationCheck({
          name: 'Trend Structure',
          passed: false,
          reason: 'No clear trend (ranging market)',
        });
        logBuffer.addRejection({
          setupType: setup.type,
          direction: setup.direction,
          reason: 'No clear trend structure (ranging market)',
          details: {
            klinesCount: cycleKlines.length,
            interval: watcher.interval,
            fibLevel: effectiveFibLevel,
          },
        });
        logBuffer.completeSetupValidation('blocked', 'Ranging market');
        return;
      }
    }

    const rrValidation = this.validateRiskReward(setup, effectiveTakeProfit, tpCalculationMode, config, logBuffer);
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
        logBuffer.addValidationCheck({
          name: 'Cooldown',
          passed: false,
          value: `${remainingMinutes}m remaining`,
          reason: cooldownCheck.reason ?? 'Active',
        });
        logBuffer.addRejection({
          setupType: setup.type,
          direction: setup.direction,
          reason: 'Cooldown active',
          details: { remainingMinutes, cooldownReason: cooldownCheck.reason ?? 'N/A' },
        });
        logBuffer.completeSetupValidation('blocked', 'Cooldown active');
        return;
      }
      logBuffer.addValidationCheck({ name: 'Cooldown', passed: true, reason: 'OK' });

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
        logBuffer.addValidationCheck({
          name: 'Filters',
          passed: false,
          reason: filterValidation.rejectionReason ?? 'Failed',
        });
        logBuffer.addRejection({
          setupType: setup.type,
          direction: setup.direction,
          reason: filterValidation.rejectionReason ?? 'Filter validation failed',
          details: filterValidation.rejectionDetails as Record<string, string | number | boolean | null> | undefined,
        });
        logBuffer.completeSetupValidation('blocked', filterValidation.rejectionReason ?? 'Filter failed');
        return;
      }
      logBuffer.addValidationCheck({ name: 'Filters', passed: true, reason: 'All passed' });

      const oppositeDirectionPosition = openPositions.find(
        (pos) => pos.symbol === watcher.symbol && pos.side !== setup.direction
      );

      if (oppositeDirectionPosition) {
        logBuffer.addValidationCheck({
          name: 'Position Conflict',
          passed: false,
          value: oppositeDirectionPosition.side,
          reason: 'Opposite position exists',
        });
        logBuffer.addRejection({
          setupType: setup.type,
          direction: setup.direction,
          reason: 'Opposite position exists',
          details: { existingDirection: oppositeDirectionPosition.side },
        });
        logBuffer.completeSetupValidation('blocked', 'Opposite position exists');
        return;
      }
      logBuffer.addValidationCheck({ name: 'Position Conflict', passed: true, reason: 'No conflict' });

      const sameDirectionPositions = openPositions.filter(
        (pos) => pos.symbol === watcher.symbol && pos.side === setup.direction
      );

      if (sameDirectionPositions.length > 0) {
        if (!config.pyramidingEnabled) {
          logBuffer.addValidationCheck({
            name: 'Pyramiding',
            passed: false,
            value: `${sameDirectionPositions.length} positions`,
            reason: 'Pyramiding disabled',
          });
          logBuffer.addRejection({
            setupType: setup.type,
            direction: setup.direction,
            reason: 'Pyramiding disabled',
            details: { existingPositions: sameDirectionPositions.length },
          });
          logBuffer.completeSetupValidation('blocked', 'Pyramiding disabled');
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
          logBuffer.addValidationCheck({
            name: 'Pyramiding',
            passed: false,
            value: `${pyramidEval.currentEntries}/${pyramidEval.maxEntries}`,
            reason: pyramidEval.reason ?? 'Cannot pyramid',
          });
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
          logBuffer.completeSetupValidation('blocked', pyramidEval.reason ?? 'Cannot pyramid');
          return;
        }

        logBuffer.addValidationCheck({
          name: 'Pyramiding',
          passed: true,
          value: `${pyramidEval.currentEntries}/${pyramidEval.maxEntries}`,
          reason: 'Allowed',
        });
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
        logBuffer.addValidationCheck({
          name: 'Position Sizing',
          passed: false,
          reason: dynamicSize.reason ?? 'Zero quantity',
        });
        logBuffer.addRejection({
          setupType: setup.type,
          direction: setup.direction,
          reason: 'Zero quantity from sizing',
          details: { reason: dynamicSize.reason },
        });
        logBuffer.completeSetupValidation('blocked', 'Zero quantity');
        return;
      }
      logBuffer.addValidationCheck({
        name: 'Position Sizing',
        passed: true,
        value: dynamicSize.quantity.toFixed(4),
        reason: 'OK',
      });

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
        logBuffer.addValidationCheck({
          name: 'Risk Management',
          passed: false,
          reason: riskValidation.reason ?? 'Failed',
        });
        logBuffer.addRejection({
          setupType: setup.type,
          direction: setup.direction,
          reason: 'Risk validation failed',
          details: { reason: riskValidation.reason ?? 'Unknown' },
        });
        logBuffer.completeSetupValidation('blocked', riskValidation.reason ?? 'Risk validation failed');
        return;
      }
      logBuffer.addValidationCheck({ name: 'Risk Management', passed: true, reason: 'OK' });

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

      logBuffer.completeSetupValidation('executed', undefined, {
        quantity: dynamicSize.quantity.toFixed(4),
        orderType: 'MARKET',
      });
    } catch (error) {
      logBuffer.error('❌', 'Error executing setup', {
        type: setup.type,
        error: serializeError(error),
      });
      logBuffer.completeSetupValidation('failed', 'Execution error');
    }
  }

  private validateRiskReward(
    setup: TradingSetup,
    effectiveTakeProfit: number | undefined,
    tpCalculationMode: string,
    config: typeof autoTradingConfig.$inferSelect | null,
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
        logBuffer.addValidationCheck({
          name: 'Risk/Reward',
          passed: false,
          reason: 'Invalid stop loss - no risk',
        });
        logBuffer.addRejection({
          setupType: setup.type,
          direction: setup.direction,
          reason: 'Invalid stop loss - no risk',
          details: { entryPrice, stopLoss },
        });
        logBuffer.completeSetupValidation('blocked', 'Invalid stop loss');
        return { valid: false };
      }

      const riskRewardRatio = reward / risk;

      const minRRLong = config?.minRiskRewardRatioLong
        ? parseFloat(config.minRiskRewardRatioLong)
        : BACKTEST_DEFAULTS.MIN_RISK_REWARD_RATIO_LONG;
      const minRRShort = config?.minRiskRewardRatioShort
        ? parseFloat(config.minRiskRewardRatioShort)
        : BACKTEST_DEFAULTS.MIN_RISK_REWARD_RATIO_SHORT;
      const minRequired = setup.direction === 'LONG' ? minRRLong : minRRShort;

      if (riskRewardRatio < minRequired) {
        const usingFibonacci = tpCalculationMode === 'fibonacci' && effectiveTakeProfit !== setup.takeProfit;
        const reason = usingFibonacci ? 'Insufficient R:R (Fibonacci TP)' : 'Insufficient R:R ratio';
        logBuffer.addValidationCheck({
          name: 'Risk/Reward',
          passed: false,
          value: riskRewardRatio.toFixed(2),
          expected: `>= ${minRequired}`,
          reason,
        });
        logBuffer.addRejection({
          setupType: setup.type,
          direction: setup.direction,
          reason,
          details: {
            riskReward: riskRewardRatio.toFixed(2),
            minRequired,
            tpMode: tpCalculationMode,
            takeProfit: takeProfit.toFixed(4),
            entryPrice: entryPrice.toFixed(4),
          },
        });
        logBuffer.completeSetupValidation('blocked', reason);
        return { valid: false };
      }

      logBuffer.addValidationCheck({
        name: 'Risk/Reward',
        passed: true,
        value: riskRewardRatio.toFixed(2),
        expected: `>= ${minRequired}`,
      });
      logBuffer.log('✅', 'Risk/Reward ratio validated', {
        riskRewardRatio: riskRewardRatio.toFixed(2),
        minRequired,
        direction: setup.direction,
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

      const minRRLong = config.minRiskRewardRatioLong
        ? parseFloat(config.minRiskRewardRatioLong)
        : BACKTEST_DEFAULTS.MIN_RISK_REWARD_RATIO_LONG;
      const minRRShort = config.minRiskRewardRatioShort
        ? parseFloat(config.minRiskRewardRatioShort)
        : BACKTEST_DEFAULTS.MIN_RISK_REWARD_RATIO_SHORT;
      const minRequired = setup.direction === 'LONG' ? minRRLong : minRRShort;

      if (finalRiskRewardRatio < minRequired) {
        logBuffer.addRejection({
          setupType: setup.type,
          direction: setup.direction,
          reason: 'R:R too low after slippage',
          details: {
            finalRR: finalRiskRewardRatio.toFixed(2),
            minRequired,
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
        const protectionResult = await protectionOrderHandler.placeProtectionOrders(
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
          const compensationResult = await protectionOrderHandler.handleFailedProtection(
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
        const slResult = await protectionOrderHandler.placeSingleStopLoss(
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
          const compensationResult = await protectionOrderHandler.handleFailedProtection(
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
}
