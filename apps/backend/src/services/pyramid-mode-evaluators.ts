import type { Kline } from '@marketmind/types';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { tradeExecutions } from '../db/schema';
import {
  calculateLeverageAdjustedScaleFactor,
  evaluateDynamicConditions,
  type DynamicPyramidConfig,
} from './dynamic-pyramid-evaluator';
import {
  evaluateFiboPyramidTrigger,
  type FiboPyramidConfig,
} from './fibonacci-pyramid-evaluator';
import { logger } from './logger';
import {
  calculateBaseSize,
  calculateWeightedAvgPrice,
  logPyramidDecision,
  roundQuantity,
  type PyramidConfig,
  type PyramidEvaluation,
} from './pyramid-calculations';

export const evaluateDynamicPyramid = async (
  evaluateStatic: (
    userId: string, walletId: string, symbol: string,
    direction: 'LONG' | 'SHORT', currentPrice: number,
    mlConfidence?: number, config?: Partial<PyramidConfig>
  ) => Promise<PyramidEvaluation>,
  userId: string, walletId: string, symbol: string,
  direction: 'LONG' | 'SHORT', currentPrice: number,
  klines: Kline[], config: PyramidConfig, mlConfidence?: number
): Promise<PyramidEvaluation> => {
  const dynamicConfig: DynamicPyramidConfig = {
    useAtr: config.useAtr, useAdx: config.useAdx, useRsi: config.useRsi,
    adxThreshold: config.adxThreshold, rsiLowerBound: config.rsiLowerBound,
    rsiUpperBound: config.rsiUpperBound, baseMinDistance: config.minDistance,
    baseScaleFactor: config.scaleFactor, leverage: config.leverage,
    leverageAware: config.leverageAware,
  };

  const dynamicEval = await evaluateDynamicConditions(klines, dynamicConfig);

  if (!dynamicEval.canPyramid) {
    logPyramidDecision('REJECTED', symbol, direction, {
      Mode: 'dynamic', Reason: dynamicEval.reason,
      ADX: dynamicEval.adxValue?.toFixed(2) ?? 'N/A',
      'ADX Threshold': config.adxThreshold,
      RSI: dynamicEval.rsiValue?.toFixed(2) ?? 'N/A',
      'RSI Range': `${config.rsiLowerBound}-${config.rsiUpperBound}`,
      ATR: dynamicEval.atrValue?.toFixed(6) ?? 'N/A',
      'Adj Scale': dynamicEval.adjustedScaleFactor?.toFixed(3) ?? 'N/A',
      'Adj Distance': dynamicEval.adjustedMinDistance?.toFixed(4) ?? 'N/A',
    });

    return {
      canPyramid: false, reason: dynamicEval.reason, suggestedSize: 0,
      currentEntries: 0, maxEntries: config.maxEntries, profitPercent: 0,
      exposurePercent: 0, adxValue: dynamicEval.adxValue, mode: 'dynamic',
      adjustedScaleFactor: dynamicEval.adjustedScaleFactor,
      adjustedMinDistance: dynamicEval.adjustedMinDistance,
    };
  }

  const adjustedConfig: Partial<PyramidConfig> = {
    ...config,
    minDistance: dynamicEval.adjustedMinDistance,
    scaleFactor: dynamicEval.adjustedScaleFactor,
  };

  const staticEval = await evaluateStatic(userId, walletId, symbol, direction, currentPrice, mlConfidence, adjustedConfig);

  if (staticEval.canPyramid) {
    logPyramidDecision('APPROVED', symbol, direction, {
      Mode: 'dynamic',
      'Entry #': `${staticEval.currentEntries + 1}/${staticEval.maxEntries}`,
      'Profit %': `${(staticEval.profitPercent * 100).toFixed(2)}%`,
      ADX: dynamicEval.adxValue?.toFixed(2) ?? 'N/A',
      RSI: dynamicEval.rsiValue?.toFixed(2) ?? 'N/A',
      ATR: dynamicEval.atrValue?.toFixed(6) ?? 'N/A',
      'Base Scale': config.scaleFactor.toFixed(2),
      'Adj Scale': dynamicEval.adjustedScaleFactor.toFixed(3),
      'Adj Distance': `${(dynamicEval.adjustedMinDistance * 100).toFixed(2)}%`,
      'Pyramid Size': staticEval.suggestedSize.toFixed(6),
      Leverage: config.leverage,
    });
  }

  return {
    ...staticEval, adxValue: dynamicEval.adxValue, mode: 'dynamic',
    adjustedScaleFactor: dynamicEval.adjustedScaleFactor,
    adjustedMinDistance: dynamicEval.adjustedMinDistance,
  };
};

export const evaluateFibonacciPyramid = async (
  userId: string, walletId: string, symbol: string,
  direction: 'LONG' | 'SHORT', currentPrice: number,
  stopLoss: number | null, config: PyramidConfig, _mlConfidence?: number
): Promise<PyramidEvaluation> => {
  const openExecutions = await db
    .select()
    .from(tradeExecutions)
    .where(
      and(
        eq(tradeExecutions.userId, userId),
        eq(tradeExecutions.walletId, walletId),
        eq(tradeExecutions.symbol, symbol),
        eq(tradeExecutions.side, direction),
        eq(tradeExecutions.status, 'open')
      )
    );

  if (openExecutions.length === 0) {
    return { canPyramid: false, reason: 'No existing position to pyramid into', suggestedSize: 0, currentEntries: 0, maxEntries: config.maxEntries, profitPercent: 0, exposurePercent: 0, mode: 'fibonacci' };
  }

  if (openExecutions.length >= config.maxEntries) {
    return { canPyramid: false, reason: `Maximum entries reached (${config.maxEntries})`, suggestedSize: 0, currentEntries: openExecutions.length, maxEntries: config.maxEntries, profitPercent: 0, exposurePercent: 0, mode: 'fibonacci' };
  }

  const avgEntryPrice = calculateWeightedAvgPrice(openExecutions);
  const effectiveStopLoss = stopLoss ?? parseFloat(openExecutions[0]?.stopLoss ?? '0');

  if (effectiveStopLoss === 0) {
    return { canPyramid: false, reason: 'Stop loss required for Fibonacci pyramid mode', suggestedSize: 0, currentEntries: openExecutions.length, maxEntries: config.maxEntries, profitPercent: 0, exposurePercent: 0, mode: 'fibonacci' };
  }

  const fiboConfig: FiboPyramidConfig = {
    enabledLevels: config.fiboLevels, leverage: config.leverage,
    leverageAware: config.leverageAware, baseScaleFactor: config.scaleFactor,
  };

  const fiboEval = evaluateFiboPyramidTrigger(symbol, direction, avgEntryPrice, effectiveStopLoss, currentPrice, fiboConfig);

  const profitPercent = direction === 'LONG'
    ? (currentPrice - avgEntryPrice) / avgEntryPrice
    : (avgEntryPrice - currentPrice) / avgEntryPrice;

  if (!fiboEval.canPyramid) {
    logPyramidDecision('REJECTED', symbol, direction, {
      Mode: 'fibonacci', Reason: fiboEval.reason,
      'Entry #': `${openExecutions.length}/${config.maxEntries}`,
      'Avg Entry': avgEntryPrice.toFixed(4), 'Current Price': currentPrice.toFixed(4),
      'Stop Loss': effectiveStopLoss.toFixed(4), 'Profit %': `${(profitPercent * 100).toFixed(2)}%`,
      'Next Level': fiboEval.nextLevel ?? 'N/A', 'Enabled Levels': config.fiboLevels.join(', '),
    });

    return {
      canPyramid: false, reason: fiboEval.reason, suggestedSize: 0,
      currentEntries: openExecutions.length, maxEntries: config.maxEntries,
      profitPercent, exposurePercent: 0, mode: 'fibonacci',
      fiboTriggerLevel: fiboEval.nextLevel,
    };
  }

  const scaleFactor = calculateLeverageAdjustedScaleFactor(config.scaleFactor, config.leverage, config.leverageAware);

  const baseSize = calculateBaseSize(openExecutions);
  const scaledSize = baseSize * Math.pow(scaleFactor, openExecutions.length);

  logPyramidDecision('APPROVED', symbol, direction, {
    Mode: 'fibonacci', 'Fibo Level': fiboEval.triggerLevel ?? '-',
    'Entry #': `${openExecutions.length + 1}/${config.maxEntries}`,
    'Avg Entry': avgEntryPrice.toFixed(4), 'Current Price': currentPrice.toFixed(4),
    'Profit %': `${(profitPercent * 100).toFixed(2)}%`,
    'Base Size': baseSize.toFixed(6), 'Scale Factor': scaleFactor.toFixed(2),
    'Pyramid Size': roundQuantity(scaledSize).toFixed(6),
    Leverage: config.leverage, 'Next Level': fiboEval.nextLevel ?? 'N/A',
  });

  logger.info({
    symbol, direction, fiboLevel: fiboEval.triggerLevel,
    entryNumber: openExecutions.length + 1,
    suggestedSize: roundQuantity(scaledSize),
    profitPercent: (profitPercent * 100).toFixed(2),
  }, '[Pyramiding] Fibonacci entry approved');

  return {
    canPyramid: true,
    reason: `Fibonacci ${fiboEval.triggerLevel} level triggered`,
    suggestedSize: roundQuantity(scaledSize),
    currentEntries: openExecutions.length,
    maxEntries: config.maxEntries,
    profitPercent,
    exposurePercent: 0,
    mode: 'fibonacci',
    fiboTriggerLevel: fiboEval.triggerLevel,
    adjustedScaleFactor: scaleFactor,
  };
};
