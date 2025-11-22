import type { Candle } from '@shared/types';

export interface SimplifiedCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OptimizationResult {
  detailed: Candle[];
  simplified: SimplifiedCandle[];
  timestampInfo: {
    first: number;
    last: number;
    total: number;
    timeframe: string;
  };
}

const DETAILED_CANDLES_COUNT = 32;
const MAX_SIMPLIFIED_CANDLES = 1000;

export const detectTimeframe = (candles: Candle[]): string => {
  if (candles.length < 2) return 'unknown';

  const firstCandle = candles[0];
  const secondCandle = candles[1];
  if (!firstCandle || !secondCandle) return 'unknown';

  const diff = secondCandle.timestamp - firstCandle.timestamp;

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff <= minute) return '1m';
  if (diff <= 5 * minute) return '5m';
  if (diff <= 15 * minute) return '15m';
  if (diff <= 30 * minute) return '30m';
  if (diff <= hour) return '1h';
  if (diff <= 4 * hour) return '4h';
  if (diff <= day) return '1d';
  if (diff <= 7 * day) return '1w';

  return 'unknown';
};

export const simplifyCandle = (candle: Candle): SimplifiedCandle => {
  return {
    timestamp: candle.timestamp,
    open: Math.round(candle.open * 100) / 100,
    high: Math.round(candle.high * 100) / 100,
    low: Math.round(candle.low * 100) / 100,
    close: Math.round(candle.close * 100) / 100,
    volume: Math.round(candle.volume),
  };
};

export const optimizeCandles = (
  candles: Candle[],
  detailedCount: number = DETAILED_CANDLES_COUNT
): OptimizationResult => {
  if (candles.length === 0) {
    return {
      detailed: [],
      simplified: [],
      timestampInfo: {
        first: 0,
        last: 0,
        total: 0,
        timeframe: 'unknown',
      },
    };
  }

  const timeframe = detectTimeframe(candles);
  const detailed = candles.slice(-detailedCount);
  const remainingCandles = candles.slice(0, -detailedCount);

  let simplified: SimplifiedCandle[];
  if (remainingCandles.length > MAX_SIMPLIFIED_CANDLES) {
    const step = Math.ceil(remainingCandles.length / MAX_SIMPLIFIED_CANDLES);
    simplified = [];
    for (let i = 0; i < remainingCandles.length; i += step) {
      const candle = remainingCandles[i];
      if (candle) {
        simplified.push(simplifyCandle(candle));
      }
    }
  } else {
    simplified = remainingCandles.map(simplifyCandle);
  }

  const firstCandle = candles[0];
  const lastCandle = candles[candles.length - 1];

  return {
    detailed,
    simplified,
    timestampInfo: {
      first: firstCandle?.timestamp || 0,
      last: lastCandle?.timestamp || 0,
      total: candles.length,
      timeframe,
    },
  };
};
