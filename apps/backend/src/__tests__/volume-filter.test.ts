import { describe, it, expect } from 'vitest';
import { checkVolumeCondition, getSetupVolumeType, VOLUME_FILTER } from '../utils/filters';
import type { Kline } from '@marketmind/types';

const createKline = (close: number, volume: number, index: number): Kline => ({
  openTime: Date.now() + index * 60000,
  open: String(close),
  high: String(close * 1.01),
  low: String(close * 0.99),
  close: String(close),
  volume: String(volume),
  closeTime: Date.now() + (index + 1) * 60000 - 1,
  quoteVolume: String(volume * close),
  trades: 100,
  takerBuyBaseVolume: String(volume * 0.5),
  takerBuyQuoteVolume: String(volume * close * 0.5),
});

const createNormalVolumeKlines = (count: number): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < count; i += 1) {
    klines.push(createKline(100 + i * 0.5, 1000, i));
  }
  return klines;
};

const createHighVolumeLastKline = (count: number, volumeMultiplier: number): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < count - 1; i += 1) {
    klines.push(createKline(100 + i * 0.5, 1000, i));
  }
  klines.push(createKline(100 + (count - 1) * 0.5, 1000 * volumeMultiplier, count - 1));
  return klines;
};

describe('Volume Filter', () => {
  describe('getSetupVolumeType', () => {
    it('should return BREAKOUT for breakout setups', () => {
      expect(getSetupVolumeType('breakout-long')).toBe('BREAKOUT');
      expect(getSetupVolumeType('breakout-short')).toBe('BREAKOUT');
    });

    it('should return PULLBACK for pullback setups', () => {
      expect(getSetupVolumeType('ema9-pullback')).toBe('PULLBACK');
      expect(getSetupVolumeType('larry-williams-9.1')).toBe('PULLBACK');
    });

    it('should return REVERSAL for reversal setups', () => {
      expect(getSetupVolumeType('oversold-bounce')).toBe('REVERSAL');
      expect(getSetupVolumeType('support-bounce')).toBe('REVERSAL');
    });

    it('should return ANY for unknown setups', () => {
      expect(getSetupVolumeType('unknown-setup')).toBe('ANY');
    });
  });

  describe('checkVolumeCondition', () => {
    describe('breakout setups', () => {
      it('should allow breakout with high volume spike', () => {
        const klines = createHighVolumeLastKline(30, 2.0);
        const result = checkVolumeCondition(klines, 'LONG', 'breakout-long');

        expect(result.isVolumeSpike).toBe(true);
        expect(result.volumeRatio).toBeGreaterThan(1.5);
        expect(result.isAllowed).toBe(true);
      });

      it('should block breakout without volume spike', () => {
        const klines = createNormalVolumeKlines(30);
        const result = checkVolumeCondition(klines, 'LONG', 'breakout-long');

        expect(result.isVolumeSpike).toBe(false);
        expect(result.isAllowed).toBe(false);
        expect(result.reason).toContain('Breakout blocked');
      });
    });

    describe('pullback setups', () => {
      it('should allow pullback with normal volume', () => {
        const klines = createNormalVolumeKlines(30);
        const result = checkVolumeCondition(klines, 'LONG', 'ema9-pullback');

        expect(result.volumeRatio).toBeGreaterThanOrEqual(0.9);
        expect(result.isAllowed).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should soft pass when insufficient klines', () => {
        const klines = createNormalVolumeKlines(10);
        const result = checkVolumeCondition(klines, 'LONG', 'breakout-long');

        expect(result.isAllowed).toBe(true);
        expect(result.reason).toContain('soft pass');
      });

      it('should return all required fields', () => {
        const klines = createNormalVolumeKlines(30);
        const result = checkVolumeCondition(klines, 'LONG', 'ema9-pullback');

        expect(result).toHaveProperty('isAllowed');
        expect(result).toHaveProperty('currentVolume');
        expect(result).toHaveProperty('averageVolume');
        expect(result).toHaveProperty('volumeRatio');
        expect(result).toHaveProperty('isVolumeSpike');
        expect(result).toHaveProperty('obvTrend');
        expect(result).toHaveProperty('reason');
      });
    });
  });

  describe('VOLUME_FILTER constants', () => {
    it('should have correct default values', () => {
      expect(VOLUME_FILTER.VOLUME_AVG_PERIOD).toBe(20);
      expect(VOLUME_FILTER.BREAKOUT_MULTIPLIER).toBe(1.5);
      expect(VOLUME_FILTER.PULLBACK_MULTIPLIER).toBe(1.0);
    });
  });
});
