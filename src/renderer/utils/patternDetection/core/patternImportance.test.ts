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

const createMockKlines = (count: number, startTime = 1000000): Kline[] => {
  const interval = 60000;
  return Array.from({ length: count }, (_, i) => ({
    openTime: startTime + i * interval,
    closeTime: startTime + (i + 1) * interval,
    open: (100 + i).toString(),
    high: (105 + i).toString(),
    low: (95 + i).toString(),
    close: (100 + i).toString(),
    volume: '1000',
    quoteVolume: '100000',
    trades: 100,
    takerBuyBaseVolume: '500',
    takerBuyQuoteVolume: '50000',
  }));
};

const createMockPattern = (
  type: AIPattern['type'],
  startIdx: number,
  endIdx: number,
  klines: Kline[]
): AIPattern => {
  const start = klines[startIdx];
  const end = klines[endIdx];

  if (!start || !end) {
    throw new Error('Invalid kline indices');
  }

  const startClose = typeof start.close === 'string' ? parseFloat(start.close) : start.close;
  const endClose = typeof end.close === 'string' ? parseFloat(end.close) : end.close;

  return {
    id: 1,
    type,
    points: [
      { openTime: start.openTime, price: startClose },
      { openTime: end.openTime, price: endClose },
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
  it('should return 0 for empty klines array', () => {
    const pattern = createMockPattern('support', 0, 10, createMockKlines(100));
    expect(normalizePriceMovement(pattern, [])).toBe(0);
  });

  it('should return 0 for pattern with no price range', () => {
    const klines = createMockKlines(50);
    const pattern: AIPattern = {
      id: 1,
      type: 'support',
      points: [
        { openTime: klines[0]?.openTime ?? 0, price: 100 },
        { openTime: klines[10]?.openTime ?? 0, price: 100 },
      ],
      confidence: 0.8,
      visible: true,
    };

    expect(normalizePriceMovement(pattern, klines)).toBe(0);
  });

  it('should return high score for large price movements', () => {
    const klines = createMockKlines(50);
    const avgPrice = 125;
    const largeRange = avgPrice * 0.25;

    const pattern: AIPattern = {
      id: 1,
      type: 'head-and-shoulders',
      leftShoulder: { openTime: klines[0]?.openTime ?? 0, price: avgPrice },
      head: {
        openTime: klines[25]?.openTime ?? 0,
        price: avgPrice + largeRange,
      },
      rightShoulder: {
        openTime: klines[40]?.openTime ?? 0,
        price: avgPrice,
      },
      neckline: [
        { openTime: klines[0]?.openTime ?? 0, price: avgPrice - 10 },
        { openTime: klines[40]?.openTime ?? 0, price: avgPrice - 10 },
      ],
      confidence: 0.8,
      visible: true,
    };

    const score = normalizePriceMovement(pattern, klines);
    expect(score).toBeGreaterThan(0.8);
  });

  it('should return low score for small price movements', () => {
    const klines = createMockKlines(50);
    const avgPrice = 125;
    const smallRange = avgPrice * 0.01;

    const pattern: AIPattern = {
      id: 1,
      type: 'support',
      points: [
        { openTime: klines[0]?.openTime ?? 0, price: avgPrice },
        {
          openTime: klines[10]?.openTime ?? 0,
          price: avgPrice + smallRange,
        },
      ],
      confidence: 0.8,
      visible: true,
    };

    const score = normalizePriceMovement(pattern, klines);
    expect(score).toBeLessThan(0.3);
  });
});

describe('normalizeRecency', () => {
  it('should return 0 for empty klines array', () => {
    const pattern = createMockPattern('support', 0, 10, createMockKlines(100));
    expect(normalizeRecency(pattern, [])).toBe(0);
  });

  it('should return 1.0 for patterns ending at or after latest kline', () => {
    const klines = createMockKlines(50);
    const pattern = createMockPattern('support', 40, 49, klines);

    expect(normalizeRecency(pattern, klines)).toBe(1.0);
  });

  it('should return decreasing scores for older patterns', () => {
    const klines = createMockKlines(100);
    const recent = createMockPattern('support', 80, 90, klines);
    const medium = createMockPattern('support', 50, 60, klines);
    const old = createMockPattern('support', 10, 20, klines);

    const recentScore = normalizeRecency(recent, klines);
    const mediumScore = normalizeRecency(medium, klines);
    const oldScore = normalizeRecency(old, klines);

    expect(recentScore).toBeGreaterThan(mediumScore);
    expect(mediumScore).toBeGreaterThan(oldScore);
  });

  it('should return minimum score for very old patterns', () => {
    const klines = createMockKlines(200);
    const veryOld = createMockPattern('support', 0, 10, klines);

    const score = normalizeRecency(veryOld, klines);
    expect(score).toBeLessThan(0.2);
  });
});

describe('getVolumeConfirmation', () => {
  it('should return 0 for patterns without volumeConfirmation', () => {
    const pattern: AIPattern = {
      id: 1,
      type: 'support',
      points: [
        { openTime: 0, price: 100 },
        { openTime: 0, price: 100 },
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
      leftShoulder: { openTime: 0, price: 100 },
      head: { openTime: 0, price: 110 },
      rightShoulder: { openTime: 0, price: 100 },
      neckline: [
        { openTime: 0, price: 95 },
        { openTime: 0, price: 95 },
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
    const klines = createMockKlines(100);
    const pattern = {
      id: 1,
      type: 'head-and-shoulders',
      leftShoulder: { openTime: klines[20]?.openTime ?? 0, price: 110 },
      head: { openTime: klines[50]?.openTime ?? 0, price: 160 },
      rightShoulder: { openTime: klines[80]?.openTime ?? 0, price: 120 },
      neckline: [
        { openTime: klines[20]?.openTime ?? 0, price: 100 },
        { openTime: klines[80]?.openTime ?? 0, price: 110 },
      ],
      confidence: 0.85,
      visible: true,
      volumeConfirmation: 0.9,
    } as AIPattern;

    const factors = calculateImportanceFactors(pattern, klines);

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
    const klines = createMockKlines(50);
    const pattern: AIPattern = {
      id: 1,
      type: 'support',
      points: [
        { openTime: klines[0]?.openTime ?? 0, price: 100 },
        { openTime: klines[10]?.openTime ?? 0, price: 100 },
      ],
      confidence: 0.7,
      visible: true,
    };

    const factors = calculateImportanceFactors(pattern, klines);
    expect(factors.patternReliability).toBe(0.8);
  });
});

describe('calculateImportanceScore', () => {
  it('should return score between 0 and 1', () => {
    const klines = createMockKlines(100);
    const pattern = createMockPattern('support', 10, 50, klines);

    const score = calculateImportanceScore(pattern, klines);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('should give higher scores to high-reliability patterns', () => {
    const klines = createMockKlines(100);

    const highReliability = {
      id: 1,
      type: 'head-and-shoulders',
      leftShoulder: { openTime: klines[20]?.openTime ?? 0, price: 110 },
      head: { openTime: klines[50]?.openTime ?? 0, price: 140 },
      rightShoulder: { openTime: klines[80]?.openTime ?? 0, price: 120 },
      neckline: [
        { openTime: klines[20]?.openTime ?? 0, price: 100 },
        { openTime: klines[80]?.openTime ?? 0, price: 110 },
      ],
      confidence: 0.9,
      visible: true,
      volumeConfirmation: 0.9,
    } as AIPattern;

    const lowReliability = {
      id: 2,
      type: 'gap-common',
      gapStart: { openTime: klines[20]?.openTime ?? 0, price: 110 },
      gapEnd: { openTime: klines[21]?.openTime ?? 0, price: 115 },
      confidence: 0.9,
      visible: true,
      volumeConfirmation: 0.9,
    } as AIPattern;

    const highScore = calculateImportanceScore(highReliability, klines);
    const lowScore = calculateImportanceScore(lowReliability, klines);

    expect(highScore).toBeGreaterThan(lowScore);
  });

  it('should give higher scores to longer formation periods', () => {
    const klines = createMockKlines(200);

    const longFormation = createMockPattern('support', 10, 150, klines);
    const shortFormation = createMockPattern('support', 10, 30, klines);

    const longScore = calculateImportanceScore(longFormation, klines);
    const shortScore = calculateImportanceScore(shortFormation, klines);

    expect(longScore).toBeGreaterThan(shortScore);
  });

  it('should give higher scores to recent patterns', () => {
    const klines = createMockKlines(150);

    const recent = createMockPattern('support', 120, 140, klines);
    const old = createMockPattern('support', 10, 30, klines);

    const recentScore = calculateImportanceScore(recent, klines);
    const oldScore = calculateImportanceScore(old, klines);

    expect(recentScore).toBeGreaterThan(oldScore);
  });

  it('should weight all factors correctly', () => {
    const klines = createMockKlines(100);

    const perfectPattern = {
      id: 1,
      type: 'head-and-shoulders',
      leftShoulder: { openTime: klines[50]?.openTime ?? 0, price: 110 },
      head: { openTime: klines[75]?.openTime ?? 0, price: 200 },
      rightShoulder: { openTime: klines[95]?.openTime ?? 0, price: 120 },
      neckline: [
        { openTime: klines[50]?.openTime ?? 0, price: 100 },
        { openTime: klines[95]?.openTime ?? 0, price: 110 },
      ],
      confidence: 1.0,
      visible: true,
      volumeConfirmation: 1.0,
    } as AIPattern;

    const score = calculateImportanceScore(perfectPattern, klines);
    expect(score).toBeGreaterThan(0.7);
  });
});
