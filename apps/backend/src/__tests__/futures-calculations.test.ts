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
    // notional 5000 (qty 0.1 @ 50000) sits in the first bracket: MMR 0.004, cum 0.
    const quantity = 0.1;

    it('should calculate liquidation price for LONG position with 10x leverage', () => {
      const entryPrice = 50000;
      const liqPrice = calculateLiquidationPrice({ entryPrice, quantity, leverage: 10, side: 'LONG' });

      expect(liqPrice).toBeLessThan(entryPrice);
      // (500 - 5000) / (0.1 * (0.004 - 1)) = 45180.72
      expect(liqPrice).toBeCloseTo(45180.72, 1);
    });

    it('should calculate liquidation price for SHORT position with 10x leverage', () => {
      const entryPrice = 50000;
      const liqPrice = calculateLiquidationPrice({ entryPrice, quantity, leverage: 10, side: 'SHORT' });

      expect(liqPrice).toBeGreaterThan(entryPrice);
      // (500 + 5000) / (0.1 * (0.004 + 1)) = 54780.88
      expect(liqPrice).toBeCloseTo(54780.88, 1);
    });

    it('should be much further than 1/leverage alone is naive — 50x stays ~1.6% away', () => {
      // Regression: the old formula added a flat 1.5% liquidation fee to the
      // buffer, which at 50x left the liq price only ~0.1% from entry.
      const entryPrice = 63520.6;
      const liqPrice = calculateLiquidationPrice({ entryPrice, quantity: 0.01, leverage: 50, side: 'LONG' });
      const distancePct = ((entryPrice - liqPrice) / entryPrice) * 100;

      expect(distancePct).toBeGreaterThan(1.4);
      expect(distancePct).toBeLessThan(2);
    });

    it('should have higher liquidation risk with higher leverage', () => {
      const entryPrice = 50000;
      const liq5x = calculateLiquidationPrice({ entryPrice, quantity, leverage: 5, side: 'LONG' });
      const liq10x = calculateLiquidationPrice({ entryPrice, quantity, leverage: 10, side: 'LONG' });
      const liq20x = calculateLiquidationPrice({ entryPrice, quantity, leverage: 20, side: 'LONG' });

      expect(liq10x).toBeGreaterThan(liq5x);
      expect(liq20x).toBeGreaterThan(liq10x);

      expect(entryPrice - liq5x).toBeGreaterThan(entryPrice - liq10x);
      expect(entryPrice - liq10x).toBeGreaterThan(entryPrice - liq20x);
    });

    it('should handle 1x leverage (no liquidation within reasonable range)', () => {
      const entryPrice = 50000;
      const liqPrice = calculateLiquidationPrice({ entryPrice, quantity, leverage: 1, side: 'LONG' });

      expect(liqPrice).toBeLessThan(entryPrice * 0.05);
    });

    it('should liquidate sooner for a notional in a higher maintenance bracket', () => {
      const entryPrice = 50000;
      const smallNotional = calculateLiquidationPrice({ entryPrice, quantity: 0.1, leverage: 10, side: 'LONG' });
      // qty 10 @ 50000 = 500k notional → bracket 3 (MMR 0.01, cum 1300).
      const largeNotional = calculateLiquidationPrice({ entryPrice, quantity: 10, leverage: 10, side: 'LONG' });

      expect(largeNotional).toBeGreaterThan(smallNotional);
    });

    it('should honor explicit per-symbol brackets', () => {
      const entryPrice = 50000;
      const brackets = [{ notionalFloor: 0, notionalCap: 1_000_000, maintMarginRatio: 0.02, cum: 0 }];
      const liqPrice = calculateLiquidationPrice({ entryPrice, quantity, leverage: 10, side: 'LONG', brackets });

      // Higher MMR (0.02) pushes the long liq price closer to entry than the default 0.004.
      const defaultLiq = calculateLiquidationPrice({ entryPrice, quantity, leverage: 10, side: 'LONG' });
      expect(liqPrice).toBeGreaterThan(defaultLiq);
    });

    it('should return 0 for invalid inputs', () => {
      expect(calculateLiquidationPrice({ entryPrice: 0, quantity, leverage: 10, side: 'LONG' })).toBe(0);
      expect(calculateLiquidationPrice({ entryPrice: 50000, quantity: 0, leverage: 10, side: 'LONG' })).toBe(0);
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
      expect(FUTURES_DEFAULTS.TAKER_FEE).toBe(0.0005);
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
      const liqPrice = calculateLiquidationPrice({ entryPrice, quantity: 0.1, leverage, side: 'LONG' });

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
      const liqPrice = calculateLiquidationPrice({ entryPrice, quantity: 0.1, leverage, side: 'SHORT' });

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
