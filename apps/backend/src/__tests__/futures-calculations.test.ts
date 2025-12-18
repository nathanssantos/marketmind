import { describe, expect, it } from 'vitest';
import {
  calculateLiquidationPrice,
  calculateLeveragedPnl,
  calculateFundingPayment,
  wouldLiquidate,
  FUTURES_DEFAULTS,
} from '@marketmind/types';

describe('Futures Calculations', () => {
  describe('calculateLiquidationPrice', () => {
    it('should calculate liquidation price for LONG position with 10x leverage', () => {
      const entryPrice = 50000;
      const leverage = 10;
      const liqPrice = calculateLiquidationPrice(entryPrice, leverage, 'LONG');

      expect(liqPrice).toBeLessThan(entryPrice);
      expect(liqPrice).toBeCloseTo(45950, 0);
    });

    it('should calculate liquidation price for SHORT position with 10x leverage', () => {
      const entryPrice = 50000;
      const leverage = 10;
      const liqPrice = calculateLiquidationPrice(entryPrice, leverage, 'SHORT');

      expect(liqPrice).toBeGreaterThan(entryPrice);
      expect(liqPrice).toBeCloseTo(54050, 0);
    });

    it('should have higher liquidation risk with higher leverage', () => {
      const entryPrice = 50000;
      const liq5x = calculateLiquidationPrice(entryPrice, 5, 'LONG');
      const liq10x = calculateLiquidationPrice(entryPrice, 10, 'LONG');
      const liq20x = calculateLiquidationPrice(entryPrice, 20, 'LONG');

      expect(liq10x).toBeGreaterThan(liq5x);
      expect(liq20x).toBeGreaterThan(liq10x);

      const distance5x = entryPrice - liq5x;
      const distance10x = entryPrice - liq10x;
      const distance20x = entryPrice - liq20x;

      expect(distance5x).toBeGreaterThan(distance10x);
      expect(distance10x).toBeGreaterThan(distance20x);
    });

    it('should handle 1x leverage (no liquidation within reasonable range)', () => {
      const entryPrice = 50000;
      const liqPrice = calculateLiquidationPrice(entryPrice, 1, 'LONG');

      expect(liqPrice).toBeLessThan(entryPrice * 0.05);
    });

    it('should use default maintenance margin rate', () => {
      const entryPrice = 50000;
      const leverage = 10;
      const liqPriceDefault = calculateLiquidationPrice(entryPrice, leverage, 'LONG');
      const liqPriceCustom = calculateLiquidationPrice(entryPrice, leverage, 'LONG', 0.01, 0.02);

      expect(liqPriceDefault).not.toEqual(liqPriceCustom);
    });
  });

  describe('calculateLeveragedPnl', () => {
    it('should calculate leveraged PnL for profitable LONG position', () => {
      const entryPrice = 50000;
      const exitPrice = 52500;
      const leverage = 10;
      const result = calculateLeveragedPnl(entryPrice, exitPrice, leverage, 'LONG');

      expect(result.pnlPercent).toBeCloseTo(5, 2);
      expect(result.leveragedPnlPercent).toBeCloseTo(50, 2);
    });

    it('should calculate leveraged PnL for losing LONG position', () => {
      const entryPrice = 50000;
      const exitPrice = 47500;
      const leverage = 10;
      const result = calculateLeveragedPnl(entryPrice, exitPrice, leverage, 'LONG');

      expect(result.pnlPercent).toBeCloseTo(-5, 2);
      expect(result.leveragedPnlPercent).toBeCloseTo(-50, 2);
    });

    it('should calculate leveraged PnL for profitable SHORT position', () => {
      const entryPrice = 50000;
      const exitPrice = 47500;
      const leverage = 10;
      const result = calculateLeveragedPnl(entryPrice, exitPrice, leverage, 'SHORT');

      expect(result.pnlPercent).toBeCloseTo(5, 2);
      expect(result.leveragedPnlPercent).toBeCloseTo(50, 2);
    });

    it('should calculate leveraged PnL for losing SHORT position', () => {
      const entryPrice = 50000;
      const exitPrice = 52500;
      const leverage = 10;
      const result = calculateLeveragedPnl(entryPrice, exitPrice, leverage, 'SHORT');

      expect(result.pnlPercent).toBeCloseTo(-5, 2);
      expect(result.leveragedPnlPercent).toBeCloseTo(-50, 2);
    });

    it('should handle no leverage (1x)', () => {
      const entryPrice = 50000;
      const exitPrice = 51000;
      const leverage = 1;
      const result = calculateLeveragedPnl(entryPrice, exitPrice, leverage, 'LONG');

      expect(result.pnlPercent).toBeCloseTo(2, 2);
      expect(result.leveragedPnlPercent).toBeCloseTo(2, 2);
    });
  });

  describe('calculateFundingPayment', () => {
    it('should calculate funding payment for LONG position with positive rate', () => {
      const positionValue = 10000;
      const fundingRate = 0.01;
      const payment = calculateFundingPayment(positionValue, fundingRate, 'LONG');

      expect(payment).toBeLessThan(0);
      expect(payment).toBeCloseTo(-1, 2);
    });

    it('should calculate funding payment for SHORT position with positive rate', () => {
      const positionValue = 10000;
      const fundingRate = 0.01;
      const payment = calculateFundingPayment(positionValue, fundingRate, 'SHORT');

      expect(payment).toBeGreaterThan(0);
      expect(payment).toBeCloseTo(1, 2);
    });

    it('should calculate funding payment for LONG position with negative rate', () => {
      const positionValue = 10000;
      const fundingRate = -0.01;
      const payment = calculateFundingPayment(positionValue, fundingRate, 'LONG');

      expect(payment).toBeGreaterThan(0);
      expect(payment).toBeCloseTo(1, 2);
    });

    it('should calculate funding payment for SHORT position with negative rate', () => {
      const positionValue = 10000;
      const fundingRate = -0.01;
      const payment = calculateFundingPayment(positionValue, fundingRate, 'SHORT');

      expect(payment).toBeLessThan(0);
      expect(payment).toBeCloseTo(-1, 2);
    });

    it('should handle zero funding rate', () => {
      const positionValue = 10000;
      const fundingRate = 0;
      const payment = calculateFundingPayment(positionValue, fundingRate, 'LONG');

      expect(payment).toBeCloseTo(0, 10);
    });
  });

  describe('wouldLiquidate', () => {
    it('should return true when LONG position hits liquidation price', () => {
      const liquidationPrice = 45000;

      expect(wouldLiquidate(45000, liquidationPrice, 'LONG')).toBe(true);
      expect(wouldLiquidate(44000, liquidationPrice, 'LONG')).toBe(true);
      expect(wouldLiquidate(46000, liquidationPrice, 'LONG')).toBe(false);
    });

    it('should return true when SHORT position hits liquidation price', () => {
      const liquidationPrice = 55000;

      expect(wouldLiquidate(55000, liquidationPrice, 'SHORT')).toBe(true);
      expect(wouldLiquidate(56000, liquidationPrice, 'SHORT')).toBe(true);
      expect(wouldLiquidate(54000, liquidationPrice, 'SHORT')).toBe(false);
    });

    it('should return false when price is safe', () => {
      expect(wouldLiquidate(50000, 45000, 'LONG')).toBe(false);
      expect(wouldLiquidate(50000, 55000, 'SHORT')).toBe(false);
    });
  });

  describe('FUTURES_DEFAULTS', () => {
    it('should have correct default values', () => {
      expect(FUTURES_DEFAULTS.LEVERAGE).toBe(1);
      expect(FUTURES_DEFAULTS.MARGIN_TYPE).toBe('ISOLATED');
      expect(FUTURES_DEFAULTS.TAKER_FEE).toBe(0.0004);
      expect(FUTURES_DEFAULTS.MAKER_FEE).toBe(0.0002);
      expect(FUTURES_DEFAULTS.LIQUIDATION_FEE).toBe(0.015);
      expect(FUTURES_DEFAULTS.MAINTENANCE_MARGIN_RATE).toBe(0.004);
    });

    it('should have lower fees than spot trading', () => {
      const spotTakerFee = 0.001;
      const spotMakerFee = 0.001;

      expect(FUTURES_DEFAULTS.TAKER_FEE).toBeLessThan(spotTakerFee);
      expect(FUTURES_DEFAULTS.MAKER_FEE).toBeLessThan(spotMakerFee);
    });
  });

  describe('Integration: Liquidation scenarios', () => {
    it('should simulate correct liquidation scenario for 10x LONG', () => {
      const entryPrice = 50000;
      const leverage = 10;
      const liqPrice = calculateLiquidationPrice(entryPrice, leverage, 'LONG');

      const pnlAtEntry = calculateLeveragedPnl(entryPrice, entryPrice, leverage, 'LONG');
      expect(pnlAtEntry.leveragedPnlPercent).toBe(0);

      const pnlAtLiquidation = calculateLeveragedPnl(entryPrice, liqPrice, leverage, 'LONG');
      expect(pnlAtLiquidation.leveragedPnlPercent).toBeLessThan(-80);

      expect(wouldLiquidate(liqPrice, liqPrice, 'LONG')).toBe(true);
      expect(wouldLiquidate(liqPrice + 100, liqPrice, 'LONG')).toBe(false);
    });

    it('should simulate correct liquidation scenario for 20x SHORT', () => {
      const entryPrice = 50000;
      const leverage = 20;
      const liqPrice = calculateLiquidationPrice(entryPrice, leverage, 'SHORT');

      const pnlAtLiquidation = calculateLeveragedPnl(entryPrice, liqPrice, leverage, 'SHORT');
      expect(pnlAtLiquidation.leveragedPnlPercent).toBeLessThan(-50);

      expect(wouldLiquidate(liqPrice, liqPrice, 'SHORT')).toBe(true);
      expect(wouldLiquidate(liqPrice - 100, liqPrice, 'SHORT')).toBe(false);
    });

    it('should calculate total PnL including funding payments', () => {
      const entryPrice = 50000;
      const exitPrice = 51000;
      const leverage = 10;
      const positionValue = 10000;

      const { leveragedPnlPercent } = calculateLeveragedPnl(entryPrice, exitPrice, leverage, 'LONG');

      const fundingRates = [0.01, 0.015, -0.005];
      let totalFunding = 0;

      for (const rate of fundingRates) {
        totalFunding += calculateFundingPayment(positionValue, rate, 'LONG');
      }

      const grossPnl = (leveragedPnlPercent / 100) * (positionValue / leverage);
      const netPnl = grossPnl + totalFunding;

      expect(grossPnl).toBeCloseTo(200, 0);
      expect(totalFunding).toBeCloseTo(-2, 1);
      expect(netPnl).toBeCloseTo(198, 0);
    });
  });
});
