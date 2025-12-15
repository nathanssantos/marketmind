import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OCOOrderService } from '../oco-orders';

vi.mock('../../db', () => ({
  db: {
    query: {
      wallets: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock('../binance', () => ({
  createBinanceClient: vi.fn(),
}));

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../../env', () => ({
  env: {
    BINANCE_TESTNET_ENABLED: false,
  },
}));

describe('OCOOrderService', () => {
  let service: OCOOrderService;

  beforeEach(() => {
    service = new OCOOrderService();
    vi.clearAllMocks();
  });

  describe('isEnabled', () => {
    it('should return false when testnet is disabled', () => {
      expect(service.isEnabled()).toBe(false);
    });
  });

  describe('calculateOCOPrices', () => {
    it('should calculate correct prices for LONG order', () => {
      const params = {
        entryPrice: 50000,
        stopLoss: 48000,
        takeProfit: 54000,
        side: 'LONG' as const,
      };

      const result = service.calculateOCOPrices(params);

      expect(result?.price).toBe(54000);
      expect(result?.stopPrice).toBe(48000);
      expect(result?.stopLimitPrice).toBeCloseTo(48000 * 0.999, 0);
    });

    it('should calculate correct prices for SHORT order', () => {
      const params = {
        entryPrice: 50000,
        stopLoss: 52000,
        takeProfit: 46000,
        side: 'SHORT' as const,
      };

      const result = service.calculateOCOPrices(params);

      expect(result?.price).toBe(46000);
      expect(result?.stopPrice).toBe(52000);
      expect(result?.stopLimitPrice).toBeCloseTo(52000 * 1.001, 0);
    });

    it('should apply 0.1% buffer to stop limit price for LONG', () => {
      const params = {
        entryPrice: 50000,
        stopLoss: 48000,
        takeProfit: 54000,
        side: 'LONG' as const,
      };

      const result = service.calculateOCOPrices(params);
      const expectedStopLimit = 48000 * 0.999;

      expect(result?.stopLimitPrice).toBeCloseTo(expectedStopLimit, 0);
    });

    it('should apply 0.1% buffer to stop limit price for SHORT', () => {
      const params = {
        entryPrice: 50000,
        stopLoss: 52000,
        takeProfit: 46000,
        side: 'SHORT' as const,
      };

      const result = service.calculateOCOPrices(params);
      const expectedStopLimit = 52000 * 1.001;

      expect(result?.stopLimitPrice).toBeCloseTo(expectedStopLimit, 0);
    });
  });
});
