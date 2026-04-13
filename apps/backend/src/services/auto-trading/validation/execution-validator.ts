import type { Kline, TradingSetup } from '@marketmind/types';
import type { PineStrategy } from '../../pine/types';
import { and, eq, inArray } from 'drizzle-orm';
import { BACKTEST_DEFAULTS } from '../../../constants';
import { db } from '../../../db';
import {
  autoTradingConfig,
  tradeExecutions,
  tradingProfiles,
} from '../../../db/schema';
import { applyProfileOverrides } from '../../profile-applicator';
import { isDirectionAllowed } from '../../../utils/trading-validation';
import { cooldownService } from '../../cooldown';
import { pyramidingService } from '../../pyramiding';
import { riskManagerService } from '../../risk-manager';
import { walletLockService } from '../../wallet-lock';
import { buildFilterConfigFromDb } from '../../../utils/filters/filter-registry';
import { FilterValidator, type FilterValidatorConfig, type FilterValidatorDeps } from './filter-validator';
import type { WatcherLogBuffer } from '../../watcher-batch-logger';
import type { ActiveWatcher } from '../types';
import { calculateFibonacciTakeProfit } from './fibonacci-calculator';

export interface ExecutionValidatorDeps extends FilterValidatorDeps {
  getCachedConfig: (walletId: string, userId?: string) => Promise<typeof autoTradingConfig.$inferSelect | null>;
}

export const resolveConfig = async (
  deps: ExecutionValidatorDeps,
  watcher: ActiveWatcher
): Promise<typeof autoTradingConfig.$inferSelect | null> => {
  let config = await deps.getCachedConfig(watcher.walletId, watcher.userId);
  if (config && watcher.profileId) {
    const [profileRow] = await db.select().from(tradingProfiles)
      .where(eq(tradingProfiles.id, watcher.profileId)).limit(1);
    if (profileRow) config = applyProfileOverrides(config, profileRow);
  }
  return config;
};

export const resolveTpConfig = (
  config: typeof autoTradingConfig.$inferSelect | null,
  direction: 'LONG' | 'SHORT'
) => {
  const tpCalculationMode = config?.tpCalculationMode ?? 'default';
  const fibonacciTargetLevelLong = config?.fibonacciTargetLevelLong ?? config?.fibonacciTargetLevel ?? '2';
  const fibonacciTargetLevelShort = config?.fibonacciTargetLevelShort ?? config?.fibonacciTargetLevel ?? '1.272';
  const effectiveFibLevel = direction === 'LONG' ? fibonacciTargetLevelLong : fibonacciTargetLevelShort;
  const fibonacciSwingRange = config?.fibonacciSwingRange ?? 'nearest';

  return { tpCalculationMode, effectiveFibLevel, fibonacciSwingRange, fibonacciTargetLevelLong, fibonacciTargetLevelShort };
};

export const buildFilterConfig = (
  config: typeof autoTradingConfig.$inferSelect,
  directionMode: string
): FilterValidatorConfig => ({
  ...buildFilterConfigFromDb(config as unknown as Record<string, unknown>),
  useBtcCorrelationFilter: directionMode === 'auto' && (config.useBtcCorrelationFilter ?? false),
  volumeFilterConfig: {
    longConfig: {
      useObvCheck: config.useObvCheckLong ?? false,
      obvLookback: config.volumeFilterObvLookbackLong ?? 7,
    },
    shortConfig: {
      useObvCheck: config.useObvCheckShort ?? true,
      obvLookback: config.volumeFilterObvLookbackShort ?? 5,
    },
  },
} as FilterValidatorConfig);

export const validateRiskReward = (
  setup: TradingSetup,
  effectiveTakeProfit: number | undefined,
  tpCalculationMode: string,
  config: typeof autoTradingConfig.$inferSelect | null,
  logBuffer: WatcherLogBuffer
): { valid: boolean } => {
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
    logBuffer.log('✓', 'Risk/Reward ratio validated', {
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
    logBuffer.warn('✗', 'Missing stop loss', { setup: setup.type, direction: setup.direction });
    return { valid: false };
  } else {
    logBuffer.log('·', 'Setup without take profit - skipping R:R validation');
  }

  return { valid: true };
};

export const validateSetupFilters = async (
  deps: ExecutionValidatorDeps,
  filterValidator: FilterValidator,
  watcher: ActiveWatcher,
  setup: TradingSetup,
  strategies: PineStrategy[],
  cycleKlines: Kline[],
  logBuffer: WatcherLogBuffer
): Promise<boolean> => {
  const config = await resolveConfig(deps, watcher);
  const { tpCalculationMode, effectiveFibLevel, fibonacciSwingRange } = resolveTpConfig(config, setup.direction);

  let effectiveTakeProfit = setup.takeProfit;

  if (tpCalculationMode === 'fibonacci') {
    const fibTarget = await calculateFibonacciTakeProfit(
      cycleKlines, setup.entryPrice, setup.direction,
      effectiveFibLevel, watcher.interval, fibonacciSwingRange
    );

    if (fibTarget !== null) {
      const isValidTarget = setup.direction === 'LONG'
        ? fibTarget > setup.entryPrice
        : fibTarget < setup.entryPrice;
      if (isValidTarget) effectiveTakeProfit = fibTarget;
      else return false;
    } else {
      return false;
    }
  }

  const rrValidation = validateRiskReward(setup, effectiveTakeProfit, tpCalculationMode, config, logBuffer);
  if (!rrValidation.valid) return false;

  const cooldownCheck = await cooldownService.checkCooldown(
    setup.type, watcher.symbol, watcher.interval, watcher.walletId
  );
  if (cooldownCheck.inCooldown) return false;

  const directionMode = config?.directionMode ?? 'auto';
  if (!isDirectionAllowed(directionMode, setup.direction)) return false;

  if (!config) return false;

  const filterConfig = buildFilterConfig(config, directionMode);

  const filterValidation = await filterValidator.validateFilters(
    watcher, setup, filterConfig, cycleKlines, strategies, logBuffer
  );
  if (!filterValidation.passed) return false;

  const activePositions = await db
    .select()
    .from(tradeExecutions)
    .where(
      and(
        eq(tradeExecutions.walletId, watcher.walletId),
        inArray(tradeExecutions.status, ['open', 'pending'])
      )
    );

  const manualPosition = activePositions.find(
    (pos) => pos.symbol === watcher.symbol && !pos.setupType
  );
  if (manualPosition) return false;

  const oppositePosition = activePositions.find(
    (pos) => pos.symbol === watcher.symbol && pos.side !== setup.direction
  );
  if (oppositePosition) return false;

  return true;
};

export interface ExecutionChecksResult {
  passed: boolean;
  openPositions: (typeof tradeExecutions.$inferSelect)[];
  sameDirectionPositions: (typeof tradeExecutions.$inferSelect)[];
  dynamicSize: { quantity: number; sizePercent: number; reason?: string };
  activeWatchersForWallet: number;
  effectiveMaxPositionSize: number;
  release: () => void;
}

export const validateExecutionChecks = async (
  watcher: ActiveWatcher,
  setup: TradingSetup,
  config: typeof autoTradingConfig.$inferSelect,
  cycleKlines: Kline[],
  strategies: PineStrategy[],
  filterValidator: FilterValidator,
  getWatcherStatus: (walletId: string) => { active: boolean; watchers: number },
  walletBalance: number,
  logBuffer: WatcherLogBuffer
): Promise<ExecutionChecksResult | null> => {
  const effectiveMaxPositionSize = parseFloat(config.maxPositionSize);

  const [activePositions, cooldownCheck] = await Promise.all([
    db.select().from(tradeExecutions).where(
      and(eq(tradeExecutions.walletId, watcher.walletId), inArray(tradeExecutions.status, ['open', 'pending']))
    ),
    cooldownService.checkCooldown(setup.type, watcher.symbol, watcher.interval, watcher.walletId),
  ]);

  const openPositions = activePositions.filter(p => p.status === 'open');

  if (cooldownCheck.inCooldown) {
    const remainingMs = cooldownCheck.cooldownUntil ? cooldownCheck.cooldownUntil.getTime() - Date.now() : 0;
    const remainingMinutes = Math.ceil(remainingMs / 60000);
    logBuffer.addValidationCheck({ name: 'Cooldown', passed: false, value: `${remainingMinutes}m remaining`, reason: cooldownCheck.reason ?? 'Active' });
    logBuffer.addRejection({ setupType: setup.type, direction: setup.direction, reason: 'Cooldown active', details: { remainingMinutes, cooldownReason: cooldownCheck.reason ?? 'N/A' } });
    logBuffer.completeSetupValidation('blocked', 'Cooldown active');
    return null;
  }
  logBuffer.addValidationCheck({ name: 'Cooldown', passed: true, reason: 'OK' });

  const directionMode = config.directionMode ?? 'auto';
  if (!isDirectionAllowed(directionMode, setup.direction)) {
    const directionLabel = directionMode.replace('_', ' ');
    logBuffer.addValidationCheck({ name: 'Direction Mode', passed: false, value: setup.direction, reason: `${directionLabel} mode` });
    logBuffer.addRejection({ setupType: setup.type, direction: setup.direction, reason: `Direction mode: ${directionMode}` });
    logBuffer.completeSetupValidation('blocked', `Direction mode: ${directionLabel}`);
    return null;
  }
  logBuffer.addValidationCheck({ name: 'Direction Mode', passed: true, reason: directionMode });

  const filterConfig = buildFilterConfig(config, directionMode);
  const filterValidation = await filterValidator.validateFilters(watcher, setup, filterConfig, cycleKlines, strategies, logBuffer);

  if (!filterValidation.passed) {
    logBuffer.addValidationCheck({ name: 'Filters', passed: false, reason: filterValidation.rejectionReason ?? 'Failed' });
    logBuffer.addRejection({ setupType: setup.type, direction: setup.direction, reason: filterValidation.rejectionReason ?? 'Filter validation failed', details: filterValidation.rejectionDetails as Record<string, string | number | boolean | null> | undefined });
    logBuffer.completeSetupValidation('blocked', filterValidation.rejectionReason ?? 'Filter failed');
    return null;
  }
  logBuffer.addValidationCheck({ name: 'Filters', passed: true, reason: 'All passed' });

  const oppositeDirectionPosition = openPositions.find((pos) => pos.symbol === watcher.symbol && pos.side !== setup.direction);
  if (oppositeDirectionPosition) {
    logBuffer.addValidationCheck({ name: 'Position Conflict', passed: false, value: oppositeDirectionPosition.side, reason: 'Opposite position exists' });
    logBuffer.addRejection({ setupType: setup.type, direction: setup.direction, reason: 'Opposite position exists', details: { existingDirection: oppositeDirectionPosition.side } });
    logBuffer.completeSetupValidation('blocked', 'Opposite position exists');
    return null;
  }
  logBuffer.addValidationCheck({ name: 'Position Conflict', passed: true, reason: 'No conflict' });

  const manualPosition = openPositions.find((pos) => pos.symbol === watcher.symbol && !pos.setupType);
  if (manualPosition) {
    logBuffer.addValidationCheck({ name: 'Manual Position Guard', passed: false, value: manualPosition.side, reason: 'Manual position exists on symbol' });
    logBuffer.addRejection({ setupType: setup.type, direction: setup.direction, reason: 'Manual position exists on symbol', details: { manualPositionSide: manualPosition.side } });
    logBuffer.completeSetupValidation('blocked', 'Manual position exists on symbol');
    return null;
  }
  logBuffer.addValidationCheck({ name: 'Manual Position Guard', passed: true, reason: 'No manual position' });

  const sameDirectionPositions = openPositions.filter((pos) => pos.symbol === watcher.symbol && pos.side === setup.direction);

  if (sameDirectionPositions.length > 0) {
    if (!config.pyramidingEnabled) {
      logBuffer.addValidationCheck({ name: 'Pyramiding', passed: false, value: `${sameDirectionPositions.length} positions`, reason: 'Pyramiding disabled' });
      logBuffer.addRejection({ setupType: setup.type, direction: setup.direction, reason: 'Pyramiding disabled', details: { existingPositions: sameDirectionPositions.length } });
      logBuffer.completeSetupValidation('blocked', 'Pyramiding disabled');
      return null;
    }

    const stopLoss = setup.stopLoss ?? null;
    const pyramidEval = await pyramidingService.evaluatePyramidByMode(
      watcher.userId, watcher.walletId, watcher.symbol, setup.direction,
      setup.entryPrice, cycleKlines, stopLoss, setup.confidence ? setup.confidence / 100 : undefined
    );

    if (!pyramidEval.canPyramid) {
      logBuffer.addValidationCheck({ name: 'Pyramiding', passed: false, value: `${pyramidEval.currentEntries}/${pyramidEval.maxEntries}`, reason: pyramidEval.reason ?? 'Cannot pyramid' });
      logBuffer.addRejection({ setupType: setup.type, direction: setup.direction, reason: pyramidEval.reason ?? 'Cannot pyramid', details: { currentEntries: pyramidEval.currentEntries, maxEntries: pyramidEval.maxEntries, mode: pyramidEval.mode ?? 'static', adxValue: pyramidEval.adxValue ?? null } });
      logBuffer.completeSetupValidation('blocked', pyramidEval.reason ?? 'Cannot pyramid');
      return null;
    }

    logBuffer.addValidationCheck({ name: 'Pyramiding', passed: true, value: `${pyramidEval.currentEntries}/${pyramidEval.maxEntries}`, reason: 'Allowed' });
    logBuffer.log('>', 'Pyramiding opportunity', { currentEntries: pyramidEval.currentEntries, suggestedSize: pyramidEval.suggestedSize, mode: pyramidEval.mode ?? 'static', adxValue: pyramidEval.adxValue ?? null, adjustedScaleFactor: pyramidEval.adjustedScaleFactor ?? null, fiboLevel: pyramidEval.fiboTriggerLevel ?? null });
  }

  const activeWatchersForWallet = getWatcherStatus(watcher.walletId).watchers;

  const dynamicSize = await pyramidingService.calculateDynamicPositionSize(
    watcher.userId, watcher.walletId, watcher.symbol, setup.direction,
    walletBalance, setup.entryPrice, undefined,
    activeWatchersForWallet > 0 ? activeWatchersForWallet : undefined, watcher.marketType
  );

  if (dynamicSize.quantity <= 0) {
    logBuffer.addValidationCheck({ name: 'Position Sizing', passed: false, reason: dynamicSize.reason ?? 'Zero quantity' });
    logBuffer.addRejection({ setupType: setup.type, direction: setup.direction, reason: 'Zero quantity from sizing', details: { reason: dynamicSize.reason } });
    logBuffer.completeSetupValidation('blocked', 'Zero quantity');
    return null;
  }
  logBuffer.addValidationCheck({ name: 'Position Sizing', passed: true, value: dynamicSize.quantity.toFixed(4), reason: 'OK' });

  const positionValue = dynamicSize.quantity * setup.entryPrice;
  const effectiveConfig = {
    ...config,
    maxPositionSize: effectiveMaxPositionSize.toString(),
    maxConcurrentPositions: activeWatchersForWallet || config.maxConcurrentPositions,
  };

  const release = await walletLockService.acquire(watcher.walletId);

  let riskValidation: { isValid: boolean; reason?: string };
  try {
    riskValidation = await riskManagerService.validateNewPosition(
      watcher.walletId, effectiveConfig, positionValue,
      activeWatchersForWallet > 0 ? activeWatchersForWallet : undefined,
      setup.stopLoss ? { entryPrice: setup.entryPrice, stopLoss: setup.stopLoss } : undefined
    );
  } catch (error) {
    release();
    throw error;
  }

  if (!riskValidation.isValid) {
    release();
    logBuffer.addValidationCheck({ name: 'Risk Management', passed: false, reason: riskValidation.reason ?? 'Failed' });
    logBuffer.addRejection({ setupType: setup.type, direction: setup.direction, reason: 'Risk validation failed', details: { reason: riskValidation.reason ?? 'Unknown' } });
    logBuffer.completeSetupValidation('blocked', riskValidation.reason ?? 'Risk validation failed');
    return null;
  }
  logBuffer.addValidationCheck({ name: 'Risk Management', passed: true, reason: 'OK' });

  return {
    passed: true,
    openPositions,
    sameDirectionPositions,
    dynamicSize,
    activeWatchersForWallet,
    effectiveMaxPositionSize,
    release,
  };
};
