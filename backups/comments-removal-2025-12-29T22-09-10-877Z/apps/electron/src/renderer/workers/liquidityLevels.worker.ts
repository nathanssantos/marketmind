import { calculateLiquidityLevels, type LiquidityLevel } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
const getKlineLow = (kline: Kline): number => parseFloat(kline.low);
const getKlineClose = (kline: Kline): number => parseFloat(kline.close);

self.onmessage = (event: MessageEvent<{ klines: Kline[]; lookback?: number }>) => {
  const { klines, lookback = 50 } = event.data;

  const highs = klines.map(getKlineHigh);
  const lows = klines.map(getKlineLow);
  const closes = klines.map(getKlineClose);

  const result: LiquidityLevel[] = calculateLiquidityLevels(highs, lows, closes, { lookback });
  self.postMessage(result);
};
