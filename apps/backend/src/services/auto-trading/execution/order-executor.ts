import type { FibLevel, Kline, StrategyDefinition, TradingSetup } from '@marketmind/types';
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import {
  autoTradingConfig,
  wallets,
} from '../../../db/schema';
import { env } from '../../../env';
import { serializeError } from '../../../utils/errors';
import type { WatcherLogBuffer } from '../../watcher-batch-logger';
import type { ActiveWatcher } from '../types';
import { type FilterValidatorDeps, FilterValidator } from '../validation/filter-validator';
import {
  resolveConfig,
  resolveTpConfig,
  validateRiskReward,
  validateSetupFilters as validateSetupFiltersImpl,
  validateExecutionChecks,
} from '../validation/execution-validator';
import {
  calculateFibonacciTakeProfit,
  getIntervalMs,
  getAdxBasedFibonacciLevel,
} from '../validation/fibonacci-calculator';
import { createAndExecuteTrade } from './trade-record-manager';
import { executeLiveOrder } from './live-order-executor';
import { executePaperOrder } from './paper-order-executor';

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

  async validateSetupFilters(
    watcher: ActiveWatcher,
    setup: TradingSetup,
    strategies: StrategyDefinition[],
    cycleKlines: Kline[],
    logBuffer: WatcherLogBuffer
  ): Promise<boolean> {
    return validateSetupFiltersImpl(
      this.deps, this.filterValidator, watcher, setup, strategies, cycleKlines, logBuffer
    );
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
      logBuffer.error('✗', 'Setup execution failed', {
        setup: setup.type,
        error: serializeError(error),
      });
      return false;
    }
  }

  calculateFibonacciTakeProfit(
    klines: Kline[],
    _entryPrice: number,
    direction: 'LONG' | 'SHORT',
    fibonacciTargetLevel: FibLevel = '2',
    interval: string = '4h',
    swingRange: 'extended' | 'nearest' = 'nearest'
  ): number | null {
    return calculateFibonacciTakeProfit(klines, _entryPrice, direction, fibonacciTargetLevel, interval, swingRange);
  }

  getIntervalMs(interval: string): number {
    return getIntervalMs(interval);
  }

  getAdxBasedFibonacciLevel(klines: Kline[], direction: 'LONG' | 'SHORT'): number {
    return getAdxBasedFibonacciLevel(klines, direction);
  }

  validateRiskReward(
    setup: TradingSetup,
    effectiveTakeProfit: number | undefined,
    tpCalculationMode: string,
    config: typeof autoTradingConfig.$inferSelect | null,
    logBuffer: WatcherLogBuffer
  ): { valid: boolean } {
    return validateRiskReward(setup, effectiveTakeProfit, tpCalculationMode, config, logBuffer);
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
      logBuffer.log('~', 'Setup execution already in progress, skipping duplicate', {
        type: setup.type,
        symbol: watcher.symbol,
        lockKey: executionLockKey,
      });
      return;
    }

    this.executingSetups.add(executionLockKey);

    try {
      const { getScalpingScheduler } = await import('../../scalping/scalping-scheduler');
      if (getScalpingScheduler().isSymbolBeingScalped(watcher.walletId, watcher.symbol)) {
        logBuffer.log('~', 'Skipping: symbol is being scalped', { symbol: watcher.symbol });
        return;
      }
      await this.executeSetupInternal(watcher, setup, strategies, cycleKlines, logBuffer);
    } finally {
      this.executingSetups.delete(executionLockKey);
    }
  }

  private async executeSetupInternal(
    watcher: ActiveWatcher,
    setup: TradingSetup,
    strategies: StrategyDefinition[],
    cycleKlines: Kline[],
    logBuffer: WatcherLogBuffer
  ): Promise<void> {
    logBuffer.log('>', 'Attempting to execute setup', {
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

    const config = await resolveConfig(this.deps, watcher);

    const { tpCalculationMode, effectiveFibLevel, fibonacciSwingRange, fibonacciTargetLevelLong, fibonacciTargetLevelShort } = resolveTpConfig(config, setup.direction);

    logBuffer.log('>', 'TP calculation config', {
      tpCalculationMode,
      fibonacciTargetLevel: effectiveFibLevel,
      fibonacciTargetLevelLong,
      fibonacciTargetLevelShort,
      originalTP: setup.takeProfit?.toFixed(6),
    });

    let effectiveTakeProfit = setup.takeProfit;

    if (tpCalculationMode === 'fibonacci') {
      const fibTarget = calculateFibonacciTakeProfit(
        cycleKlines, setup.entryPrice, setup.direction,
        effectiveFibLevel, watcher.interval, fibonacciSwingRange
      );

      if (fibTarget !== null) {
        const isValidTarget = setup.direction === 'LONG'
          ? fibTarget > setup.entryPrice
          : fibTarget < setup.entryPrice;

        if (isValidTarget) {
          logBuffer.log('>', 'Using Fibonacci projection for take profit', {
            originalTP: setup.takeProfit?.toFixed(6),
            fibonacciTP: fibTarget.toFixed(6),
            configLevel: effectiveFibLevel,
            direction: setup.direction,
          });
          effectiveTakeProfit = fibTarget;
        } else {
          logBuffer.addValidationCheck({ name: 'Fibonacci Target', passed: false, value: fibTarget.toFixed(2), expected: setup.direction === 'LONG' ? '> entry' : '< entry', reason: 'Target invalid for direction' });
          logBuffer.addRejection({ setupType: setup.type, direction: setup.direction, reason: 'Fibonacci target invalid for direction', details: { fibTarget: fibTarget.toFixed(6), entryPrice: setup.entryPrice.toFixed(6) } });
          logBuffer.completeSetupValidation('blocked', 'Fibonacci target invalid');
          return;
        }
      } else {
        logBuffer.addValidationCheck({ name: 'Trend Structure', passed: false, reason: 'No clear trend (ranging market)' });
        logBuffer.addRejection({ setupType: setup.type, direction: setup.direction, reason: 'No clear trend structure (ranging market)', details: { klinesCount: cycleKlines.length, interval: watcher.interval, fibLevel: effectiveFibLevel } });
        logBuffer.completeSetupValidation('blocked', 'Ranging market');
        return;
      }
    }

    const rrValidation = validateRiskReward(setup, effectiveTakeProfit, tpCalculationMode, config, logBuffer);
    if (!rrValidation.valid) return;

    try {
      if (!config?.isEnabled) {
        logBuffer.warn('!', 'Auto-trading disabled during execution');
        return;
      }

      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, watcher.walletId))
        .limit(1);

      if (!wallet) {
        logBuffer.error('✗', 'Wallet not found', { walletId: watcher.walletId });
        return;
      }

      const walletSupportsLive = wallet.walletType === 'live' || wallet.walletType === 'testnet';
      const isLiveExecution = walletSupportsLive && env.ENABLE_LIVE_TRADING;
      const walletBalance = parseFloat(wallet.currentBalance ?? '0');

      const checks = await validateExecutionChecks(
        watcher, setup, config, cycleKlines, strategies, this.filterValidator,
        this.deps.getWatcherStatus, walletBalance, logBuffer
      );

      if (!checks) return;

      try {
        const SLIPPAGE_PERCENT = 0.1;
        const slippageFactor = setup.direction === 'LONG' ? (1 + SLIPPAGE_PERCENT / 100) : (1 - SLIPPAGE_PERCENT / 100);
        const expectedEntryWithSlippage = setup.entryPrice * slippageFactor;
        const useLimit = false;
        const orderType = 'MARKET' as const;

        await createAndExecuteTrade(
          watcher, setup, effectiveTakeProfit, wallet, config, checks.dynamicSize,
          isLiveExecution, logBuffer, checks.sameDirectionPositions,
          (executionId, setupId) => executeLiveOrder(
            watcher, setup, effectiveTakeProfit, wallet, config, checks.dynamicSize,
            executionId, setupId, orderType, useLimit
          ),
          (executionId, setupId) => executePaperOrder(
            watcher, setup, effectiveTakeProfit, wallet, checks.dynamicSize,
            executionId, setupId, useLimit, expectedEntryWithSlippage
          )
        );

        logBuffer.completeSetupValidation('executed', undefined, {
          quantity: checks.dynamicSize.quantity.toFixed(4),
          orderType: 'MARKET',
        });
      } finally {
        checks.release();
      }
    } catch (error) {
      logBuffer.error('✗', 'Error executing setup', {
        type: setup.type,
        error: serializeError(error),
      });
      logBuffer.completeSetupValidation('failed', 'Execution error');
    }
  }
}
