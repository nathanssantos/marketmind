import type { Kline } from '@marketmind/types';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { calculateATR } from './atr';
import { calculateBollingerBands, calculateBollingerBandsArray, calculateBBWidth, calculateBBPercentB } from './bollingerBands';
import { calculateMACD } from './macd';
import { calculateSMA, calculateEMA } from './movingAverages';
import { calculateRSI } from './rsi';
import { calculateStochastic } from './stochastic';
import { calculateMFI } from './mfi';
import { calculateOBV } from './obv';

const createKlineArbitrary = (index: number) =>
  fc.record({
    close: fc.double({ min: 0.01, max: 100000, noNaN: true }),
    open: fc.double({ min: 0.01, max: 100000, noNaN: true }),
    high: fc.double({ min: 0.01, max: 100000, noNaN: true }),
    low: fc.double({ min: 0.01, max: 100000, noNaN: true }),
    volume: fc.double({ min: 0.01, max: 1000000000, noNaN: true }),
  }).map(({ close, open, high, low, volume }) => {
    const adjustedHigh = Math.max(open, close, high);
    const adjustedLow = Math.min(open, close, low);

    return {
      openTime: new Date(2024, 0, index + 1).getTime(),
      open: String(open),
      high: String(adjustedHigh),
      low: String(adjustedLow),
      close: String(close),
      volume: String(volume),
      closeTime: new Date(2024, 0, index + 1, 23, 59, 59).getTime(),
      quoteVolume: String(volume * close),
      trades: 100,
      takerBuyBaseVolume: String(volume * 0.5),
      takerBuyQuoteVolume: String(volume * close * 0.5),
    } as Kline;
  });

const klineArrayArbitrary = (minLength: number, maxLength: number) =>
  fc.integer({ min: minLength, max: maxLength }).chain((length) =>
    fc.tuple(...Array.from({ length }, (_, i) => createKlineArbitrary(i)))
  );

const createRisingKlines = (length: number, startPrice: number): Kline[] =>
  Array.from({ length }, (_, i) => {
    const price = startPrice + i;
    return {
      openTime: new Date(2024, 0, i + 1).getTime(),
      open: String(price - 0.5),
      high: String(price + 1),
      low: String(price - 1),
      close: String(price),
      volume: '1000',
      closeTime: new Date(2024, 0, i + 1, 23, 59, 59).getTime(),
      quoteVolume: String(1000 * price),
      trades: 100,
      takerBuyBaseVolume: '500',
      takerBuyQuoteVolume: String(500 * price),
    } as Kline;
  });

const createFallingKlines = (length: number, startPrice: number): Kline[] =>
  Array.from({ length }, (_, i) => {
    const price = startPrice - i;
    return {
      openTime: new Date(2024, 0, i + 1).getTime(),
      open: String(price + 0.5),
      high: String(price + 1),
      low: String(price - 1),
      close: String(price),
      volume: '1000',
      closeTime: new Date(2024, 0, i + 1, 23, 59, 59).getTime(),
      quoteVolume: String(1000 * price),
      trades: 100,
      takerBuyBaseVolume: '500',
      takerBuyQuoteVolume: String(500 * price),
    } as Kline;
  });

describe('Property-Based Testing: Indicators', () => {
  describe('RSI Properties', () => {
    it('should always return values between 0 and 100', () => {
      fc.assert(
        fc.property(klineArrayArbitrary(20, 100), (klines) => {
          const result = calculateRSI(klines, 14);
          return result.values.every((v) => v === null || (v >= 0 && v <= 100));
        }),
        { numRuns: 100 }
      );
    });

    it('should return 100 (or close) for continuously rising prices', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 20, max: 50 }),
          fc.double({ min: 10, max: 1000, noNaN: true }),
          (length, startPrice) => {
            const klines = createRisingKlines(length, startPrice);
            const result = calculateRSI(klines, 14);
            const lastValue = result.values[result.values.length - 1];
            return lastValue === null || lastValue >= 90;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return 0 (or close) for continuously falling prices', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 20, max: 50 }),
          fc.double({ min: 100, max: 10000, noNaN: true }),
          (length, startPrice) => {
            const klines = createFallingKlines(length, startPrice);
            const result = calculateRSI(klines, 14);
            const lastValue = result.values[result.values.length - 1];
            return lastValue === null || lastValue <= 10;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return null for first period values', () => {
      fc.assert(
        fc.property(
          klineArrayArbitrary(20, 100),
          fc.integer({ min: 2, max: 14 }),
          (klines, period) => {
            const result = calculateRSI(klines, period);
            for (let i = 0; i < period; i++) {
              if (result.values[i] !== null) return false;
            }
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should have same length output as input', () => {
      fc.assert(
        fc.property(klineArrayArbitrary(5, 100), (klines) => {
          const result = calculateRSI(klines, 2);
          return result.values.length === klines.length;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('MACD Properties', () => {
    it('should have histogram equal to macd minus signal', () => {
      fc.assert(
        fc.property(klineArrayArbitrary(35, 100), (klines) => {
          const result = calculateMACD(klines, 12, 26, 9);
          for (let i = 0; i < result.macd.length; i++) {
            if (!isNaN(result.macd[i]) && !isNaN(result.signal[i])) {
              const expected = result.macd[i] - result.signal[i];
              const actual = result.histogram[i];
              if (Math.abs(expected - actual) > 0.0000001) return false;
            }
          }
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should have same length arrays', () => {
      fc.assert(
        fc.property(klineArrayArbitrary(35, 100), (klines) => {
          const result = calculateMACD(klines, 12, 26, 9);
          return (
            result.macd.length === klines.length &&
            result.signal.length === klines.length &&
            result.histogram.length === klines.length
          );
        }),
        { numRuns: 100 }
      );
    });

    it('should return NaN for early periods', () => {
      fc.assert(
        fc.property(klineArrayArbitrary(35, 100), (klines) => {
          const result = calculateMACD(klines, 12, 26, 9);
          for (let i = 0; i < 25; i++) {
            if (!isNaN(result.macd[i])) return false;
          }
          return true;
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Bollinger Bands Properties', () => {
    it('should have upper > middle > lower', () => {
      fc.assert(
        fc.property(klineArrayArbitrary(25, 100), (klines) => {
          const bb = calculateBollingerBands(klines, 20, 2);
          if (!bb) return true;
          return bb.upper > bb.middle && bb.middle > bb.lower;
        }),
        { numRuns: 100 }
      );
    });

    it('should have symmetric bands around middle', () => {
      fc.assert(
        fc.property(klineArrayArbitrary(25, 100), (klines) => {
          const bb = calculateBollingerBands(klines, 20, 2);
          if (!bb) return true;
          const upperDist = bb.upper - bb.middle;
          const lowerDist = bb.middle - bb.lower;
          return Math.abs(upperDist - lowerDist) < 0.0000001;
        }),
        { numRuns: 100 }
      );
    });

    it('should return null for insufficient data', () => {
      fc.assert(
        fc.property(
          klineArrayArbitrary(1, 19),
          fc.integer({ min: 20, max: 50 }),
          (klines, period) => {
            const bb = calculateBollingerBands(klines, period, 2);
            return bb === null;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('array version should have correct null pattern', () => {
      fc.assert(
        fc.property(klineArrayArbitrary(25, 100), (klines) => {
          const bbArray = calculateBollingerBandsArray(klines, 20, 2);
          for (let i = 0; i < 19; i++) {
            if (bbArray[i] !== null) return false;
          }
          for (let i = 19; i < klines.length; i++) {
            if (bbArray[i] === null) return false;
          }
          return true;
        }),
        { numRuns: 50 }
      );
    });

    it('BBWidth should always be positive', () => {
      fc.assert(
        fc.property(klineArrayArbitrary(25, 100), (klines) => {
          const bb = calculateBollingerBands(klines, 20, 2);
          if (!bb) return true;
          return calculateBBWidth(bb) >= 0;
        }),
        { numRuns: 100 }
      );
    });

    it('BB%B should be 0.5 when price equals middle', () => {
      fc.assert(
        fc.property(klineArrayArbitrary(25, 100), (klines) => {
          const bb = calculateBollingerBands(klines, 20, 2);
          if (!bb) return true;
          const percentB = calculateBBPercentB(bb.middle, bb);
          return Math.abs(percentB - 0.5) < 0.0000001;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Moving Average Properties', () => {
    it('SMA should be within min/max of period prices', () => {
      fc.assert(
        fc.property(klineArrayArbitrary(25, 100), (klines) => {
          const sma = calculateSMA(klines, 20);
          for (let i = 19; i < klines.length; i++) {
            const value = sma[i];
            if (value === null) continue;
            const periodKlines = klines.slice(i - 19, i + 1);
            const closes = periodKlines.map((k) => parseFloat(k.close));
            const min = Math.min(...closes);
            const max = Math.max(...closes);
            if (value < min - 0.0001 || value > max + 0.0001) return false;
          }
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('EMA should converge to price in constant price scenario', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 10, max: 10000, noNaN: true }),
          fc.integer({ min: 50, max: 100 }),
          (price, length) => {
            const klines: Kline[] = Array.from({ length }, (_, i) => ({
              openTime: new Date(2024, 0, i + 1).getTime(),
              open: String(price),
              high: String(price),
              low: String(price),
              close: String(price),
              volume: '1000',
              closeTime: new Date(2024, 0, i + 1, 23, 59, 59).getTime(),
              quoteVolume: String(1000 * price),
              trades: 100,
              takerBuyBaseVolume: '500',
              takerBuyQuoteVolume: String(500 * price),
            }));
            const ema = calculateEMA(klines, 20);
            const lastValue = ema[ema.length - 1];
            return lastValue === null || Math.abs(lastValue - price) < 0.0001;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('SMA should equal simple average for constant prices', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 10, max: 10000, noNaN: true }),
          fc.integer({ min: 25, max: 100 }),
          (price, length) => {
            const klines: Kline[] = Array.from({ length }, (_, i) => ({
              openTime: new Date(2024, 0, i + 1).getTime(),
              open: String(price),
              high: String(price),
              low: String(price),
              close: String(price),
              volume: '1000',
              closeTime: new Date(2024, 0, i + 1, 23, 59, 59).getTime(),
              quoteVolume: String(1000 * price),
              trades: 100,
              takerBuyBaseVolume: '500',
              takerBuyQuoteVolume: String(500 * price),
            }));
            const sma = calculateSMA(klines, 20);
            const lastValue = sma[sma.length - 1];
            return lastValue === null || Math.abs(lastValue - price) < 0.0001;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('SMA and EMA should have same length as input', () => {
      fc.assert(
        fc.property(klineArrayArbitrary(25, 100), (klines) => {
          const sma = calculateSMA(klines, 20);
          const ema = calculateEMA(klines, 20);
          return sma.length === klines.length && ema.length === klines.length;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Stochastic Properties', () => {
    it('should always return values between 0 and 100', () => {
      fc.assert(
        fc.property(klineArrayArbitrary(20, 100), (klines) => {
          const result = calculateStochastic(klines, 14, 3, 3);
          const kValid = result.k.every((v) => v === null || (v >= 0 && v <= 100));
          const dValid = result.d.every((v) => v === null || (v >= 0 && v <= 100));
          return kValid && dValid;
        }),
        { numRuns: 100 }
      );
    });

    it('should return 100 when close equals high for period', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 100, max: 1000, noNaN: true }),
          fc.integer({ min: 20, max: 50 }),
          (highPrice, length) => {
            const klines: Kline[] = Array.from({ length }, (_, i) => ({
              openTime: new Date(2024, 0, i + 1).getTime(),
              open: String(highPrice - 10),
              high: String(highPrice),
              low: String(highPrice - 20),
              close: String(highPrice),
              volume: '1000',
              closeTime: new Date(2024, 0, i + 1, 23, 59, 59).getTime(),
              quoteVolume: String(1000 * highPrice),
              trades: 100,
              takerBuyBaseVolume: '500',
              takerBuyQuoteVolume: String(500 * highPrice),
            }));
            const result = calculateStochastic(klines, 14, 1, 1);
            const lastK = result.k[result.k.length - 1];
            return lastK === null || Math.abs(lastK - 100) < 0.01;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should have same length output as input', () => {
      fc.assert(
        fc.property(klineArrayArbitrary(20, 100), (klines) => {
          const result = calculateStochastic(klines, 14, 3, 3);
          return result.k.length === klines.length && result.d.length === klines.length;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('ATR Properties', () => {
    it('should always be positive or NaN', () => {
      fc.assert(
        fc.property(klineArrayArbitrary(20, 100), (klines) => {
          const atr = calculateATR(klines, 14);
          return atr.every((v) => isNaN(v) || v >= 0);
        }),
        { numRuns: 100 }
      );
    });

    it('should be zero for flat prices', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 10, max: 10000, noNaN: true }),
          fc.integer({ min: 20, max: 50 }),
          (price, length) => {
            const klines: Kline[] = Array.from({ length }, (_, i) => ({
              openTime: new Date(2024, 0, i + 1).getTime(),
              open: String(price),
              high: String(price),
              low: String(price),
              close: String(price),
              volume: '1000',
              closeTime: new Date(2024, 0, i + 1, 23, 59, 59).getTime(),
              quoteVolume: String(1000 * price),
              trades: 100,
              takerBuyBaseVolume: '500',
              takerBuyQuoteVolume: String(500 * price),
            }));
            const atr = calculateATR(klines, 14);
            const lastValue = atr[atr.length - 1];
            return isNaN(lastValue) || Math.abs(lastValue) < 0.0001;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should have same length as input', () => {
      fc.assert(
        fc.property(klineArrayArbitrary(20, 100), (klines) => {
          const atr = calculateATR(klines, 14);
          return atr.length === klines.length;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('MFI Properties', () => {
    it('should always return values between 0 and 100', () => {
      fc.assert(
        fc.property(klineArrayArbitrary(20, 100), (klines) => {
          const result = calculateMFI(klines, 14);
          return result.every((v) => v === null || (v >= 0 && v <= 100));
        }),
        { numRuns: 100 }
      );
    });

    it('should have same length as input', () => {
      fc.assert(
        fc.property(klineArrayArbitrary(20, 100), (klines) => {
          const result = calculateMFI(klines, 14);
          return result.length === klines.length;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('OBV Properties', () => {
    it('should have same length as input', () => {
      fc.assert(
        fc.property(klineArrayArbitrary(20, 100), (klines) => {
          const result = calculateOBV(klines);
          return result.values.length === klines.length;
        }),
        { numRuns: 100 }
      );
    });

    it('first OBV should equal first volume', () => {
      fc.assert(
        fc.property(klineArrayArbitrary(5, 100), (klines) => {
          const result = calculateOBV(klines);
          const firstVolume = parseFloat(klines[0].volume);
          return Math.abs(result.values[0] - firstVolume) < 0.0001;
        }),
        { numRuns: 100 }
      );
    });
  });
});
