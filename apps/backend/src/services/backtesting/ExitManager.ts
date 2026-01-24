import type { ComputedIndicators, EvaluationContext, Kline, MarketType, StrategyDefinition } from '@marketmind/types';
import type { ConditionEvaluator } from '../setup-detection/dynamic';

export interface ExitConfig {
  slippagePercent?: number;
  marketType?: MarketType;
  useBnbDiscount?: boolean;
}

export interface ExitResult {
  exitPrice: number;
  exitTime: string;
  exitReason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'EXIT_CONDITION' | 'MAX_BARS' | 'END_OF_PERIOD';
}

export class ExitManager {
  private config: ExitConfig;
  private conditionEvaluator: ConditionEvaluator;

  constructor(config: ExitConfig, conditionEvaluator: ConditionEvaluator) {
    this.config = config;
    this.conditionEvaluator = conditionEvaluator;
  }

  checkExitCondition(
    exitCondition: any,
    klines: Kline[],
    currentIndex: number,
    indicators: ComputedIndicators,
    params: Record<string, number>
  ): boolean {
    if (!exitCondition) return false;

    const context: EvaluationContext = {
      klines,
      currentIndex,
      indicators,
      params,
    };

    return this.conditionEvaluator.evaluate(exitCondition, context);
  }

  checkStopLossAndTakeProfit(
    direction: 'LONG' | 'SHORT',
    high: number,
    low: number,
    open: number,
    close: number,
    stopLoss: number | undefined,
    takeProfit: number | undefined
  ): { hit: 'SL' | 'TP' | 'BOTH' | null; price: number | undefined } {
    const slHit = stopLoss && (
      (direction === 'LONG' && low <= stopLoss) ||
      (direction === 'SHORT' && high >= stopLoss)
    );

    const tpHit = takeProfit && (
      (direction === 'LONG' && high >= takeProfit) ||
      (direction === 'SHORT' && low <= takeProfit)
    );

    if (slHit && tpHit) {
      const isBullishCandle = close > open;
      if (direction === 'LONG') {
        return {
          hit: isBullishCandle ? 'TP' : 'SL',
          price: isBullishCandle ? takeProfit : stopLoss,
        };
      } else {
        return {
          hit: isBullishCandle ? 'SL' : 'TP',
          price: isBullishCandle ? stopLoss : takeProfit,
        };
      }
    } else if (slHit) {
      return { hit: 'SL', price: stopLoss };
    } else if (tpHit) {
      return { hit: 'TP', price: takeProfit };
    }

    return { hit: null, price: undefined };
  }

  applySlippage(
    exitPrice: number,
    exitReason: string,
    direction: 'LONG' | 'SHORT'
  ): number {
    if (exitReason !== 'STOP_LOSS' && exitReason !== 'TAKE_PROFIT') {
      return exitPrice;
    }

    const slippagePercent = this.config.slippagePercent ?? 0.1;
    const slippageAmount = exitPrice * (slippagePercent / 100);

    if (exitReason === 'STOP_LOSS') {
      return direction === 'LONG'
        ? exitPrice - slippageAmount
        : exitPrice + slippageAmount;
    } else {
      return direction === 'LONG'
        ? exitPrice - slippageAmount
        : exitPrice + slippageAmount;
    }
  }

  findExit(
    setup: any,
    klines: Kline[],
    actualEntryKlineIndex: number,
    stopLoss: number | undefined,
    takeProfit: number | undefined,
    strategy: StrategyDefinition | undefined,
    computedIndicators: ComputedIndicators | null,
    resolvedParams: Record<string, number>
  ): ExitResult | null {
    const exitConditions = strategy?.exit?.conditions;
    const maxBarsInTrade = strategy?.exit?.maxBarsInTrade;
    const exitConditionForDirection = setup.direction === 'LONG'
      ? exitConditions?.long
      : exitConditions?.short;

    let barsInTrade = 0;

    const actualEntryKline = klines[actualEntryKlineIndex];
    const actualEntryTime = actualEntryKline?.openTime ?? setup.openTime;

    const futureKlines = klines.filter((k) => k.openTime > actualEntryTime);

    for (const futureKline of futureKlines) {
      barsInTrade++;
      const futureIndex = klines.findIndex(k => k.openTime === futureKline.openTime);
      const high = parseFloat(String(futureKline.high));
      const low = parseFloat(String(futureKline.low));
      const open = parseFloat(String(futureKline.open));
      const close = parseFloat(String(futureKline.close));

      if (exitConditionForDirection && computedIndicators && futureIndex >= 0) {
        const exitConditionMet = this.checkExitCondition(
          exitConditionForDirection,
          klines,
          futureIndex,
          computedIndicators,
          resolvedParams
        );
        if (exitConditionMet) {
          const finalPrice = this.applySlippage(close, 'EXIT_CONDITION', setup.direction);
          return {
            exitPrice: finalPrice,
            exitTime: new Date(futureKline.openTime).toISOString(),
            exitReason: 'EXIT_CONDITION',
          };
        }
      }

      if (maxBarsInTrade && barsInTrade >= maxBarsInTrade) {
        return {
          exitPrice: close,
          exitTime: new Date(futureKline.openTime).toISOString(),
          exitReason: 'MAX_BARS',
        };
      }

      const slTpResult = this.checkStopLossAndTakeProfit(
        setup.direction,
        high,
        low,
        open,
        close,
        stopLoss,
        takeProfit
      );

      if (slTpResult.hit && slTpResult.price !== undefined) {
        const exitReason = slTpResult.hit === 'TP' ? 'TAKE_PROFIT' : 'STOP_LOSS';
        const finalPrice = this.applySlippage(slTpResult.price, exitReason, setup.direction);
        return {
          exitPrice: finalPrice,
          exitTime: new Date(futureKline.openTime).toISOString(),
          exitReason,
        };
      }
    }

    const lastKline = klines[klines.length - 1];
    if (lastKline) {
      return {
        exitPrice: parseFloat(String(lastKline.close)),
        exitTime: new Date(lastKline.openTime).toISOString(),
        exitReason: 'END_OF_PERIOD',
      };
    }

    return null;
  }
}
