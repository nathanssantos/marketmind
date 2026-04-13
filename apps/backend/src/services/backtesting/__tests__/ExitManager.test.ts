import { describe, expect, it } from 'vitest';
import type { Kline } from '@marketmind/types';
import { ExitManager } from '../ExitManager';

const createMockKline = (options: {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
}): Kline => ({
  openTime: options.openTime,
  closeTime: options.openTime + 3600000,
  open: options.open,
  high: options.high,
  low: options.low,
  close: options.close,
  volume: '1000',
  quoteVolume: '50000000',
  trades: 1000,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '25000000',
});

describe('ExitManager', () => {
  describe('constructor', () => {
    it('should create with default config', () => {
      const manager = new ExitManager({});
      expect(manager).toBeDefined();
    });

    it('should create with market type config', () => {
      const manager = new ExitManager({ marketType: 'FUTURES' });
      expect(manager).toBeDefined();
    });
  });

  describe('checkStopLossAndTakeProfit', () => {
    it('should detect stop loss hit for LONG position', () => {
      const manager = new ExitManager({});

      const result = manager.checkStopLossAndTakeProfit(
        'LONG', 50500, 48500, 50000, 49000, 49000, 52000
      );

      expect(result.hit).toBe('SL');
      expect(result.price).toBe(49000);
    });

    it('should detect stop loss hit for SHORT position', () => {
      const manager = new ExitManager({});

      const result = manager.checkStopLossAndTakeProfit(
        'SHORT', 51500, 50000, 50500, 51000, 51000, 48000
      );

      expect(result.hit).toBe('SL');
      expect(result.price).toBe(51000);
    });

    it('should detect take profit hit for LONG position', () => {
      const manager = new ExitManager({});

      const result = manager.checkStopLossAndTakeProfit(
        'LONG', 52500, 50500, 50500, 52000, 49000, 52000
      );

      expect(result.hit).toBe('TP');
      expect(result.price).toBe(52000);
    });

    it('should return null when neither SL nor TP hit', () => {
      const manager = new ExitManager({});

      const result = manager.checkStopLossAndTakeProfit(
        'LONG', 51000, 49500, 50000, 50500, 49000, 52000
      );

      expect(result.hit).toBeNull();
    });
  });

  describe('findExit', () => {
    const entryTime = 1700000000000;
    const makeKlines = (count: number, base = 50000): Kline[] =>
      Array.from({ length: count }, (_, i) =>
        createMockKline({
          openTime: entryTime + i * 3600000,
          open: String(base),
          high: String(base + 200),
          low: String(base - 200),
          close: String(base + 50),
        })
      );

    it('should find stop loss exit', () => {
      const manager = new ExitManager({});
      const klines = [
        ...makeKlines(2, 50000),
        createMockKline({ openTime: entryTime + 2 * 3600000, open: '50000', high: '50100', low: '48000', close: '48500' }),
        ...makeKlines(2, 50000),
      ];

      const result = manager.findExit(
        { direction: 'LONG' },
        klines,
        0,
        49000,
        52000,
        undefined
      );

      expect(result).not.toBeNull();
      expect(result!.exitReason).toBe('STOP_LOSS');
    });

    it('should find take profit exit', () => {
      const manager = new ExitManager({});
      const klines = [
        ...makeKlines(2, 50000),
        createMockKline({ openTime: entryTime + 2 * 3600000, open: '50000', high: '52500', low: '50000', close: '52000' }),
        ...makeKlines(2, 50000),
      ];

      const result = manager.findExit(
        { direction: 'LONG' },
        klines,
        0,
        49000,
        52000,
        undefined
      );

      expect(result).not.toBeNull();
      expect(result!.exitReason).toBe('TAKE_PROFIT');
    });

    it('should find exit condition from exitSignals', () => {
      const manager = new ExitManager({});
      const klines = makeKlines(5, 50000);
      const exitSignals: (number | null)[] = [null, null, 1, null, null];

      const result = manager.findExit(
        { direction: 'LONG' },
        klines,
        0,
        45000,
        55000,
        exitSignals
      );

      expect(result).not.toBeNull();
      expect(result!.exitReason).toBe('EXIT_CONDITION');
    });

    it('should not exit on wrong direction exitSignal', () => {
      const manager = new ExitManager({});
      const klines = makeKlines(5, 50000);
      const exitSignals: (number | null)[] = [null, null, -1, null, null];

      const result = manager.findExit(
        { direction: 'LONG' },
        klines,
        0,
        45000,
        55000,
        exitSignals
      );

      expect(result).not.toBeNull();
      expect(result!.exitReason).toBe('END_OF_PERIOD');
    });

    it('should respect maxBarsInTrade', () => {
      const manager = new ExitManager({});
      const klines = makeKlines(10, 50000);

      const result = manager.findExit(
        { direction: 'LONG' },
        klines,
        0,
        45000,
        55000,
        undefined,
        3
      );

      expect(result).not.toBeNull();
      expect(result!.exitReason).toBe('MAX_BARS');
    });

    it('should return END_OF_PERIOD when no exit found', () => {
      const manager = new ExitManager({});
      const klines = makeKlines(5, 50000);

      const result = manager.findExit(
        { direction: 'LONG' },
        klines,
        0,
        45000,
        55000,
        undefined
      );

      expect(result).not.toBeNull();
      expect(result!.exitReason).toBe('END_OF_PERIOD');
    });
  });

  describe('applySlippage', () => {
    it('should apply slippage for LONG stop loss', () => {
      const manager = new ExitManager({ slippagePercent: 0.1 });

      const result = manager.applySlippage(50000, 'STOP_LOSS', 'LONG');

      expect(result).toBeLessThan(50000);
    });

    it('should apply slippage for SHORT stop loss', () => {
      const manager = new ExitManager({ slippagePercent: 0.1 });

      const result = manager.applySlippage(50000, 'STOP_LOSS', 'SHORT');

      expect(result).toBeGreaterThan(50000);
    });
  });
});
