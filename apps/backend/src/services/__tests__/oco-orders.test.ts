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
    trace: vi.fn(),
  },
}));

vi.mock('../binance-client', () => ({
  createBinanceClient: vi.fn(),
  isPaperWallet: vi.fn((wallet) => wallet.walletType === 'paper'),
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
      expect(result?.stopLimitPrice).toBeCloseTo(48000 * 0.995, 0);
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
      expect(result?.stopLimitPrice).toBeCloseTo(52000 * 1.005, 0);
    });

    it('should apply 0.5% buffer to stop limit price for LONG', () => {
      const params = {
        entryPrice: 50000,
        stopLoss: 48000,
        takeProfit: 54000,
        side: 'LONG' as const,
      };

      const result = service.calculateOCOPrices(params);
      const expectedStopLimit = 48000 * 0.995;

      expect(result?.stopLimitPrice).toBeCloseTo(expectedStopLimit, 0);
    });

    it('should apply 0.5% buffer to stop limit price for SHORT', () => {
      const params = {
        entryPrice: 50000,
        stopLoss: 52000,
        takeProfit: 46000,
        side: 'SHORT' as const,
      };

      const result = service.calculateOCOPrices(params);
      const expectedStopLimit = 52000 * 1.005;

      expect(result?.stopLimitPrice).toBeCloseTo(expectedStopLimit, 0);
    });

    it('should set SELL side for LONG position', () => {
      const params = {
        entryPrice: 50000,
        stopLoss: 48000,
        takeProfit: 54000,
        side: 'LONG' as const,
      };

      const result = service.calculateOCOPrices(params);

      expect(result?.side).toBe('SELL');
    });

    it('should set BUY side for SHORT position', () => {
      const params = {
        entryPrice: 50000,
        stopLoss: 52000,
        takeProfit: 46000,
        side: 'SHORT' as const,
      };

      const result = service.calculateOCOPrices(params);

      expect(result?.side).toBe('BUY');
    });

    it('should return empty symbol and zero quantity', () => {
      const params = {
        entryPrice: 50000,
        stopLoss: 48000,
        takeProfit: 54000,
        side: 'LONG' as const,
      };

      const result = service.calculateOCOPrices(params);

      expect(result?.symbol).toBe('');
      expect(result?.quantity).toBe(0);
    });
  });

  describe('createExitOCO', () => {
    it('should return null for paper wallet', async () => {
      const paperWallet = {
        id: 'wallet-1',
        walletType: 'paper',
        apiKeyEncrypted: 'paper-trading',
        apiSecretEncrypted: 'paper-trading',
      };

      const result = await service.createExitOCO(
        paperWallet as never,
        'BTCUSDT',
        0.1,
        48000,
        54000,
        'LONG'
      );

      expect(result).toBeNull();
    });
  });

  describe('cancelOCO', () => {
    it('should return false for paper wallet', async () => {
      const paperWallet = {
        id: 'wallet-1',
        walletType: 'paper',
        apiKeyEncrypted: 'paper-trading',
        apiSecretEncrypted: 'paper-trading',
      };

      const result = await service.cancelOCO(
        paperWallet as never,
        'BTCUSDT',
        '12345'
      );

      expect(result).toBe(false);
    });
  });

  describe('placeOCO', () => {
    it('should return null for paper wallet', async () => {
      const paperWallet = {
        id: 'wallet-1',
        walletType: 'paper',
        apiKeyEncrypted: 'paper-trading',
        apiSecretEncrypted: 'paper-trading',
      };

      const result = await service.placeOCO(paperWallet as never, {
        symbol: 'BTCUSDT',
        side: 'SELL',
        quantity: 0.1,
        price: 54000,
        stopPrice: 48000,
        stopLimitPrice: 47760,
      });

      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle very small prices correctly', () => {
      const params = {
        entryPrice: 0.0001,
        stopLoss: 0.00009,
        takeProfit: 0.00012,
        side: 'LONG' as const,
      };

      const result = service.calculateOCOPrices(params);

      expect(result?.price).toBe(0.00012);
      expect(result?.stopPrice).toBe(0.00009);
      expect(result?.stopLimitPrice).toBeCloseTo(0.00009 * 0.995, 10);
    });

    it('should handle very large prices correctly', () => {
      const params = {
        entryPrice: 100000,
        stopLoss: 95000,
        takeProfit: 110000,
        side: 'LONG' as const,
      };

      const result = service.calculateOCOPrices(params);

      expect(result?.price).toBe(110000);
      expect(result?.stopPrice).toBe(95000);
      expect(result?.stopLimitPrice).toBeCloseTo(95000 * 0.995, 0);
    });
  });
});
