import type { Kline } from '@marketmind/types';
import { bench, describe } from 'vitest';
import { calculateATR } from './atr';
import { calculateBollingerBands, calculateBollingerBandsArray } from './bollingerBands';
import { calculateMACD } from './macd';
import { calculateSMA, calculateEMA } from './movingAverages';
import { calculateRSI } from './rsi';
import { calculateStochastic } from './stochastic';
import { calculateSupertrend } from './supertrend';
import { calculateIchimoku } from './ichimoku';
import { calculateADX } from './adx';
import { calculateOBV } from './obv';
import { calculateMFI } from './mfi';
import { calculateVWAP } from './vwap';

const generateRandomKlines = (count: number): Kline[] => {
  const klines: Kline[] = [];
  let price = 100;

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 2;
    const open = price;
    price = price + change;
    const close = price;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    const volume = 1000 + Math.random() * 10000;

    klines.push({
      openTime: Date.now() + i * 60000,
      open: String(open),
      high: String(high),
      low: String(low),
      close: String(close),
      volume: String(volume),
      closeTime: Date.now() + (i + 1) * 60000 - 1,
      quoteVolume: String(volume * close),
      trades: Math.floor(Math.random() * 1000),
      takerBuyBaseVolume: String(volume * 0.5),
      takerBuyQuoteVolume: String(volume * close * 0.5),
    });
  }

  return klines;
};

const klines1k = generateRandomKlines(1000);
const klines5k = generateRandomKlines(5000);
const klines10k = generateRandomKlines(10000);

describe('Moving Averages', () => {
  describe('SMA', () => {
    bench('1k klines, period 20', () => {
      calculateSMA(klines1k, 20);
    });

    bench('5k klines, period 20', () => {
      calculateSMA(klines5k, 20);
    });

    bench('10k klines, period 20', () => {
      calculateSMA(klines10k, 20);
    });

    bench('10k klines, period 200', () => {
      calculateSMA(klines10k, 200);
    });
  });

  describe('EMA', () => {
    bench('1k klines, period 20', () => {
      calculateEMA(klines1k, 20);
    });

    bench('5k klines, period 20', () => {
      calculateEMA(klines5k, 20);
    });

    bench('10k klines, period 20', () => {
      calculateEMA(klines10k, 20);
    });

    bench('10k klines, period 200', () => {
      calculateEMA(klines10k, 200);
    });
  });
});

describe('Momentum Indicators', () => {
  describe('RSI', () => {
    bench('1k klines, period 14', () => {
      calculateRSI(klines1k, 14);
    });

    bench('5k klines, period 14', () => {
      calculateRSI(klines5k, 14);
    });

    bench('10k klines, period 14', () => {
      calculateRSI(klines10k, 14);
    });
  });

  describe('MACD', () => {
    bench('1k klines', () => {
      calculateMACD(klines1k, 12, 26, 9);
    });

    bench('5k klines', () => {
      calculateMACD(klines5k, 12, 26, 9);
    });

    bench('10k klines', () => {
      calculateMACD(klines10k, 12, 26, 9);
    });
  });

  describe('Stochastic', () => {
    bench('1k klines', () => {
      calculateStochastic(klines1k, 14, 3, 3);
    });

    bench('5k klines', () => {
      calculateStochastic(klines5k, 14, 3, 3);
    });

    bench('10k klines', () => {
      calculateStochastic(klines10k, 14, 3, 3);
    });
  });
});

describe('Volatility Indicators', () => {
  describe('Bollinger Bands', () => {
    bench('1k klines (single)', () => {
      calculateBollingerBands(klines1k, 20, 2);
    });

    bench('10k klines (single)', () => {
      calculateBollingerBands(klines10k, 20, 2);
    });

    bench('1k klines (array)', () => {
      calculateBollingerBandsArray(klines1k, 20, 2);
    });

    bench('5k klines (array)', () => {
      calculateBollingerBandsArray(klines5k, 20, 2);
    });

    bench('10k klines (array)', () => {
      calculateBollingerBandsArray(klines10k, 20, 2);
    });
  });

  describe('ATR', () => {
    bench('1k klines', () => {
      calculateATR(klines1k, 14);
    });

    bench('5k klines', () => {
      calculateATR(klines5k, 14);
    });

    bench('10k klines', () => {
      calculateATR(klines10k, 14);
    });
  });
});

describe('Trend Indicators', () => {
  describe('ADX', () => {
    bench('1k klines', () => {
      calculateADX(klines1k, 14);
    });

    bench('5k klines', () => {
      calculateADX(klines5k, 14);
    });

    bench('10k klines', () => {
      calculateADX(klines10k, 14);
    });
  });

  describe('Supertrend', () => {
    bench('1k klines', () => {
      calculateSupertrend(klines1k, 10, 3);
    });

    bench('5k klines', () => {
      calculateSupertrend(klines5k, 10, 3);
    });

    bench('10k klines', () => {
      calculateSupertrend(klines10k, 10, 3);
    });
  });

  describe('Ichimoku', () => {
    bench('1k klines', () => {
      calculateIchimoku(klines1k, 9, 26, 52, 26);
    });

    bench('5k klines', () => {
      calculateIchimoku(klines5k, 9, 26, 52, 26);
    });

    bench('10k klines', () => {
      calculateIchimoku(klines10k, 9, 26, 52, 26);
    });
  });
});

describe('Volume Indicators', () => {
  describe('OBV', () => {
    bench('1k klines', () => {
      calculateOBV(klines1k);
    });

    bench('5k klines', () => {
      calculateOBV(klines5k);
    });

    bench('10k klines', () => {
      calculateOBV(klines10k);
    });
  });

  describe('MFI', () => {
    bench('1k klines', () => {
      calculateMFI(klines1k, 14);
    });

    bench('5k klines', () => {
      calculateMFI(klines5k, 14);
    });

    bench('10k klines', () => {
      calculateMFI(klines10k, 14);
    });
  });

  describe('VWAP', () => {
    bench('1k klines', () => {
      calculateVWAP(klines1k);
    });

    bench('5k klines', () => {
      calculateVWAP(klines5k);
    });

    bench('10k klines', () => {
      calculateVWAP(klines10k);
    });
  });
});

describe('Combined Indicator Suite', () => {
  bench('All common indicators (1k klines)', () => {
    calculateSMA(klines1k, 20);
    calculateEMA(klines1k, 20);
    calculateRSI(klines1k, 14);
    calculateMACD(klines1k, 12, 26, 9);
    calculateBollingerBandsArray(klines1k, 20, 2);
    calculateATR(klines1k, 14);
    calculateStochastic(klines1k, 14, 3, 3);
  });

  bench('All common indicators (5k klines)', () => {
    calculateSMA(klines5k, 20);
    calculateEMA(klines5k, 20);
    calculateRSI(klines5k, 14);
    calculateMACD(klines5k, 12, 26, 9);
    calculateBollingerBandsArray(klines5k, 20, 2);
    calculateATR(klines5k, 14);
    calculateStochastic(klines5k, 14, 3, 3);
  });

  bench('Full analysis suite (1k klines)', () => {
    calculateSMA(klines1k, 20);
    calculateSMA(klines1k, 50);
    calculateSMA(klines1k, 200);
    calculateEMA(klines1k, 9);
    calculateEMA(klines1k, 21);
    calculateRSI(klines1k, 14);
    calculateMACD(klines1k, 12, 26, 9);
    calculateBollingerBandsArray(klines1k, 20, 2);
    calculateATR(klines1k, 14);
    calculateStochastic(klines1k, 14, 3, 3);
    calculateADX(klines1k, 14);
    calculateOBV(klines1k);
    calculateVWAP(klines1k);
    calculateSupertrend(klines1k, 10, 3);
    calculateIchimoku(klines1k, 9, 26, 52, 26);
  });
});
