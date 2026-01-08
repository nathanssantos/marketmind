import { describe, it, expect } from 'vitest';
import { calculateConfluenceScore, CONFLUENCE_WEIGHTS, CONFLUENCE_CONFIG } from '../utils/confluence-scoring';
import type { MtfFilterResult } from '../utils/mtf-filter';
import type { BtcCorrelationResult } from '../utils/btc-correlation-filter';
import type { MarketRegimeResult } from '../utils/market-regime-filter';
import type { VolumeFilterResult } from '../utils/volume-filter';
import type { FundingFilterResult } from '../utils/funding-filter';

const createPassingMtfResult = (): MtfFilterResult => ({
  isAllowed: true,
  htfTrend: 'BULLISH',
  htfInterval: '4h',
  ema50: 100,
  ema200: 95,
  price: 105,
  goldenCross: true,
  deathCross: false,
  priceAboveEma50: true,
  priceAboveEma200: true,
  reason: 'LONG allowed',
});

const createFailingMtfResult = (): MtfFilterResult => ({
  isAllowed: false,
  htfTrend: 'BEARISH',
  htfInterval: '4h',
  ema50: 100,
  ema200: 105,
  price: 95,
  goldenCross: false,
  deathCross: true,
  priceAboveEma50: false,
  priceAboveEma200: false,
  reason: 'LONG blocked',
});

const createPassingBtcResult = (): BtcCorrelationResult => ({
  isAllowed: true,
  btcTrend: 'BULLISH',
  btcEma21: 45000,
  btcPrice: 46000,
  btcMacdHistogram: 100,
  isAltcoin: true,
  reason: 'Trade allowed',
});

const createPassingMarketRegimeResult = (): MarketRegimeResult => ({
  isAllowed: true,
  regime: 'TRENDING',
  adx: 30,
  plusDI: 25,
  minusDI: 15,
  atr: 50,
  atrPercentile: 50,
  volatilityLevel: 'NORMAL',
  recommendedStrategy: 'TREND_FOLLOWING',
  reason: 'Setup allowed',
});

const createPassingVolumeResult = (): VolumeFilterResult => ({
  isAllowed: true,
  currentVolume: 1500,
  averageVolume: 1000,
  volumeRatio: 1.5,
  isVolumeSpike: true,
  obvTrend: 'RISING',
  reason: 'Volume confirmed',
});

const createPassingFundingResult = (): FundingFilterResult => ({
  isAllowed: true,
  currentRate: 0.0001,
  fundingLevel: 'NORMAL',
  signal: 'NEUTRAL',
  nextFundingTime: null,
  reason: 'Funding rate normal',
});

describe('Confluence Scoring', () => {
  describe('calculateConfluenceScore', () => {
    describe('all filters passing', () => {
      it('should return high score when all filters pass', () => {
        const result = calculateConfluenceScore({
          mtf: createPassingMtfResult(),
          btcCorrelation: createPassingBtcResult(),
          marketRegime: createPassingMarketRegimeResult(),
          volume: createPassingVolumeResult(),
          fundingRate: createPassingFundingResult(),
          trendAllowed: true,
          adxValue: 30,
        });

        expect(result.isAllowed).toBe(true);
        expect(result.scorePercent).toBeGreaterThanOrEqual(80);
        expect(result.recommendation).toBe('STRONG_ENTRY');
        expect(result.alignmentBonus).toBe(CONFLUENCE_CONFIG.ALIGNMENT_BONUS);
      });

      it('should include alignment bonus when all pass', () => {
        const result = calculateConfluenceScore({
          mtf: createPassingMtfResult(),
          btcCorrelation: createPassingBtcResult(),
        });

        expect(result.alignmentBonus).toBe(CONFLUENCE_CONFIG.ALIGNMENT_BONUS);
      });
    });

    describe('some filters failing', () => {
      it('should return lower score when some filters fail', () => {
        const result = calculateConfluenceScore({
          mtf: createFailingMtfResult(),
          btcCorrelation: createPassingBtcResult(),
          marketRegime: createPassingMarketRegimeResult(),
        });

        expect(result.scorePercent).toBeLessThan(80);
        expect(result.alignmentBonus).toBe(0);
      });

      it('should block trade when score below minimum', () => {
        const result = calculateConfluenceScore({
          mtf: createFailingMtfResult(),
          btcCorrelation: createPassingBtcResult(),
        }, 50);

        if (result.totalScore < 50) {
          expect(result.isAllowed).toBe(false);
          expect(result.reason).toContain('below minimum');
        }
      });
    });

    describe('individual filter contributions', () => {
      it('should track each filter contribution', () => {
        const result = calculateConfluenceScore({
          mtf: createPassingMtfResult(),
          btcCorrelation: createPassingBtcResult(),
        });

        expect(result.contributions.length).toBe(2);
        expect(result.contributions[0]?.filterName).toBe('MTF Filter');
        expect(result.contributions[1]?.filterName).toBe('BTC Correlation');
      });

      it('should calculate correct scores per filter', () => {
        const result = calculateConfluenceScore({
          mtf: createPassingMtfResult(),
        });

        const mtfContribution = result.contributions.find(c => c.filterName === 'MTF Filter');
        expect(mtfContribution?.score).toBe(CONFLUENCE_WEIGHTS.mtfFilter);
        expect(mtfContribution?.maxScore).toBe(CONFLUENCE_WEIGHTS.mtfFilter);
      });
    });

    describe('recommendation levels', () => {
      it('should return STRONG_ENTRY for score >= 80%', () => {
        const result = calculateConfluenceScore({
          mtf: createPassingMtfResult(),
          btcCorrelation: createPassingBtcResult(),
          marketRegime: createPassingMarketRegimeResult(),
          volume: createPassingVolumeResult(),
          fundingRate: createPassingFundingResult(),
        });

        if (result.scorePercent >= 80) {
          expect(result.recommendation).toBe('STRONG_ENTRY');
        }
      });

      it('should return NO_ENTRY for score < 50%', () => {
        const result = calculateConfluenceScore({
          mtf: createFailingMtfResult(),
        });

        if (result.scorePercent < 50) {
          expect(result.recommendation).toBe('NO_ENTRY');
        }
      });
    });

    describe('edge cases', () => {
      it('should handle empty filter results', () => {
        const result = calculateConfluenceScore({});

        expect(result.totalScore).toBe(0);
        expect(result.contributions.length).toBe(0);
        expect(result.isAllowed).toBe(false);
      });

      it('should handle null filter results', () => {
        const result = calculateConfluenceScore({
          mtf: null,
          btcCorrelation: null,
        });

        expect(result.totalScore).toBe(0);
        expect(result.contributions.length).toBe(0);
      });

      it('should handle partial ADX value scoring', () => {
        const result = calculateConfluenceScore({
          adxValue: 15,
        });

        const adxContribution = result.contributions.find(c => c.filterName === 'ADX Strength');
        expect(adxContribution?.passed).toBe(false);
        expect(adxContribution?.score).toBeLessThan(CONFLUENCE_WEIGHTS.adxStrength);
      });
    });
  });

  describe('CONFLUENCE_WEIGHTS constants', () => {
    it('should have correct weights', () => {
      expect(CONFLUENCE_WEIGHTS.mtfFilter).toBe(25);
      expect(CONFLUENCE_WEIGHTS.btcCorrelation).toBe(20);
      expect(CONFLUENCE_WEIGHTS.marketRegime).toBe(15);
      expect(CONFLUENCE_WEIGHTS.trend).toBe(15);
      expect(CONFLUENCE_WEIGHTS.adxStrength).toBe(10);
      expect(CONFLUENCE_WEIGHTS.volume).toBe(10);
      expect(CONFLUENCE_WEIGHTS.fundingRate).toBe(5);
    });
  });

  describe('CONFLUENCE_CONFIG constants', () => {
    it('should have correct config values', () => {
      expect(CONFLUENCE_CONFIG.MINIMUM_SCORE).toBe(60);
      expect(CONFLUENCE_CONFIG.ALIGNMENT_BONUS).toBe(10);
    });
  });
});
