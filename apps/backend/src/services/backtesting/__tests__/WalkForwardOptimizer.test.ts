import { describe, it, expect } from 'vitest';
import { WalkForwardOptimizer, type WalkForwardConfig } from '../WalkForwardOptimizer';
import type { Kline } from '@marketmind/types';

const createMockKlines = (count: number, startTime: number): Kline[] => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  return Array.from({ length: count }, (_, i) => ({
    openTime: startTime + i * DAY_MS,
    closeTime: startTime + i * DAY_MS + DAY_MS - 1,
    open: '50000',
    high: '51000',
    low: '49000',
    close: `${50000 + (Math.random() - 0.5) * 2000}`,
    volume: '1000',
    quoteVolume: '50000000',
    trades: 1000,
    takerBuyBaseVolume: '500',
    takerBuyQuoteVolume: '25000000',
  }));
};

describe('WalkForwardOptimizer', () => {
  describe('createWindows', () => {
    it('should return empty array when klines array is empty', () => {
      const windows = WalkForwardOptimizer.createWindows([]);
      expect(windows).toEqual([]);
    });

    it('should throw error when data is insufficient for walk-forward analysis', () => {
      const startTime = new Date('2024-01-01').getTime();
      const klines = createMockKlines(30, startTime);

      expect(() =>
        WalkForwardOptimizer.createWindows(klines, {
          trainingWindowMonths: 6,
          testingWindowMonths: 2,
          stepMonths: 2,
          minWindowCount: 3,
        })
      ).toThrow('Insufficient data for walk-forward analysis');
    });

    it('should throw error when minimum window count is not met', () => {
      const startTime = new Date('2024-01-01').getTime();
      const klines = createMockKlines(300, startTime);

      expect(() =>
        WalkForwardOptimizer.createWindows(klines, {
          trainingWindowMonths: 6,
          testingWindowMonths: 2,
          stepMonths: 2,
          minWindowCount: 10,
        })
      ).toThrow(/Insufficient windows/);
    });

    it('should create valid windows with sufficient data', () => {
      const startTime = new Date('2022-01-01').getTime();
      const klines = createMockKlines(1000, startTime);

      const windows = WalkForwardOptimizer.createWindows(klines, {
        trainingWindowMonths: 6,
        testingWindowMonths: 2,
        stepMonths: 2,
        minWindowCount: 3,
      });

      expect(windows.length).toBeGreaterThanOrEqual(3);

      for (const window of windows) {
        expect(window.trainingKlines.length).toBeGreaterThan(0);
        expect(window.testingKlines.length).toBeGreaterThan(0);
        expect(window.trainingEnd).toBe(window.testingStart);
        expect(window.trainingEnd).toBeGreaterThan(window.trainingStart);
        expect(window.testingEnd).toBeGreaterThan(window.testingStart);
      }
    });

    it('should have non-overlapping training and testing periods', () => {
      const startTime = new Date('2022-01-01').getTime();
      const klines = createMockKlines(1000, startTime);

      const windows = WalkForwardOptimizer.createWindows(klines, {
        trainingWindowMonths: 6,
        testingWindowMonths: 2,
        stepMonths: 2,
        minWindowCount: 3,
      });

      for (const window of windows) {
        const trainingKlineOpenTimes = window.trainingKlines.map((k) => k.openTime);
        const testingKlineOpenTimes = window.testingKlines.map((k) => k.openTime);

        const maxTrainingTime = Math.max(...trainingKlineOpenTimes);
        const minTestingTime = Math.min(...testingKlineOpenTimes);

        expect(maxTrainingTime).toBeLessThan(minTestingTime);
      }
    });

    it('should increment window index correctly', () => {
      const startTime = new Date('2022-01-01').getTime();
      const klines = createMockKlines(1000, startTime);

      const windows = WalkForwardOptimizer.createWindows(klines, {
        trainingWindowMonths: 6,
        testingWindowMonths: 2,
        stepMonths: 2,
        minWindowCount: 3,
      });

      windows.forEach((window, index) => {
        expect(window.windowIndex).toBe(index);
      });
    });

    it('should use default config when not provided', () => {
      const startTime = new Date('2022-01-01').getTime();
      const klines = createMockKlines(1000, startTime);

      const windows = WalkForwardOptimizer.createWindows(klines);

      expect(windows.length).toBeGreaterThanOrEqual(3);
    });

    it('should step windows correctly', () => {
      const startTime = new Date('2022-01-01').getTime();
      const klines = createMockKlines(1000, startTime);

      const stepMonths = 3;
      const windows = WalkForwardOptimizer.createWindows(klines, {
        trainingWindowMonths: 6,
        testingWindowMonths: 2,
        stepMonths,
        minWindowCount: 2,
      });

      if (windows.length >= 2) {
        const firstWindow = windows[0]!;
        const secondWindow = windows[1]!;
        const stepMs = stepMonths * 30 * 24 * 60 * 60 * 1000;

        const timeDiff = secondWindow.trainingStart - firstWindow.trainingStart;
        expect(timeDiff).toBeCloseTo(stepMs, -5);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle exact minimum data for one window', () => {
      const startTime = new Date('2024-01-01').getTime();
      const monthMs = 30 * 24 * 60 * 60 * 1000;
      const daysNeeded = Math.ceil((6 + 2) * 30) + 5;
      const klines = createMockKlines(daysNeeded, startTime);

      const config: WalkForwardConfig = {
        trainingWindowMonths: 6,
        testingWindowMonths: 2,
        stepMonths: 2,
        minWindowCount: 1,
      };

      const windows = WalkForwardOptimizer.createWindows(klines, config);
      expect(windows.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle different step sizes', () => {
      const startTime = new Date('2021-01-01').getTime();
      const klines = createMockKlines(1500, startTime);

      const smallStep = WalkForwardOptimizer.createWindows(klines, {
        trainingWindowMonths: 6,
        testingWindowMonths: 2,
        stepMonths: 1,
        minWindowCount: 3,
      });

      const largeStep = WalkForwardOptimizer.createWindows(klines, {
        trainingWindowMonths: 6,
        testingWindowMonths: 2,
        stepMonths: 4,
        minWindowCount: 3,
      });

      expect(smallStep.length).toBeGreaterThan(largeStep.length);
    });

    it('should initialize optimization and test results as null', () => {
      const startTime = new Date('2022-01-01').getTime();
      const klines = createMockKlines(1000, startTime);

      const windows = WalkForwardOptimizer.createWindows(klines);

      for (const window of windows) {
        expect(window.optimizationResult).toBeNull();
        expect(window.testResult).toBeNull();
      }
    });
  });

  describe('degradation threshold', () => {
    it('should use 30% as degradation threshold', () => {
      expect(WalkForwardOptimizer['DEGRADATION_THRESHOLD']).toBe(0.3);
    });
  });
});
