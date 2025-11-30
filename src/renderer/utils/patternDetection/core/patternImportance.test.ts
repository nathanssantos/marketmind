import { describe, expect, it } from 'vitest';
import type { AIPattern, Kline } from '../../../../shared/types';
import {
    calculateImportanceFactors,
    calculateImportanceScore,
    getVolumeConfirmation,
    normalizeFormationPeriod,
    normalizePriceMovement,
    normalizeRecency,
} from './patternImportance';

const createMockCandles = (count: number, startTime = 1000000): Kline[] => {
  const interval = 60000;
  return Array.from({ length: count }, (_, i) => ({
    timestamp: startTime + i * interval,
    open: 100 + i,
    high: 105 + i,
    low: 95 + i,
    close: 100 + i,
    volume: 1000,
  }));
};

const createMockPattern = (
  type: AIPattern['type'],
  startIdx: number,
  endIdx: number,
  candles: Kline[]
): AIPattern => {
  const start = candles[startIdx];
  const end = candles[endIdx];

  if (!start || !end) {
    throw new Error('Invalid candle indices');
  }

  return {
    id: 1,
    type,
    points: [
      { timestamp: start.timestamp, price: start.close },
      { timestamp: end.timestamp, price: end.close },
    ],
    confidence: 0.8,
    visible: true,
  } as AIPattern;
};

describe('normalizeFormationPeriod', () => {
  it('should return 0 for period <= 0', () => {
    expect(normalizeFormationPeriod(0)).toBe(0);
    expect(normalizeFormationPeriod(-10)).toBe(0);
  });

  it('should return 1.0 for period >= 200', () => {
    expect(normalizeFormationPeriod(200)).toBe(1.0);
    expect(normalizeFormationPeriod(300)).toBe(1.0);
  });

  it('should return exponential curve values for intermediate periods', () => {
    const result10 = normalizeFormationPeriod(10);
    const result50 = normalizeFormationPeriod(50);
    const result100 = normalizeFormationPeriod(100);

    expect(result10).toBeGreaterThan(0);
    expect(result10).toBeLessThan(0.5);

    expect(result50).toBeGreaterThan(result10);
    expect(result50).toBeGreaterThan(0.5);
    expect(result50).toBeLessThan(1.0);

    expect(result100).toBeGreaterThan(result50);
    expect(result100).toBeGreaterThan(0.8);
    expect(result100).toBeLessThan(1.0);
  });

  it('should favor longer formation periods', () => {
    expect(normalizeFormationPeriod(20)).toBeLessThan(
      normalizeFormationPeriod(50)
    );
    expect(normalizeFormationPeriod(50)).toBeLessThan(
      normalizeFormationPeriod(100)
    );
  });
});

describe('normalizePriceMovement', () => {
  it('should return 0 for empty candles array', () => {
    const pattern = createMockPattern('support', 0, 10, createMockCandles(100));
    expect(normalizePriceMovement(pattern, [])).toBe(0);
  });

  it('should return 0 for pattern with no price range', () => {
    const candles = createMockCandles(50);
    const pattern: AIPattern = {
      id: 1,
      type: 'support',
      points: [
        { timestamp: candles[0]?.timestamp ?? 0, price: 100 },
        { timestamp: candles[10]?.timestamp ?? 0, price: 100 },
      ],
      confidence: 0.8,
      visible: true,
    };

    expect(normalizePriceMovement(pattern, candles)).toBe(0);
  });

  it('should return high score for large price movements', () => {
    const candles = createMockCandles(50);
    const avgPrice = 125;
    const largeRange = avgPrice * 0.25;

    const pattern: AIPattern = {
      id: 1,
      type: 'head-and-shoulders',
      leftShoulder: { timestamp: candles[0]?.timestamp ?? 0, price: avgPrice },
      head: {
        timestamp: candles[25]?.timestamp ?? 0,
        price: avgPrice + largeRange,
      },
      rightShoulder: {
        timestamp: candles[40]?.timestamp ?? 0,
        price: avgPrice,
      },
      neckline: [
        { timestamp: candles[0]?.timestamp ?? 0, price: avgPrice - 10 },
        { timestamp: candles[40]?.timestamp ?? 0, price: avgPrice - 10 },
      ],
      confidence: 0.8,
      visible: true,
    };

    const score = normalizePriceMovement(pattern, candles);
    expect(score).toBeGreaterThan(0.8);
  });

  it('should return low score for small price movements', () => {
    const candles = createMockCandles(50);
    const avgPrice = 125;
    const smallRange = avgPrice * 0.01;

    const pattern: AIPattern = {
      id: 1,
      type: 'support',
      points: [
        { timestamp: candles[0]?.timestamp ?? 0, price: avgPrice },
        {
          timestamp: candles[10]?.timestamp ?? 0,
          price: avgPrice + smallRange,
        },
      ],
      confidence: 0.8,
      visible: true,
    };

    const score = normalizePriceMovement(pattern, candles);
    expect(score).toBeLessThan(0.3);
  });
});

describe('normalizeRecency', () => {
  it('should return 0 for empty candles array', () => {
    const pattern = createMockPattern('support', 0, 10, createMockCandles(100));
    expect(normalizeRecency(pattern, [])).toBe(0);
  });

  it('should return 1.0 for patterns ending at or after latest candle', () => {
    const candles = createMockCandles(50);
    const pattern = createMockPattern('support', 40, 49, candles);

    expect(normalizeRecency(pattern, candles)).toBe(1.0);
  });

  it('should return decreasing scores for older patterns', () => {
    const candles = createMockCandles(100);
    const recent = createMockPattern('support', 80, 90, candles);
    const medium = createMockPattern('support', 50, 60, candles);
    const old = createMockPattern('support', 10, 20, candles);

    const recentScore = normalizeRecency(recent, candles);
    const mediumScore = normalizeRecency(medium, candles);
    const oldScore = normalizeRecency(old, candles);

    expect(recentScore).toBeGreaterThan(mediumScore);
    expect(mediumScore).toBeGreaterThan(oldScore);
  });

  it('should return minimum score for very old patterns', () => {
    const candles = createMockCandles(200);
    const veryOld = createMockPattern('support', 0, 10, candles);

    const score = normalizeRecency(veryOld, candles);
    expect(score).toBeLessThan(0.2);
  });
});

describe('getVolumeConfirmation', () => {
  it('should return 0 for patterns without volumeConfirmation', () => {
    const pattern: AIPattern = {
      id: 1,
      type: 'support',
      points: [
        { timestamp: 1000, price: 100 },
        { timestamp: 2000, price: 100 },
      ],
      confidence: 0.8,
      visible: true,
    };

    expect(getVolumeConfirmation(pattern)).toBe(0);
  });

  it('should return volumeConfirmation value when present', () => {
    const pattern = {
      id: 1,
      type: 'head-and-shoulders',
      leftShoulder: { timestamp: 1000, price: 100 },
      head: { timestamp: 2000, price: 110 },
      rightShoulder: { timestamp: 3000, price: 100 },
      neckline: [
        { timestamp: 1000, price: 95 },
        { timestamp: 3000, price: 95 },
      ],
      confidence: 0.8,
      visible: true,
      volumeConfirmation: 0.75,
    } as AIPattern;

    expect(getVolumeConfirmation(pattern)).toBe(0.75);
  });
});

describe('calculateImportanceFactors', () => {
  it('should calculate all importance factors correctly', () => {
    const candles = createMockCandles(100);
    const pattern = {
      id: 1,
      type: 'head-and-shoulders',
      leftShoulder: { timestamp: candles[20]?.timestamp ?? 0, price: 110 },
      head: { timestamp: candles[50]?.timestamp ?? 0, price: 160 },
      rightShoulder: { timestamp: candles[80]?.timestamp ?? 0, price: 120 },
      neckline: [
        { timestamp: candles[20]?.timestamp ?? 0, price: 100 },
        { timestamp: candles[80]?.timestamp ?? 0, price: 110 },
      ],
      confidence: 0.85,
      visible: true,
      volumeConfirmation: 0.9,
    } as AIPattern;

    const factors = calculateImportanceFactors(pattern, candles);

    expect(factors.patternReliability).toBe(0.89);
    expect(factors.confidence).toBe(0.85);
    expect(factors.volumeConfirmation).toBe(0.9);
    expect(factors.formationPeriod).toBeGreaterThan(0);
    expect(factors.priceMovement).toBeGreaterThan(0);
    expect(factors.recency).toBeGreaterThan(0);

    expect(factors.formationPeriod).toBeLessThanOrEqual(1);
    expect(factors.priceMovement).toBeLessThanOrEqual(1);
    expect(factors.recency).toBeLessThanOrEqual(1);
  });

  it('should use default reliability for unknown pattern types', () => {
    const candles = createMockCandles(50);
    const pattern: AIPattern = {
      id: 1,
      type: 'support',
      points: [
        { timestamp: candles[0]?.timestamp ?? 0, price: 100 },
        { timestamp: candles[10]?.timestamp ?? 0, price: 100 },
      ],
      confidence: 0.7,
      visible: true,
    };

    const factors = calculateImportanceFactors(pattern, candles);
    expect(factors.patternReliability).toBe(0.8);
  });
});

describe('calculateImportanceScore', () => {
  it('should return score between 0 and 1', () => {
    const candles = createMockCandles(100);
    const pattern = createMockPattern('support', 10, 50, candles);

    const score = calculateImportanceScore(pattern, candles);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('should give higher scores to high-reliability patterns', () => {
    const candles = createMockCandles(100);

    const highReliability = {
      id: 1,
      type: 'head-and-shoulders',
      leftShoulder: { timestamp: candles[20]?.timestamp ?? 0, price: 110 },
      head: { timestamp: candles[50]?.timestamp ?? 0, price: 140 },
      rightShoulder: { timestamp: candles[80]?.timestamp ?? 0, price: 120 },
      neckline: [
        { timestamp: candles[20]?.timestamp ?? 0, price: 100 },
        { timestamp: candles[80]?.timestamp ?? 0, price: 110 },
      ],
      confidence: 0.9,
      visible: true,
      volumeConfirmation: 0.9,
    } as AIPattern;

    const lowReliability = {
      id: 2,
      type: 'gap-common',
      gapStart: { timestamp: candles[20]?.timestamp ?? 0, price: 110 },
      gapEnd: { timestamp: candles[21]?.timestamp ?? 0, price: 115 },
      confidence: 0.9,
      visible: true,
      volumeConfirmation: 0.9,
    } as AIPattern;

    const highScore = calculateImportanceScore(highReliability, candles);
    const lowScore = calculateImportanceScore(lowReliability, candles);

    expect(highScore).toBeGreaterThan(lowScore);
  });

  it('should give higher scores to longer formation periods', () => {
    const candles = createMockCandles(200);

    const longFormation = createMockPattern('support', 10, 150, candles);
    const shortFormation = createMockPattern('support', 10, 30, candles);

    const longScore = calculateImportanceScore(longFormation, candles);
    const shortScore = calculateImportanceScore(shortFormation, candles);

    expect(longScore).toBeGreaterThan(shortScore);
  });

  it('should give higher scores to recent patterns', () => {
    const candles = createMockCandles(150);

    const recent = createMockPattern('support', 120, 140, candles);
    const old = createMockPattern('support', 10, 30, candles);

    const recentScore = calculateImportanceScore(recent, candles);
    const oldScore = calculateImportanceScore(old, candles);

    expect(recentScore).toBeGreaterThan(oldScore);
  });

  it('should weight all factors correctly', () => {
    const candles = createMockCandles(100);

    const perfectPattern = {
      id: 1,
      type: 'head-and-shoulders',
      leftShoulder: { timestamp: candles[50]?.timestamp ?? 0, price: 110 },
      head: { timestamp: candles[75]?.timestamp ?? 0, price: 200 },
      rightShoulder: { timestamp: candles[95]?.timestamp ?? 0, price: 120 },
      neckline: [
        { timestamp: candles[50]?.timestamp ?? 0, price: 100 },
        { timestamp: candles[95]?.timestamp ?? 0, price: 110 },
      ],
      confidence: 1.0,
      visible: true,
      volumeConfirmation: 1.0,
    } as AIPattern;

    const score = calculateImportanceScore(perfectPattern, candles);
    expect(score).toBeGreaterThan(0.7);
  });
});
