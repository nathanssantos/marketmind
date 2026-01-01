import type { ComputedIndicators, EvaluationContext, Kline, MarketType, StrategyDefinition } from '@marketmind/types';
import type { ConditionEvaluator } from '../setup-detection/dynamic';
import {
  computeTrailingStopCore,
  type TrailingStopCoreConfig,
} from '../trailing-stop-core';

export interface ExitConfig {
  useTrailingStop?: boolean;
  trailingATRMultiplier?: number;
  breakEvenAfterR?: number;
  slippagePercent?: number;
  marketType?: MarketType;
  useBnbDiscount?: boolean;
}

export interface ExitResult {
  exitPrice: number;
  exitTime: string;
  exitReason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'EXIT_CONDITION' | 'MAX_BARS' | 'END_OF_PERIOD';
}

export interface TrailingStopState {
  trailingStop: number | undefined;
  highestHigh: number;
  lowestLow: number;
  feesCoveredReached: boolean;
  takeProfit?: number;
}

export class ExitManager {
  private config: ExitConfig;
  private conditionEvaluator: ConditionEvaluator;
  private coreConfig: TrailingStopCoreConfig;

  constructor(config: ExitConfig, conditionEvaluator: ConditionEvaluator) {
    this.config = config;
    this.conditionEvaluator = conditionEvaluator;
    this.coreConfig = {
      marketType: config.marketType ?? 'SPOT',
      useBnbDiscount: config.useBnbDiscount ?? false,
      atrMultiplier: config.trailingATRMultiplier ?? 2.0,
    };
  }

  initializeTrailingStopState(entryPrice: number, stopLoss: number | undefined, takeProfit?: number): TrailingStopState {
    return {
      trailingStop: stopLoss,
      highestHigh: entryPrice,
      lowestLow: entryPrice,
      feesCoveredReached: false,
      takeProfit,
    };
  }

  updateTrailingStop(
    state: TrailingStopState,
    direction: 'LONG' | 'SHORT',
    entryPrice: number,
    high: number,
    low: number,
    close: number,
    atrAtEntry: number,
    trailMultiplier: number,
    barsInTrade: number,
    useTrailingStop: boolean,
    stopLoss: number | undefined
  ): TrailingStopState {
    if (!useTrailingStop || !stopLoss || barsInTrade <= 1) {
      return state;
    }

    const newState = { ...state };
    const isLong = direction === 'LONG';

    if (isLong) {
      if (high > newState.highestHigh) newState.highestHigh = high;
    } else {
      if (low < newState.lowestLow) newState.lowestLow = low;
    }

    const result = computeTrailingStopCore(
      {
        entryPrice,
        currentPrice: close,
        currentStopLoss: newState.trailingStop ?? null,
        side: direction,
        takeProfit: newState.takeProfit,
        atr: atrAtEntry,
        highestPrice: isLong ? newState.highestHigh : undefined,
        lowestPrice: isLong ? undefined : newState.lowestLow,
      },
      {
        ...this.coreConfig,
        atrMultiplier: trailMultiplier,
      }
    );

    if (result) {
      newState.trailingStop = result.newStopLoss;
      newState.feesCoveredReached = true;
    }

    return newState;
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
    effectiveSL: number | undefined,
    effectiveTP: number | undefined,
    useTrailingStop: boolean
  ): { hit: 'SL' | 'TP' | 'BOTH' | null; price: number | undefined } {
    const slHit = effectiveSL && (
      (direction === 'LONG' && low <= effectiveSL) ||
      (direction === 'SHORT' && high >= effectiveSL)
    );

    const tpToCheck = useTrailingStop ? undefined : effectiveTP;
    const tpHit = tpToCheck && (
      (direction === 'LONG' && high >= tpToCheck) ||
      (direction === 'SHORT' && low <= tpToCheck)
    );

    if (slHit && tpHit) {
      const isBullishCandle = close > open;
      if (direction === 'LONG') {
        return {
          hit: isBullishCandle ? 'TP' : 'SL',
          price: isBullishCandle ? tpToCheck : effectiveSL,
        };
      } else {
        return {
          hit: isBullishCandle ? 'SL' : 'TP',
          price: isBullishCandle ? effectiveSL : tpToCheck,
        };
      }
    } else if (slHit) {
      return { hit: 'SL', price: effectiveSL };
    } else if (tpHit) {
      return { hit: 'TP', price: tpToCheck };
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
    entryPrice: number,
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

    const trailingStopConfig = strategy?.exit?.trailingStop;
    const useTrailingStop = trailingStopConfig?.enabled ?? this.config.useTrailingStop ?? false;
    const trailMultiplier = this.config.trailingATRMultiplier ?? trailingStopConfig?.trailMultiplier ?? 2;
    const atrAtEntry = setup.atr ?? (stopLoss ? Math.abs(entryPrice - stopLoss) / 1.5 : entryPrice * 0.02);

    let trailingState = this.initializeTrailingStopState(entryPrice, stopLoss, takeProfit);
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

      trailingState = this.updateTrailingStop(
        trailingState,
        setup.direction,
        entryPrice,
        high,
        low,
        close,
        atrAtEntry,
        trailMultiplier,
        barsInTrade,
        useTrailingStop,
        stopLoss
      );

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

      const effectiveSL = useTrailingStop ? trailingState.trailingStop : stopLoss;
      const effectiveTP = useTrailingStop ? undefined : takeProfit;

      const slTpResult = this.checkStopLossAndTakeProfit(
        setup.direction,
        high,
        low,
        open,
        close,
        effectiveSL,
        effectiveTP,
        useTrailingStop
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
