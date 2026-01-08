import { describe, it, expect } from 'vitest';
import { checkFundingRate, FUNDING_FILTER } from '../utils/funding-filter';

describe('Funding Rate Filter', () => {
  describe('checkFundingRate', () => {
    describe('normal funding rates', () => {
      it('should allow LONG with normal positive funding', () => {
        const result = checkFundingRate(0.0001, 'LONG');

        expect(result.isAllowed).toBe(true);
        expect(result.fundingLevel).toBe('NORMAL');
        expect(result.signal).toBe('NEUTRAL');
      });

      it('should allow SHORT with normal negative funding', () => {
        const result = checkFundingRate(-0.0001, 'SHORT');

        expect(result.isAllowed).toBe(true);
        expect(result.fundingLevel).toBe('NORMAL');
      });

      it('should allow trades with zero funding', () => {
        const result = checkFundingRate(0, 'LONG');

        expect(result.isAllowed).toBe(true);
        expect(result.fundingLevel).toBe('NORMAL');
      });
    });

    describe('warning level funding rates', () => {
      it('should allow but warn for elevated positive funding on LONG', () => {
        const result = checkFundingRate(0.0006, 'LONG');

        expect(result.isAllowed).toBe(true);
        expect(result.fundingLevel).toBe('WARNING');
        expect(result.reason).toContain('WARNING');
      });

      it('should allow but warn for elevated negative funding on SHORT', () => {
        const result = checkFundingRate(-0.0006, 'SHORT');

        expect(result.isAllowed).toBe(true);
        expect(result.fundingLevel).toBe('WARNING');
      });
    });

    describe('extreme funding rates', () => {
      it('should block LONG with extreme positive funding', () => {
        const result = checkFundingRate(0.0015, 'LONG');

        expect(result.isAllowed).toBe(false);
        expect(result.fundingLevel).toBe('EXTREME');
        expect(result.signal).toBe('SHORT_CONTRARIAN');
        expect(result.reason).toContain('LONG blocked');
        expect(result.reason).toContain('crowded long');
      });

      it('should block SHORT with extreme negative funding', () => {
        const result = checkFundingRate(-0.0015, 'SHORT');

        expect(result.isAllowed).toBe(false);
        expect(result.fundingLevel).toBe('EXTREME');
        expect(result.signal).toBe('LONG_CONTRARIAN');
        expect(result.reason).toContain('SHORT blocked');
        expect(result.reason).toContain('crowded short');
      });

      it('should allow contrarian trades with extreme funding', () => {
        const longResult = checkFundingRate(-0.0015, 'LONG');
        expect(longResult.isAllowed).toBe(true);

        const shortResult = checkFundingRate(0.0015, 'SHORT');
        expect(shortResult.isAllowed).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should soft pass when funding rate is null', () => {
        const result = checkFundingRate(null, 'LONG');

        expect(result.isAllowed).toBe(true);
        expect(result.currentRate).toBeNull();
        expect(result.reason).toContain('soft pass');
      });

      it('should include next funding time when provided', () => {
        const nextTime = new Date();
        const result = checkFundingRate(0.0001, 'LONG', nextTime);

        expect(result.nextFundingTime).toEqual(nextTime);
      });

      it('should return all required fields', () => {
        const result = checkFundingRate(0.0001, 'LONG');

        expect(result).toHaveProperty('isAllowed');
        expect(result).toHaveProperty('currentRate');
        expect(result).toHaveProperty('fundingLevel');
        expect(result).toHaveProperty('signal');
        expect(result).toHaveProperty('nextFundingTime');
        expect(result).toHaveProperty('reason');
      });
    });
  });

  describe('FUNDING_FILTER constants', () => {
    it('should have correct default values', () => {
      expect(FUNDING_FILTER.WARNING_THRESHOLD).toBe(0.0005);
      expect(FUNDING_FILTER.BLOCK_THRESHOLD).toBe(0.001);
    });
  });
});
