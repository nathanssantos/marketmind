import { PineIndicatorService } from '../../services/pine/PineIndicatorService';
import type { Kline } from '@marketmind/types';

const pineService = new PineIndicatorService();

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
  const currentRsi = rsiValues[lastIndex] ?? null;
  const prevRsi = rsiValues[lastIndex - 1] ?? null;

  if (currentRsi === null || isNaN(currentRsi)) {
    return { momentum: 'NEUTRAL', currentRsi: null };
  }

  if (prevRsi === null || isNaN(prevRsi)) {
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

export interface BtcTrendInfo {
  trend: BtcTrend;
  strength: BtcStrength;
  score: number;
  canLong: boolean;
  canShort: boolean;
  btcPrice: number | null;
  btcEma21: number | null;
}

const computeIndicators = async (btcKlines: Kline[]) => {
  const [ema21Values, macdResult, rsiValues] = await Promise.all([
    pineService.compute('ema', btcKlines, { period: EMA_PERIOD }),
    pineService.computeMulti('macd', btcKlines),
    pineService.compute('rsi', btcKlines, { period: RSI_PERIOD }),
  ]);
  return { ema21Values, macdResult, rsiValues };
};

export const getBtcTrendInfo = async (btcKlines: Kline[]): Promise<BtcTrendInfo> => {
  const { ASYMMETRIC_THRESHOLDS } = BTC_CORRELATION_FILTER;

  if (btcKlines.length < MIN_KLINES_REQUIRED) {
    return {
      trend: 'NEUTRAL',
      strength: 'WEAK',
      score: 50,
      canLong: true,
      canShort: true,
      btcPrice: null,
      btcEma21: null,
    };
  }

  const { ema21Values, macdResult, rsiValues } = await computeIndicators(btcKlines);
  const histogramValues = macdResult['histogram'] ?? [];

  const lastIndex = btcKlines.length - 1;
  const btcEma21 = ema21Values[lastIndex] ?? null;
  const btcMacdHistogram = histogramValues[lastIndex] ?? null;
  const lastKline = btcKlines[lastIndex];
  const { momentum: btcRsiMomentum, currentRsi: btcRsi } = getRsiMomentum(rsiValues, lastIndex);

  if (!lastKline || btcEma21 === null) {
    return {
      trend: 'NEUTRAL',
      strength: 'WEAK',
      score: 50,
      canLong: true,
      canShort: true,
      btcPrice: lastKline ? parseFloat(String(lastKline.close)) : null,
      btcEma21,
    };
  }

  const btcPrice = parseFloat(String(lastKline.close));
  const priceAboveEma = btcPrice > btcEma21;
  const macdBullish = btcMacdHistogram !== null && !isNaN(btcMacdHistogram) && btcMacdHistogram > 0;
  const macdBearish = btcMacdHistogram !== null && !isNaN(btcMacdHistogram) && btcMacdHistogram < 0;

  const score = calculateCorrelationScore(priceAboveEma, macdBullish, macdBearish, btcRsiMomentum, btcRsi);
  const strength = getStrength(score);

  let trend: BtcTrend = 'NEUTRAL';
  if (score >= 60) trend = 'BULLISH';
  else if (score <= 40) trend = 'BEARISH';

  return {
    trend,
    strength,
    score,
    canLong: score >= ASYMMETRIC_THRESHOLDS.LONG_BLOCK_SCORE,
    canShort: score <= ASYMMETRIC_THRESHOLDS.SHORT_BLOCK_SCORE,
    btcPrice,
    btcEma21,
  };
};

export type Ema21Direction = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface Ema21TrendResult {
  direction: Ema21Direction;
  price: number | null;
  ema21: number | null;
}

export interface Ema21AlignmentResult {
  isAligned: boolean;
  btcDirection: Ema21Direction;
  assetDirection: Ema21Direction;
  reason: string;
}

export const getEma21Direction = async (klines: Kline[]): Promise<Ema21TrendResult> => {
  if (klines.length < MIN_KLINES_REQUIRED) {
    return { direction: 'NEUTRAL', price: null, ema21: null };
  }

  const ema21Values = await pineService.compute('ema', klines, { period: EMA_PERIOD });
  const lastIndex = klines.length - 1;
  const ema21 = ema21Values[lastIndex] ?? null;
  const lastKline = klines[lastIndex];

  if (!lastKline || ema21 === null) {
    return { direction: 'NEUTRAL', price: null, ema21: null };
  }

  const price = parseFloat(String(lastKline.close));
  const direction: Ema21Direction = price > ema21 ? 'BULLISH' : 'BEARISH';

  return { direction, price, ema21 };
};

export const checkEma21Alignment = async (
  btcKlines: Kline[],
  assetKlines: Kline[]
): Promise<Ema21AlignmentResult> => {
  const [btcTrend, assetTrend] = await Promise.all([
    getEma21Direction(btcKlines),
    getEma21Direction(assetKlines),
  ]);

  if (btcTrend.direction === 'NEUTRAL' || assetTrend.direction === 'NEUTRAL') {
    return {
      isAligned: true,
      btcDirection: btcTrend.direction,
      assetDirection: assetTrend.direction,
      reason: 'Insufficient data - allowing',
    };
  }

  const isAligned = btcTrend.direction === assetTrend.direction;

  return {
    isAligned,
    btcDirection: btcTrend.direction,
    assetDirection: assetTrend.direction,
    reason: isAligned
      ? `Aligned: both ${btcTrend.direction}`
      : `Misaligned: BTC ${btcTrend.direction}, Asset ${assetTrend.direction}`,
  };
};

export interface BtcTrendHistoryPoint {
  timestamp: number;
  price: number;
  ema21: number;
}

export interface BtcTrendInfoWithHistory extends BtcTrendInfo {
  history: BtcTrendHistoryPoint[];
}

export const getBtcTrendEmaInfoWithHistory = async (btcKlines: Kline[]): Promise<BtcTrendInfoWithHistory> => {
  const baseInfo = await getBtcTrendEmaInfo(btcKlines);

  if (btcKlines.length < MIN_KLINES_REQUIRED) {
    return { ...baseInfo, history: [] };
  }

  const ema21Values = await pineService.compute('ema', btcKlines, { period: EMA_PERIOD });
  const history: BtcTrendHistoryPoint[] = [];

  for (let i = Math.max(0, btcKlines.length - 31); i < btcKlines.length; i++) {
    const kline = btcKlines[i];
    const ema21 = ema21Values[i];
    if (kline && ema21 !== null && ema21 !== undefined) {
      history.push({
        timestamp: kline.openTime,
        price: parseFloat(String(kline.close)),
        ema21,
      });
    }
  }

  return { ...baseInfo, history };
};

export const getBtcTrendEmaInfo = async (btcKlines: Kline[]): Promise<BtcTrendInfo> => {
  if (btcKlines.length < MIN_KLINES_REQUIRED) {
    return {
      trend: 'NEUTRAL',
      strength: 'WEAK',
      score: 50,
      canLong: true,
      canShort: true,
      btcPrice: null,
      btcEma21: null,
    };
  }

  const ema21Values = await pineService.compute('ema', btcKlines, { period: EMA_PERIOD });
  const lastIndex = btcKlines.length - 1;
  const btcEma21 = ema21Values[lastIndex] ?? null;
  const lastKline = btcKlines[lastIndex];

  if (!lastKline || btcEma21 === null) {
    return {
      trend: 'NEUTRAL',
      strength: 'WEAK',
      score: 50,
      canLong: true,
      canShort: true,
      btcPrice: lastKline ? parseFloat(String(lastKline.close)) : null,
      btcEma21,
    };
  }

  const btcPrice = parseFloat(String(lastKline.close));
  const priceAboveEma = btcPrice > btcEma21;
  const emaDiff = Math.abs(btcPrice - btcEma21) / btcEma21 * 100;

  const trend: BtcTrend = priceAboveEma ? 'BULLISH' : 'BEARISH';
  const strength: BtcStrength = emaDiff >= 3 ? 'STRONG' : emaDiff >= 1 ? 'MODERATE' : 'WEAK';
  const score = priceAboveEma ? Math.min(100, 50 + emaDiff * 10) : Math.max(0, 50 - emaDiff * 10);

  return {
    trend,
    strength,
    score: Math.round(score),
    canLong: priceAboveEma,
    canShort: !priceAboveEma,
    btcPrice,
    btcEma21,
  };
};

export const checkBtcCorrelation = async (
  btcKlines: Kline[],
  direction: 'LONG' | 'SHORT',
  tradingSymbol: string
): Promise<BtcCorrelationResult> => {
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

  const { ema21Values, macdResult, rsiValues } = await computeIndicators(btcKlines);
  const histogramValues = macdResult['histogram'] ?? [];

  const lastIndex = btcKlines.length - 1;
  const btcEma21 = ema21Values[lastIndex] ?? null;
  const btcMacdHistogram = histogramValues[lastIndex] ?? null;
  const lastKline = btcKlines[lastIndex];
  const { momentum: btcRsiMomentum, currentRsi: btcRsi } = getRsiMomentum(rsiValues, lastIndex);

  if (!lastKline || btcEma21 === null) {
    return createNeutralResult(true, 'BTC EMA calculation incomplete - allowing trade (soft pass)', {
      btcEma21,
      btcPrice: lastKline ? parseFloat(String(lastKline.close)) : null,
      btcMacdHistogram: btcMacdHistogram !== null && !isNaN(btcMacdHistogram) ? btcMacdHistogram : null,
      btcRsi,
      btcRsiMomentum,
    });
  }

  const btcPrice = parseFloat(String(lastKline.close));
  const priceAboveEma = btcPrice > btcEma21;
  const macdBullish = btcMacdHistogram !== null && !isNaN(btcMacdHistogram) && btcMacdHistogram > 0;
  const macdBearish = btcMacdHistogram !== null && !isNaN(btcMacdHistogram) && btcMacdHistogram < 0;

  const correlationScore = calculateCorrelationScore(priceAboveEma, macdBullish, macdBearish, btcRsiMomentum, btcRsi);
  const btcStrength = getStrength(correlationScore);

  let btcTrend: BtcTrend = 'NEUTRAL';
  if (correlationScore >= 60) {
    btcTrend = 'BULLISH';
  } else if (correlationScore <= 40) {
    btcTrend = 'BEARISH';
  }

  const formatPrice = (p: number) => p.toFixed(2);
  const safeHistogram = btcMacdHistogram !== null && !isNaN(btcMacdHistogram) ? btcMacdHistogram : null;
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
