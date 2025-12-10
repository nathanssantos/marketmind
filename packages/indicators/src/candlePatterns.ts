import type { Kline } from '@marketmind/types';

const getKlineOpen = (kline: Kline): number => parseFloat(kline.open);
const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
const getKlineLow = (kline: Kline): number => parseFloat(kline.low);
const getKlineClose = (kline: Kline): number => parseFloat(kline.close);

export type CandlePattern =
  | 'doji'
  | 'hammer'
  | 'inverted_hammer'
  | 'hanging_man'
  | 'shooting_star'
  | 'bullish_engulfing'
  | 'bearish_engulfing'
  | 'morning_star'
  | 'evening_star'
  | 'three_white_soldiers'
  | 'three_black_crows';

export interface PatternDetection {
  index: number;
  pattern: CandlePattern;
  signal: 'bullish' | 'bearish' | 'neutral';
  timestamp: number;
}

export interface CandlePatternsResult {
  patterns: PatternDetection[];
  doji: boolean[];
  hammer: boolean[];
  engulfing: ('bullish' | 'bearish' | null)[];
}

const getBodySize = (kline: Kline): number =>
  Math.abs(getKlineClose(kline) - getKlineOpen(kline));

const getUpperWick = (kline: Kline): number =>
  getKlineHigh(kline) - Math.max(getKlineOpen(kline), getKlineClose(kline));

const getLowerWick = (kline: Kline): number =>
  Math.min(getKlineOpen(kline), getKlineClose(kline)) - getKlineLow(kline);

const getCandleRange = (kline: Kline): number => getKlineHigh(kline) - getKlineLow(kline);

const isBullish = (kline: Kline): boolean => getKlineClose(kline) > getKlineOpen(kline);

const isDoji = (kline: Kline, threshold: number = 0.1): boolean => {
  const body = getBodySize(kline);
  const range = getCandleRange(kline);
  return range > 0 && body / range < threshold;
};

const isHammer = (kline: Kline, bodyRatio: number = 0.3, wickRatio: number = 2): boolean => {
  const body = getBodySize(kline);
  const range = getCandleRange(kline);
  const lowerWick = getLowerWick(kline);
  const upperWick = getUpperWick(kline);

  return (
    range > 0 &&
    body / range < bodyRatio &&
    lowerWick > body * wickRatio &&
    upperWick < body
  );
};

const isInvertedHammer = (
  kline: Kline,
  bodyRatio: number = 0.3,
  wickRatio: number = 2,
): boolean => {
  const body = getBodySize(kline);
  const range = getCandleRange(kline);
  const lowerWick = getLowerWick(kline);
  const upperWick = getUpperWick(kline);

  return (
    range > 0 &&
    body / range < bodyRatio &&
    upperWick > body * wickRatio &&
    lowerWick < body
  );
};

export const calculateCandlePatterns = (klines: Kline[]): CandlePatternsResult => {
  if (klines.length === 0) {
    return { patterns: [], doji: [], hammer: [], engulfing: [] };
  }

  const patterns: PatternDetection[] = [];
  const doji: boolean[] = [];
  const hammer: boolean[] = [];
  const engulfing: ('bullish' | 'bearish' | null)[] = [];

  for (let i = 0; i < klines.length; i++) {
    const k = klines[i]!;

    const isDoj = isDoji(k);
    doji.push(isDoj);
    if (isDoj) {
      patterns.push({
        index: i,
        pattern: 'doji',
        signal: 'neutral',
        timestamp: k.openTime,
      });
    }

    const isHam = isHammer(k);
    hammer.push(isHam);
    if (isHam) {
      patterns.push({
        index: i,
        pattern: 'hammer',
        signal: 'bullish',
        timestamp: k.openTime,
      });
    }

    if (isInvertedHammer(k)) {
      patterns.push({
        index: i,
        pattern: 'inverted_hammer',
        signal: 'bullish',
        timestamp: k.openTime,
      });
    }

    if (i === 0) {
      engulfing.push(null);
      continue;
    }

    const prev = klines[i - 1]!;
    const prevOpen = getKlineOpen(prev);
    const prevClose = getKlineClose(prev);
    const currOpen = getKlineOpen(k);
    const currClose = getKlineClose(k);

    if (
      !isBullish(prev) &&
      isBullish(k) &&
      currOpen < prevClose &&
      currClose > prevOpen
    ) {
      engulfing.push('bullish');
      patterns.push({
        index: i,
        pattern: 'bullish_engulfing',
        signal: 'bullish',
        timestamp: k.openTime,
      });
    } else if (
      isBullish(prev) &&
      !isBullish(k) &&
      currOpen > prevClose &&
      currClose < prevOpen
    ) {
      engulfing.push('bearish');
      patterns.push({
        index: i,
        pattern: 'bearish_engulfing',
        signal: 'bearish',
        timestamp: k.openTime,
      });
    } else {
      engulfing.push(null);
    }

    if (i >= 2) {
      const k1 = klines[i - 2]!;
      const k2 = klines[i - 1]!;
      const k3 = klines[i]!;

      if (
        !isBullish(k1) &&
        isDoji(k2) &&
        isBullish(k3) &&
        getKlineClose(k3) > (getKlineOpen(k1) + getKlineClose(k1)) / 2
      ) {
        patterns.push({
          index: i,
          pattern: 'morning_star',
          signal: 'bullish',
          timestamp: k3.openTime,
        });
      }

      if (
        isBullish(k1) &&
        isDoji(k2) &&
        !isBullish(k3) &&
        getKlineClose(k3) < (getKlineOpen(k1) + getKlineClose(k1)) / 2
      ) {
        patterns.push({
          index: i,
          pattern: 'evening_star',
          signal: 'bearish',
          timestamp: k3.openTime,
        });
      }

      if (isBullish(k1) && isBullish(k2) && isBullish(k3)) {
        const closes = [getKlineClose(k1), getKlineClose(k2), getKlineClose(k3)];
        const opens = [getKlineOpen(k1), getKlineOpen(k2), getKlineOpen(k3)];
        if (closes[1]! > closes[0]! && closes[2]! > closes[1]! && opens[1]! > opens[0]! && opens[2]! > opens[1]!) {
          patterns.push({
            index: i,
            pattern: 'three_white_soldiers',
            signal: 'bullish',
            timestamp: k3.openTime,
          });
        }
      }

      if (!isBullish(k1) && !isBullish(k2) && !isBullish(k3)) {
        const closes = [getKlineClose(k1), getKlineClose(k2), getKlineClose(k3)];
        const opens = [getKlineOpen(k1), getKlineOpen(k2), getKlineOpen(k3)];
        if (closes[1]! < closes[0]! && closes[2]! < closes[1]! && opens[1]! < opens[0]! && opens[2]! < opens[1]!) {
          patterns.push({
            index: i,
            pattern: 'three_black_crows',
            signal: 'bearish',
            timestamp: k3.openTime,
          });
        }
      }
    }
  }

  return { patterns, doji, hammer, engulfing };
};
