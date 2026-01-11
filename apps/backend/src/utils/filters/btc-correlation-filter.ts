import { calculateEMA, calculateMACD, calculateRSI } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

const EMA_PERIOD = 21;
const RSI_PERIOD = 14;
const MIN_KLINES_REQUIRED = 30;

export const BTC_CORRELATION_FILTER = {
  EMA_PERIOD,
  RSI_PERIOD,
  MIN_KLINES_REQUIRED,
  BTC_PAIRS: ['BTCUSDT', 'BTCBUSD', 'BTCUSDC', 'BTCFDUSD'],
  SCORE_WEIGHTS: {
    emaPosition: 40,
    macdMomentum: 30,
    rsiMomentum: 20,
    rsiLevel: 10,
  },
  ASYMMETRIC_THRESHOLDS: {
    LONG_BLOCK_SCORE: 35,
    SHORT_BLOCK_SCORE: 65,
  },
} as const;

export type BtcTrend = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type BtcStrength = 'STRONG' | 'MODERATE' | 'WEAK';
export type RsiMomentum = 'RISING' | 'FALLING' | 'NEUTRAL';

export interface BtcCorrelationResult {
  isAllowed: boolean;
  btcTrend: BtcTrend;
  btcStrength: BtcStrength;
  btcEma21: number | null;
  btcPrice: number | null;
  btcMacdHistogram: number | null;
  btcRsi: number | null;
  btcRsiMomentum: RsiMomentum;
  isAltcoin: boolean;
  correlationScore: number;
  reason: string;
}

export const isBtcPair = (symbol: string): boolean => {
  return (BTC_CORRELATION_FILTER.BTC_PAIRS as readonly string[]).includes(symbol);
};

const calculateCorrelationScore = (
  priceAboveEma: boolean,
  macdBullish: boolean,
  macdBearish: boolean,
  rsiMomentum: RsiMomentum,
  rsiValue: number | null
): number => {
  const { SCORE_WEIGHTS } = BTC_CORRELATION_FILTER;
  let score = 50;

  if (priceAboveEma) score += SCORE_WEIGHTS.emaPosition / 2;
  else score -= SCORE_WEIGHTS.emaPosition / 2;

  if (macdBullish) score += SCORE_WEIGHTS.macdMomentum / 2;
  else if (macdBearish) score -= SCORE_WEIGHTS.macdMomentum / 2;

  if (rsiMomentum === 'RISING') score += SCORE_WEIGHTS.rsiMomentum / 2;
  else if (rsiMomentum === 'FALLING') score -= SCORE_WEIGHTS.rsiMomentum / 2;

  if (rsiValue !== null) {
    if (rsiValue > 50) score += SCORE_WEIGHTS.rsiLevel / 2;
    else if (rsiValue < 50) score -= SCORE_WEIGHTS.rsiLevel / 2;
  }

  return Math.max(0, Math.min(100, score));
};

const getStrength = (score: number): BtcStrength => {
  if (score >= 70 || score <= 30) return 'STRONG';
  if (score >= 60 || score <= 40) return 'MODERATE';
  return 'WEAK';
};

const getRsiMomentum = (
  rsiValues: (number | null)[],
  lastIndex: number
): { momentum: RsiMomentum; currentRsi: number | null } => {
  const currentRsi = rsiValues[lastIndex];
  const prevRsi = rsiValues[lastIndex - 1];

  if (currentRsi === undefined || currentRsi === null || isNaN(currentRsi)) {
    return { momentum: 'NEUTRAL', currentRsi: null };
  }

  if (prevRsi === undefined || prevRsi === null || isNaN(prevRsi)) {
    return { momentum: 'NEUTRAL', currentRsi };
  }

  const diff = currentRsi - prevRsi;
  if (diff > 1) return { momentum: 'RISING', currentRsi };
  if (diff < -1) return { momentum: 'FALLING', currentRsi };
  return { momentum: 'NEUTRAL', currentRsi };
};

const createNeutralResult = (
  isAltcoin: boolean,
  reason: string,
  partialData?: Partial<BtcCorrelationResult>
): BtcCorrelationResult => ({
  isAllowed: true,
  btcTrend: 'NEUTRAL',
  btcStrength: 'WEAK',
  btcEma21: null,
  btcPrice: null,
  btcMacdHistogram: null,
  btcRsi: null,
  btcRsiMomentum: 'NEUTRAL',
  isAltcoin,
  correlationScore: 50,
  reason,
  ...partialData,
});

export const checkBtcCorrelation = (
  btcKlines: Kline[],
  direction: 'LONG' | 'SHORT',
  tradingSymbol: string
): BtcCorrelationResult => {
  const isAltcoin = !isBtcPair(tradingSymbol);

  if (!isAltcoin) {
    return createNeutralResult(false, 'BTC pair - correlation filter not applicable');
  }

  if (btcKlines.length < MIN_KLINES_REQUIRED) {
    return createNeutralResult(
      true,
      `Insufficient BTC klines (${btcKlines.length} < ${MIN_KLINES_REQUIRED}) - allowing trade (soft pass)`
    );
  }

  const ema21Values = calculateEMA(btcKlines, EMA_PERIOD);
  const macdResult = calculateMACD(btcKlines);
  const rsiResult = calculateRSI(btcKlines, RSI_PERIOD);

  const lastIndex = btcKlines.length - 1;
  const btcEma21 = ema21Values[lastIndex];
  const btcMacdHistogram = macdResult.histogram[lastIndex];
  const lastKline = btcKlines[lastIndex];
  const { momentum: btcRsiMomentum, currentRsi: btcRsi } = getRsiMomentum(rsiResult.values, lastIndex);

  if (!lastKline || btcEma21 === null || btcEma21 === undefined) {
    return createNeutralResult(true, 'BTC EMA calculation incomplete - allowing trade (soft pass)', {
      btcEma21: btcEma21 ?? null,
      btcPrice: lastKline ? parseFloat(String(lastKline.close)) : null,
      btcMacdHistogram: isNaN(btcMacdHistogram ?? NaN) ? null : btcMacdHistogram ?? null,
      btcRsi,
      btcRsiMomentum,
    });
  }

  const btcPrice = parseFloat(String(lastKline.close));
  const priceAboveEma = btcPrice > btcEma21;
  const macdBullish = !isNaN(btcMacdHistogram ?? NaN) && (btcMacdHistogram ?? 0) > 0;
  const macdBearish = !isNaN(btcMacdHistogram ?? NaN) && (btcMacdHistogram ?? 0) < 0;

  const correlationScore = calculateCorrelationScore(priceAboveEma, macdBullish, macdBearish, btcRsiMomentum, btcRsi);
  const btcStrength = getStrength(correlationScore);

  let btcTrend: BtcTrend = 'NEUTRAL';
  if (correlationScore >= 60) {
    btcTrend = 'BULLISH';
  } else if (correlationScore <= 40) {
    btcTrend = 'BEARISH';
  }

  const formatPrice = (p: number) => p.toFixed(2);
  const safeHistogram = isNaN(btcMacdHistogram ?? NaN) ? null : btcMacdHistogram ?? null;
  const { ASYMMETRIC_THRESHOLDS } = BTC_CORRELATION_FILTER;

  const baseResult = {
    btcTrend,
    btcStrength,
    btcEma21,
    btcPrice,
    btcMacdHistogram: safeHistogram,
    btcRsi,
    btcRsiMomentum,
    isAltcoin: true,
    correlationScore,
  };

  if (direction === 'LONG' && correlationScore < ASYMMETRIC_THRESHOLDS.LONG_BLOCK_SCORE) {
    return {
      ...baseResult,
      isAllowed: false,
      reason: `LONG blocked: BTC bearish (score: ${correlationScore}) - price (${formatPrice(btcPrice)}) vs EMA21 (${formatPrice(btcEma21)}), RSI ${btcRsiMomentum.toLowerCase()}`,
    };
  }

  if (direction === 'SHORT' && correlationScore > ASYMMETRIC_THRESHOLDS.SHORT_BLOCK_SCORE) {
    return {
      ...baseResult,
      isAllowed: false,
      reason: `SHORT blocked: BTC bullish (score: ${correlationScore}) - price (${formatPrice(btcPrice)}) vs EMA21 (${formatPrice(btcEma21)}), RSI ${btcRsiMomentum.toLowerCase()}`,
    };
  }

  return {
    ...baseResult,
    isAllowed: true,
    reason: `Trade allowed: BTC ${btcTrend.toLowerCase()} (score: ${correlationScore}, strength: ${btcStrength.toLowerCase()}) aligns with ${direction}`,
  };
};
