import type { AIStudy, Candle } from '@shared/types';
import {
    IMPORTANCE_NORMALIZATION,
    IMPORTANCE_WEIGHTS,
    PATTERN_RELIABILITY_WEIGHTS,
} from '../constants';
import type { ImportanceFactors } from '../types';
import {
    calculateFormationPeriod,
    getPatternEndTimestamp,
    getPatternMaxPrice,
    getPatternMinPrice,
} from './patternRelationships';

export function normalizeFormationPeriod(period: number): number {
  if (period <= 0) return 0;
  if (period >= IMPORTANCE_NORMALIZATION.FORMATION_PERIOD_MAX_CANDLES) return 1.0;

  return Math.min(
    1.0,
    Math.log(period / IMPORTANCE_NORMALIZATION.FORMATION_PERIOD_BASE_DIVISOR) /
      Math.log(IMPORTANCE_NORMALIZATION.FORMATION_PERIOD_LOG_BASE)
  );
}

export function normalizePriceMovement(
  pattern: AIStudy,
  candles: Candle[]
): number {
  if (candles.length === 0) return 0;

  const minPrice = getPatternMinPrice(pattern);
  const maxPrice = getPatternMaxPrice(pattern);
  const priceRange = maxPrice - minPrice;

  if (priceRange <= 0) return 0;

  const avgPrice = candles.reduce((sum, c) => sum + c.close, 0) / candles.length;
  const percentMultiplier = 100;
  const priceMovementPercent = (priceRange / avgPrice) * percentMultiplier;

  if (priceMovementPercent >= IMPORTANCE_NORMALIZATION.PRICE_MOVEMENT_MAX_PERCENT) {
    return 1.0;
  }

  if (priceMovementPercent <= IMPORTANCE_NORMALIZATION.PRICE_MOVEMENT_MIN_PERCENT) {
    return IMPORTANCE_NORMALIZATION.PRICE_MOVEMENT_MIN_SCORE;
  }

  return Math.min(
    1.0,
    Math.log(priceMovementPercent) /
      Math.log(IMPORTANCE_NORMALIZATION.PRICE_MOVEMENT_MAX_PERCENT)
  );
}

export function normalizeRecency(pattern: AIStudy, candles: Candle[]): number {
  if (candles.length === 0) return 0;

  const latestCandle = candles[candles.length - 1];
  if (!latestCandle) return 0;

  const latestTimestamp = latestCandle.timestamp;
  const patternEndTime = getPatternEndTimestamp(pattern);
  const timeSincePattern = latestTimestamp - patternEndTime;

  if (timeSincePattern <= 0) return 1.0;

  const firstCandle = candles[0];
  const lastCandle = candles[candles.length - 1];

  const avgCandleInterval =
    candles.length > 1 && firstCandle && lastCandle
      ? (lastCandle.timestamp - firstCandle.timestamp) / (candles.length - 1)
      : 1;

  const candlesSincePattern = timeSincePattern / avgCandleInterval;

  if (candlesSincePattern >= IMPORTANCE_NORMALIZATION.RECENCY_MAX_CANDLES) {
    return IMPORTANCE_NORMALIZATION.RECENCY_MIN_SCORE;
  }

  if (candlesSincePattern <= 1) return 1.0;

  return Math.max(
    IMPORTANCE_NORMALIZATION.RECENCY_MIN_SCORE,
    1.0 -
      Math.log(candlesSincePattern) /
        Math.log(IMPORTANCE_NORMALIZATION.RECENCY_MAX_CANDLES)
  );
}

export function getVolumeConfirmation(pattern: AIStudy): number {
  if ('volumeConfirmation' in pattern && typeof pattern.volumeConfirmation === 'number') {
    return pattern.volumeConfirmation;
  }
  return 0;
}

export function calculateImportanceFactors(
  pattern: AIStudy,
  candles: Candle[]
): ImportanceFactors {
  const patternType = pattern.type;
  const patternReliability =
    PATTERN_RELIABILITY_WEIGHTS[patternType] ??
    IMPORTANCE_NORMALIZATION.DEFAULT_RELIABILITY;

  const formationPeriodCandles = calculateFormationPeriod(pattern, candles);
  const formationPeriod = normalizeFormationPeriod(formationPeriodCandles);

  const volumeConfirmation = getVolumeConfirmation(pattern);

  const confidence = pattern.confidence ?? IMPORTANCE_NORMALIZATION.DEFAULT_CONFIDENCE;

  const priceMovement = normalizePriceMovement(pattern, candles);

  const recency = normalizeRecency(pattern, candles);

  return {
    patternReliability,
    formationPeriod,
    volumeConfirmation,
    confidence,
    priceMovement,
    recency,
  };
}

export function calculateImportanceScore(
  pattern: AIStudy,
  candles: Candle[]
): number {
  const factors = calculateImportanceFactors(pattern, candles);

  const importance =
    factors.patternReliability * IMPORTANCE_WEIGHTS.PATTERN_RELIABILITY +
    factors.formationPeriod * IMPORTANCE_WEIGHTS.FORMATION_PERIOD +
    factors.confidence * IMPORTANCE_WEIGHTS.CONFIDENCE +
    factors.volumeConfirmation * IMPORTANCE_WEIGHTS.VOLUME_CONFIRMATION +
    factors.priceMovement * IMPORTANCE_WEIGHTS.PRICE_MOVEMENT +
    factors.recency * IMPORTANCE_WEIGHTS.RECENCY;

  return Math.max(0, Math.min(1, importance));
}

