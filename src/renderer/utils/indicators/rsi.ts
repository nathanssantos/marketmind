import type { Candle } from '@shared/types';

const DEFAULT_RSI_PERIOD = 14;
const RSI_OVERSOLD = 30;
const RSI_OVERBOUGHT = 70;
const RSI_MAX = 100;

export const calculateRSI = (
  candles: Candle[],
  period = DEFAULT_RSI_PERIOD,
): number[] => {
  if (candles.length === 0) return [];
  if (period <= 0) return [];

  const rsi: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      rsi.push(NaN);
      gains.push(0);
      losses.push(0);
      continue;
    }

    const current = candles[i];
    const previous = candles[i - 1];

    if (!current || !previous) {
      rsi.push(NaN);
      gains.push(0);
      losses.push(0);
      continue;
    }

    const change = current.close - previous.close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    gains.push(gain);
    losses.push(loss);

    if (i < period) {
      rsi.push(NaN);
      continue;
    }

    if (i === period) {
      let sumGains = 0;
      let sumLosses = 0;

      for (let j = 1; j <= period; j++) {
        sumGains += gains[j] ?? 0;
        sumLosses += losses[j] ?? 0;
      }

      const avgGain = sumGains / period;
      const avgLoss = sumLosses / period;

      if (avgLoss === 0) {
        rsi.push(RSI_MAX);
      } else {
        const rs = avgGain / avgLoss;
        rsi.push(RSI_MAX - RSI_MAX / (1 + rs));
      }
    } else {
      const prevRSI = rsi[i - 1];
      if (prevRSI === undefined || isNaN(prevRSI)) {
        rsi.push(NaN);
        continue;
      }

      const prevRS = prevRSI === RSI_MAX ? Infinity : (RSI_MAX - prevRSI) / prevRSI;
      const prevAvgGain = prevRS === Infinity ? gains[i]! : (prevRS * period) / (period + 1);
      const prevAvgLoss = prevRS === Infinity ? 0 : period / (period + 1);

      const currentGain = gains[i] ?? 0;
      const currentLoss = losses[i] ?? 0;

      const avgGain = (prevAvgGain * (period - 1) + currentGain) / period;
      const avgLoss = (prevAvgLoss * (period - 1) + currentLoss) / period;

      if (avgLoss === 0) {
        rsi.push(RSI_MAX);
      } else {
        const rs = avgGain / avgLoss;
        rsi.push(RSI_MAX - RSI_MAX / (1 + rs));
      }
    }
  }

  return rsi;
};

export const isRSIOversold = (rsiValue: number): boolean =>
  rsiValue < RSI_OVERSOLD;

export const isRSIOverbought = (rsiValue: number): boolean =>
  rsiValue > RSI_OVERBOUGHT;

export const findRSIDivergence = (
  candles: Candle[],
  rsi: number[],
  lookback = 10,
): { bullish: number[]; bearish: number[] } => {
  const bullish: number[] = [];
  const bearish: number[] = [];

  if (candles.length < lookback || rsi.length < lookback) {
    return { bullish, bearish };
  }

  for (let i = lookback; i < candles.length; i++) {
    const recentCandles = candles.slice(i - lookback, i + 1);
    const recentRSI = rsi.slice(i - lookback, i + 1);

    const priceLows = recentCandles.map((c, idx) => ({ price: c.low, idx }));
    const priceHighs = recentCandles.map((c, idx) => ({ price: c.high, idx }));

    priceLows.sort((a, b) => a.price - b.price);
    priceHighs.sort((a, b) => b.price - a.price);

    const lowestPriceIdx = priceLows[0]?.idx;
    const secondLowestPriceIdx = priceLows[1]?.idx;
    const highestPriceIdx = priceHighs[0]?.idx;
    const secondHighestPriceIdx = priceHighs[1]?.idx;

    if (
      lowestPriceIdx !== undefined &&
      secondLowestPriceIdx !== undefined &&
      lowestPriceIdx > secondLowestPriceIdx
    ) {
      const lowestPrice = priceLows[0]!.price;
      const secondLowestPrice = priceLows[1]!.price;
      const lowestRSI = recentRSI[lowestPriceIdx];
      const secondLowestRSI = recentRSI[secondLowestPriceIdx];

      if (
        lowestRSI !== undefined &&
        secondLowestRSI !== undefined &&
        !isNaN(lowestRSI) &&
        !isNaN(secondLowestRSI) &&
        lowestPrice < secondLowestPrice &&
        lowestRSI > secondLowestRSI
      ) {
        bullish.push(i);
      }
    }

    if (
      highestPriceIdx !== undefined &&
      secondHighestPriceIdx !== undefined &&
      highestPriceIdx > secondHighestPriceIdx
    ) {
      const highestPrice = priceHighs[0]!.price;
      const secondHighestPrice = priceHighs[1]!.price;
      const highestRSI = recentRSI[highestPriceIdx];
      const secondHighestRSI = recentRSI[secondHighestPriceIdx];

      if (
        highestRSI !== undefined &&
        secondHighestRSI !== undefined &&
        !isNaN(highestRSI) &&
        !isNaN(secondHighestRSI) &&
        highestPrice > secondHighestPrice &&
        highestRSI < secondHighestRSI
      ) {
        bearish.push(i);
      }
    }
  }

  return { bullish, bearish };
};
