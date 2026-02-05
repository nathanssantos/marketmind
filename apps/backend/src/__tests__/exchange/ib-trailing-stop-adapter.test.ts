import { describe, it, expect } from 'vitest';
import {
  createTrailingStopOrderParams,
  calculateTrailingDistance,
  convertToIBTrailingPercent,
  convertFromIBTrailingPercent,
  mapMarketMindTrailingToIB,
  shouldUseNativeTrailing,
  createModifyTrailingStopParams,
} from '../../exchange/interactive-brokers/trailing-stop-adapter';
import { IB_ORDER_TYPES, IB_ORDER_ACTIONS, IB_TIME_IN_FORCE } from '../../exchange/interactive-brokers/constants';

describe('IB Trailing Stop Adapter', () => {
  describe('createTrailingStopOrderParams', () => {
    it('should create trailing stop order with percent for LONG position', () => {
      const result = createTrailingStopOrderParams({
        symbol: 'AAPL',
        side: 'LONG',
        quantity: 100,
        trailPercent: 2,
      });

      expect(result.orderParams.contract.symbol).toBe('AAPL');
      expect(result.orderParams.action).toBe(IB_ORDER_ACTIONS.SELL);
      expect(result.orderParams.orderType).toBe(IB_ORDER_TYPES.TRAILING_STOP);
      expect(result.orderParams.totalQuantity).toBe(100);
      expect(result.orderParams.trailingPercent).toBe(2);
      expect(result.orderParams.tif).toBe(IB_TIME_IN_FORCE.GTC);
      expect(result.trailingType).toBe('PERCENT');
      expect(result.trailingValue).toBe(2);
    });

    it('should create trailing stop order with percent for SHORT position', () => {
      const result = createTrailingStopOrderParams({
        symbol: 'MSFT',
        side: 'SHORT',
        quantity: 50,
        trailPercent: 1.5,
      });

      expect(result.orderParams.action).toBe(IB_ORDER_ACTIONS.BUY);
      expect(result.orderParams.trailingPercent).toBe(1.5);
      expect(result.trailingType).toBe('PERCENT');
    });

    it('should create trailing stop order with amount', () => {
      const result = createTrailingStopOrderParams({
        symbol: 'GOOGL',
        side: 'LONG',
        quantity: 25,
        trailAmount: 5.00,
      });

      expect(result.orderParams.auxPrice).toBe(5.00);
      expect(result.orderParams.trailingPercent).toBeUndefined();
      expect(result.trailingType).toBe('AMOUNT');
      expect(result.trailingValue).toBe(5.00);
    });

    it('should include initial stop price when provided', () => {
      const result = createTrailingStopOrderParams({
        symbol: 'NVDA',
        side: 'LONG',
        quantity: 100,
        trailPercent: 2,
        initialStopPrice: 145.00,
      });

      expect(result.orderParams.trailStopPrice).toBe(145.00);
    });

    it('should use SMART exchange and USD currency by default', () => {
      const result = createTrailingStopOrderParams({
        symbol: 'TSLA',
        side: 'LONG',
        quantity: 10,
        trailPercent: 3,
      });

      expect(result.orderParams.contract.exchange).toBe('SMART');
      expect(result.orderParams.contract.currency).toBe('USD');
    });

    it('should allow trading outside regular trading hours', () => {
      const result = createTrailingStopOrderParams({
        symbol: 'AMZN',
        side: 'LONG',
        quantity: 50,
        trailPercent: 2,
        outsideRth: true,
      });

      expect(result.orderParams.outsideRth).toBe(true);
    });
  });

  describe('calculateTrailingDistance', () => {
    it('should calculate trailing distance for LONG position', () => {
      const result = calculateTrailingDistance(100, 2, 'LONG');

      expect(result.trailAmount).toBe(2);
      expect(result.stopPrice).toBe(98);
    });

    it('should calculate trailing distance for SHORT position', () => {
      const result = calculateTrailingDistance(100, 2, 'SHORT');

      expect(result.trailAmount).toBe(2);
      expect(result.stopPrice).toBe(102);
    });

    it('should handle fractional percentages', () => {
      const result = calculateTrailingDistance(150, 1.5, 'LONG');

      expect(result.trailAmount).toBe(2.25);
      expect(result.stopPrice).toBe(147.75);
    });
  });

  describe('convertToIBTrailingPercent', () => {
    it('should convert decimal to percentage', () => {
      expect(convertToIBTrailingPercent(0.02)).toBe(2);
      expect(convertToIBTrailingPercent(0.015)).toBe(1.5);
      expect(convertToIBTrailingPercent(0.1)).toBe(10);
    });
  });

  describe('convertFromIBTrailingPercent', () => {
    it('should convert percentage to decimal', () => {
      expect(convertFromIBTrailingPercent(2)).toBe(0.02);
      expect(convertFromIBTrailingPercent(1.5)).toBe(0.015);
      expect(convertFromIBTrailingPercent(10)).toBe(0.1);
    });
  });

  describe('mapMarketMindTrailingToIB', () => {
    it('should return null when profit is below activation threshold', () => {
      const result = mapMarketMindTrailingToIB(
        100,
        100.5,
        'LONG',
        2,
        1
      );

      expect(result).toBeNull();
    });

    it('should return trailing params when profit exceeds activation threshold for LONG', () => {
      const result = mapMarketMindTrailingToIB(
        100,
        103,
        'LONG',
        2,
        1
      );

      expect(result).not.toBeNull();
      expect(result?.trailPercent).toBe(1);
      expect(result?.initialStopPrice).toBeCloseTo(101.97, 1);
    });

    it('should return trailing params when profit exceeds activation threshold for SHORT', () => {
      const result = mapMarketMindTrailingToIB(
        100,
        97,
        'SHORT',
        2,
        1
      );

      expect(result).not.toBeNull();
      expect(result?.trailPercent).toBe(1);
      expect(result?.initialStopPrice).toBeCloseTo(97.97, 1);
    });
  });

  describe('shouldUseNativeTrailing', () => {
    it('should return true for INTERACTIVE_BROKERS', () => {
      expect(shouldUseNativeTrailing('INTERACTIVE_BROKERS')).toBe(true);
    });

    it('should return false for BINANCE', () => {
      expect(shouldUseNativeTrailing('BINANCE')).toBe(false);
    });

    it('should return false for unknown exchanges', () => {
      expect(shouldUseNativeTrailing('UNKNOWN')).toBe(false);
    });
  });

  describe('createModifyTrailingStopParams', () => {
    const baseParams = {
      contract: {
        symbol: 'AAPL',
        secType: 'STK' as any,
        exchange: 'SMART',
        currency: 'USD',
      },
      action: IB_ORDER_ACTIONS.SELL as any,
      orderType: IB_ORDER_TYPES.TRAILING_STOP as any,
      totalQuantity: 100,
      tif: IB_TIME_IN_FORCE.GTC as any,
      trailingPercent: 2,
    };

    it('should update trailing percent', () => {
      const result = createModifyTrailingStopParams(123, baseParams, {
        newTrailPercent: 3,
      });

      expect(result.trailingPercent).toBe(3);
      expect(result.auxPrice).toBeUndefined();
    });

    it('should update trailing amount', () => {
      const result = createModifyTrailingStopParams(123, baseParams, {
        newTrailAmount: 5,
      });

      expect(result.auxPrice).toBe(5);
      expect(result.trailingPercent).toBeUndefined();
    });

    it('should update aux price (trail stop price)', () => {
      const result = createModifyTrailingStopParams(123, baseParams, {
        newAuxPrice: 150,
      });

      expect(result.trailStopPrice).toBe(150);
    });

    it('should preserve other params when updating', () => {
      const result = createModifyTrailingStopParams(123, baseParams, {
        newTrailPercent: 3,
      });

      expect(result.totalQuantity).toBe(100);
      expect(result.tif).toBe(IB_TIME_IN_FORCE.GTC);
      expect(result.contract.symbol).toBe('AAPL');
    });
  });
});
