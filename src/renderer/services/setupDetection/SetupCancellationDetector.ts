import { calculateEMA } from '@renderer/utils/movingAverages';
import type { Candle, SetupCancellationReason, TradingSetup } from '@shared/types';

const EMA_PERIOD = 9;
const LOOKBACK_TWO = 2;
const STRUCTURE_BUFFER_LONG = 0.995;
const STRUCTURE_BUFFER_SHORT = 1.005;
const PULLBACK_BUFFER_LONG = 0.99;
const PULLBACK_BUFFER_SHORT = 1.01;

export class SetupCancellationDetector {
  checkCancellation(
    setup: TradingSetup,
    candles: Candle[],
    currentIndex: number,
  ): { isCancelled: boolean; reason?: SetupCancellationReason } {
    if (setup.isTriggered) return { isCancelled: false };
    if (setup.isCancelled && setup.cancellationReason) {
      return { isCancelled: true, reason: setup.cancellationReason };
    }

    switch (setup.type) {
      case 'setup-9-1':
        return this.checkSetup91Cancellation(setup, candles, currentIndex);
      case 'setup-9-2':
        return this.checkSetup92Cancellation(setup, candles, currentIndex);
      case 'setup-9-3':
        return this.checkSetup93Cancellation(setup, candles, currentIndex);
      case 'setup-9-4':
        return this.checkSetup94Cancellation(setup, candles, currentIndex);
      case '123-reversal':
        return this.checkPattern123Cancellation(setup, candles, currentIndex);
      case 'bull-trap':
        return this.checkBullTrapCancellation(setup, candles, currentIndex);
      case 'bear-trap':
        return this.checkBearTrapCancellation(setup, candles, currentIndex);
      case 'breakout-retest':
        return this.checkBreakoutRetestCancellation(setup, candles, currentIndex);
      default:
        return { isCancelled: false };
    }
  }

  private checkSetup91Cancellation(
    setup: TradingSetup,
    candles: Candle[],
    currentIndex: number,
  ): { isCancelled: boolean; reason?: SetupCancellationReason } {
    const ema9 = calculateEMA(candles, EMA_PERIOD);
    const current = candles[currentIndex];
    const ema9Current = ema9[currentIndex];
    const ema9Prev = ema9[currentIndex - 1];
    const ema9PrevPrev = ema9[currentIndex - LOOKBACK_TWO];

    if (!this.hasValidEmaData(current, ema9Current, ema9Prev, ema9PrevPrev)) {
      return { isCancelled: false };
    }

    if (!current || ema9Current === null || ema9Current === undefined || 
        ema9Prev === null || ema9Prev === undefined || 
        ema9PrevPrev === null || ema9PrevPrev === undefined) {
      return { isCancelled: false };
    }

    if (setup.direction === 'LONG') {
      return this.checkSetup91LongCancellation(setup, current, ema9Current, ema9Prev, ema9PrevPrev);
    }
    
    return this.checkSetup91ShortCancellation(setup, current, ema9Current, ema9Prev, ema9PrevPrev);
  }

  private hasValidEmaData(
    current: Candle | undefined,
    ema9Current: number | null | undefined,
    ema9Prev: number | null | undefined,
    ema9PrevPrev?: number | null | undefined,
  ): boolean {
    if (!current || ema9Current === null || ema9Current === undefined || 
        ema9Prev === null || ema9Prev === undefined) {
      return false;
    }
    if (ema9PrevPrev !== undefined && (ema9PrevPrev === null || ema9PrevPrev === undefined)) {
      return false;
    }
    return true;
  }

  private checkSetup91LongCancellation(
    setup: TradingSetup,
    current: Candle,
    ema9Current: number,
    ema9Prev: number,
    ema9PrevPrev: number,
  ): { isCancelled: boolean; reason?: SetupCancellationReason } {
    if (ema9PrevPrev > ema9Prev && ema9Current < ema9Prev) {
      return { isCancelled: true, reason: 'ema-reversal' };
    }
    if (current.close < ema9Current) {
      return { isCancelled: true, reason: 'ema-reversal' };
    }
    if (current.low < setup.stopLoss) {
      return { isCancelled: true, reason: 'swing-lost' };
    }
    return { isCancelled: false };
  }

  private checkSetup91ShortCancellation(
    setup: TradingSetup,
    current: Candle,
    ema9Current: number,
    ema9Prev: number,
    ema9PrevPrev: number,
  ): { isCancelled: boolean; reason?: SetupCancellationReason } {
    if (ema9PrevPrev < ema9Prev && ema9Current > ema9Prev) {
      return { isCancelled: true, reason: 'ema-reversal' };
    }
    if (current.close > ema9Current) {
      return { isCancelled: true, reason: 'ema-reversal' };
    }
    if (current.high > setup.stopLoss) {
      return { isCancelled: true, reason: 'swing-lost' };
    }
    return { isCancelled: false };
  }

  private checkSetup92Cancellation(
    setup: TradingSetup,
    candles: Candle[],
    currentIndex: number,
  ): { isCancelled: boolean; reason?: SetupCancellationReason } {
    const ema9 = calculateEMA(candles, EMA_PERIOD);
    const current = candles[currentIndex];
    const ema9Current = ema9[currentIndex];
    const ema9Prev = ema9[currentIndex - 1];

    if (!this.hasValidEmaData(current, ema9Current, ema9Prev)) {
      return { isCancelled: false };
    }

    if (!current || ema9Current === null || ema9Current === undefined || 
        ema9Prev === null || ema9Prev === undefined) {
      return { isCancelled: false };
    }

    if (setup.direction === 'LONG') {
      if (ema9Current < ema9Prev) {
        return { isCancelled: true, reason: 'trend-broken' };
      }
      const setupCandle = candles[setup.candleIndex];
      if (setupCandle && current.low < setupCandle.low * STRUCTURE_BUFFER_LONG) {
        return { isCancelled: true, reason: 'structure-broken' };
      }
    } else {
      if (ema9Current > ema9Prev) {
        return { isCancelled: true, reason: 'trend-broken' };
      }
      const setupCandle = candles[setup.candleIndex];
      if (setupCandle && current.high > setupCandle.high * STRUCTURE_BUFFER_SHORT) {
        return { isCancelled: true, reason: 'structure-broken' };
      }
    }

    return { isCancelled: false };
  }

  private checkSetup93Cancellation(
    setup: TradingSetup,
    candles: Candle[],
    currentIndex: number,
  ): { isCancelled: boolean; reason?: SetupCancellationReason } {
    const ema9 = calculateEMA(candles, EMA_PERIOD);
    const current = candles[currentIndex];
    const ema9Current = ema9[currentIndex];
    const ema9Prev = ema9[currentIndex - 1];

    if (!this.hasValidEmaData(current, ema9Current, ema9Prev)) {
      return { isCancelled: false };
    }

    if (!current || ema9Current === null || ema9Current === undefined || 
        ema9Prev === null || ema9Prev === undefined) {
      return { isCancelled: false };
    }

    if (setup.direction === 'LONG') {
      if (ema9Current < ema9Prev) {
        return { isCancelled: true, reason: 'trend-broken' };
      }
      const setupCandle = candles[setup.candleIndex];
      if (setupCandle && current.low < setupCandle.low * PULLBACK_BUFFER_LONG) {
        return { isCancelled: true, reason: 'pullback-exceeded' };
      }
    } else {
      if (ema9Current > ema9Prev) {
        return { isCancelled: true, reason: 'trend-broken' };
      }
      const setupCandle = candles[setup.candleIndex];
      if (setupCandle && current.high > setupCandle.high * PULLBACK_BUFFER_SHORT) {
        return { isCancelled: true, reason: 'pullback-exceeded' };
      }
    }

    return { isCancelled: false };
  }

  private checkSetup94Cancellation(
    setup: TradingSetup,
    candles: Candle[],
    currentIndex: number,
  ): { isCancelled: boolean; reason?: SetupCancellationReason } {
    const ema9 = calculateEMA(candles, EMA_PERIOD);
    const current = candles[currentIndex];
    const ema9Current = ema9[currentIndex];
    const ema9Prev = ema9[currentIndex - 1];
    const ema9TwoPrev = ema9[currentIndex - LOOKBACK_TWO];

    if (!this.hasValidEmaData(current, ema9Current, ema9Prev, ema9TwoPrev)) {
      return { isCancelled: false };
    }

    if (!current || ema9Current === null || ema9Current === undefined || 
        ema9Prev === null || ema9Prev === undefined || 
        ema9TwoPrev === null || ema9TwoPrev === undefined) {
      return { isCancelled: false };
    }

    if (setup.direction === 'LONG') {
      return this.checkSetup94LongCancellation(setup, candles, current, ema9Current, ema9Prev, ema9TwoPrev);
    }
    
    return this.checkSetup94ShortCancellation(setup, candles, current, ema9Current, ema9Prev, ema9TwoPrev);
  }

  private checkSetup94LongCancellation(
    setup: TradingSetup,
    candles: Candle[],
    current: Candle,
    ema9Current: number,
    ema9Prev: number,
    ema9TwoPrev: number,
  ): { isCancelled: boolean; reason?: SetupCancellationReason } {
    const failureContinues = ema9TwoPrev > ema9Prev && ema9Prev > ema9Current;
    if (failureContinues) {
      return { isCancelled: true, reason: 'failure-exceeded' };
    }
    
    const setupData = setup.setupData as { failureCandle?: boolean };
    if (setupData.failureCandle) {
      const failureCandle = candles[setup.candleIndex - 1];
      if (failureCandle && current.low < failureCandle.low) {
        return { isCancelled: true, reason: 'extreme-lost' };
      }
    }
    
    if (ema9Current < ema9Prev) {
      return { isCancelled: true, reason: 'trend-broken' };
    }
    
    return { isCancelled: false };
  }

  private checkSetup94ShortCancellation(
    setup: TradingSetup,
    candles: Candle[],
    current: Candle,
    ema9Current: number,
    ema9Prev: number,
    ema9TwoPrev: number,
  ): { isCancelled: boolean; reason?: SetupCancellationReason } {
    const failureContinues = ema9TwoPrev < ema9Prev && ema9Prev < ema9Current;
    if (failureContinues) {
      return { isCancelled: true, reason: 'failure-exceeded' };
    }
    
    const setupData = setup.setupData as { failureCandle?: boolean };
    if (setupData.failureCandle) {
      const failureCandle = candles[setup.candleIndex - 1];
      if (failureCandle && current.high > failureCandle.high) {
        return { isCancelled: true, reason: 'extreme-lost' };
      }
    }
    
    if (ema9Current > ema9Prev) {
      return { isCancelled: true, reason: 'trend-broken' };
    }
    
    return { isCancelled: false };
  }

  private checkPattern123Cancellation(
    setup: TradingSetup,
    candles: Candle[],
    currentIndex: number,
  ): { isCancelled: boolean; reason?: SetupCancellationReason } {
    const current = candles[currentIndex];
    if (!current) return { isCancelled: false };

    const setupData = setup.setupData as { 
      p1?: { price: number }; 
      p2?: { price: number }; 
      p3?: { price: number }; 
    };

    if (!setupData.p3) return { isCancelled: false };

    if (setup.direction === 'LONG') {
      if (current.low < setupData.p3.price) {
        return { isCancelled: true, reason: 'pattern-invalidated' };
      }
      if (setupData.p2 && current.close < setupData.p2.price) {
        return { isCancelled: true, reason: 'breakout-failed' };
      }
    } else {
      if (current.high > setupData.p3.price) {
        return { isCancelled: true, reason: 'pattern-invalidated' };
      }
      if (setupData.p2 && current.close > setupData.p2.price) {
        return { isCancelled: true, reason: 'breakout-failed' };
      }
    }

    return { isCancelled: false };
  }

  private checkBullTrapCancellation(
    setup: TradingSetup,
    candles: Candle[],
    currentIndex: number,
  ): { isCancelled: boolean; reason?: SetupCancellationReason } {
    const current = candles[currentIndex];
    if (!current) return { isCancelled: false };

    const setupData = setup.setupData as { trapHighPrice?: number; supportPrice?: number };
    
    if (setupData.trapHighPrice && current.close > setupData.trapHighPrice) {
      return { isCancelled: true, reason: 'trap-invalidated' };
    }

    if (setupData.supportPrice && current.low < setupData.supportPrice * STRUCTURE_BUFFER_LONG) {
      return { isCancelled: true, reason: 'structure-broken' };
    }

    return { isCancelled: false };
  }

  private checkBearTrapCancellation(
    setup: TradingSetup,
    candles: Candle[],
    currentIndex: number,
  ): { isCancelled: boolean; reason?: SetupCancellationReason } {
    const current = candles[currentIndex];
    if (!current) return { isCancelled: false };

    const setupData = setup.setupData as { trapLowPrice?: number; supportPrice?: number };
    
    if (setupData.trapLowPrice && current.close < setupData.trapLowPrice) {
      return { isCancelled: true, reason: 'trap-invalidated' };
    }

    if (setupData.supportPrice && current.high > setupData.supportPrice * STRUCTURE_BUFFER_SHORT) {
      return { isCancelled: true, reason: 'structure-broken' };
    }

    return { isCancelled: false };
  }

  private checkBreakoutRetestCancellation(
    setup: TradingSetup,
    candles: Candle[],
    currentIndex: number,
  ): { isCancelled: boolean; reason?: SetupCancellationReason } {
    const current = candles[currentIndex];
    if (!current) return { isCancelled: false };

    const setupData = setup.setupData as { resistanceLevel?: number; supportLevel?: number };

    if (setup.direction === 'LONG' && setupData.resistanceLevel) {
      if (current.close < setupData.resistanceLevel * STRUCTURE_BUFFER_LONG) {
        return { isCancelled: true, reason: 'retest-failed' };
      }
    } else if (setup.direction === 'SHORT' && setupData.supportLevel) {
      if (current.close > setupData.supportLevel * STRUCTURE_BUFFER_SHORT) {
        return { isCancelled: true, reason: 'retest-failed' };
      }
    }

    return { isCancelled: false };
  }
}

export const setupCancellationDetector = new SetupCancellationDetector();
