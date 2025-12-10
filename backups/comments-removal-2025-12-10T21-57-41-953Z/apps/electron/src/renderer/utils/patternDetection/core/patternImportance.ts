import type { AIPattern, Kline } from '@marketmind/types';
import { getKlineClose } from '@shared/utils';
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
  if (period >= IMPORTANCE_NORMALIZATION.FORMATION_PERIOD_MAX_KLINES) return 1.0;

  return Math.min(
    1.0,
    Math.log(period / IMPORTANCE_NORMALIZATION.FORMATION_PERIOD_BASE_DIVISOR) /
      Math.log(IMPORTANCE_NORMALIZATION.FORMATION_PERIOD_LOG_BASE)
  );
}

export function normalizePriceMovement(
  pattern: AIPattern,
  klines: Kline[]
): number {
  if (klines.length === 0) return 0;

  const minPrice = getPatternMinPrice(pattern);
  const maxPrice = getPatternMaxPrice(pattern);
  const priceRange = maxPrice - minPrice;

  if (priceRange <= 0) return 0;

  const avgPrice = klines.reduce((sum, c) => sum + getKlineClose(c), 0) / klines.length;
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

export function normalizeRecency(pattern: AIPattern, klines: Kline[]): number {
  if (klines.length === 0) return 0;

  const latestKline = klines[klines.length - 1];
  if (!latestKline) return 0;

  const latestTimestamp = latestKline.openTime;
  const patternEndTime = getPatternEndTimestamp(pattern);
  const timeSincePattern = latestTimestamp - patternEndTime;

  if (timeSincePattern <= 0) return 1.0;

  const firstKline = klines[0];
  const lastKline = klines[klines.length - 1];

  const avgKlineInterval =
    klines.length > 1 && firstKline && lastKline
      ? (lastKline.openTime - firstKline.openTime) / (klines.length - 1)
      : 1;

  const klinesSincePattern = timeSincePattern / avgKlineInterval;

  if (klinesSincePattern >= IMPORTANCE_NORMALIZATION.RECENCY_MAX_KLINES) {
    return IMPORTANCE_NORMALIZATION.RECENCY_MIN_SCORE;
  }

  if (klinesSincePattern <= 1) return 1.0;

  return Math.max(
    IMPORTANCE_NORMALIZATION.RECENCY_MIN_SCORE,
    1.0 -
      Math.log(klinesSincePattern) /
        Math.log(IMPORTANCE_NORMALIZATION.RECENCY_MAX_KLINES)
  );
}

export function getVolumeConfirmation(pattern: AIPattern): number {
  if ('volumeConfirmation' in pattern && typeof pattern.volumeConfirmation === 'number') {
    return pattern.volumeConfirmation;
  }
  return 0;
}

export function calculateImportanceFactors(
  pattern: AIPattern,
  klines: Kline[]
): ImportanceFactors {
  const patternType = pattern.type;
  const patternReliability =
    PATTERN_RELIABILITY_WEIGHTS[patternType] ??
    IMPORTANCE_NORMALIZATION.DEFAULT_RELIABILITY;

  const formationPeriodKlines = calculateFormationPeriod(pattern, klines);
  const formationPeriod = normalizeFormationPeriod(formationPeriodKlines);

  const volumeConfirmation = getVolumeConfirmation(pattern);

  const confidence = pattern.confidence ?? IMPORTANCE_NORMALIZATION.DEFAULT_CONFIDENCE;

  const priceMovement = normalizePriceMovement(pattern, klines);

  const recency = normalizeRecency(pattern, klines);

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
  pattern: AIPattern,
  klines: Kline[]
): number {
  const factors = calculateImportanceFactors(pattern, klines);

  const importance =
    factors.patternReliability * IMPORTANCE_WEIGHTS.PATTERN_RELIABILITY +
    factors.formationPeriod * IMPORTANCE_WEIGHTS.FORMATION_PERIOD +
    factors.confidence * IMPORTANCE_WEIGHTS.CONFIDENCE +
    factors.volumeConfirmation * IMPORTANCE_WEIGHTS.VOLUME_CONFIRMATION +
    factors.priceMovement * IMPORTANCE_WEIGHTS.PRICE_MOVEMENT +
    factors.recency * IMPORTANCE_WEIGHTS.RECENCY;

  return Math.max(0, Math.min(1, importance));
}

