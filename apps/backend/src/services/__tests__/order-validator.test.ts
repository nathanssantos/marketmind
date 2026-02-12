import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateOrder, validateOrderQuick, type OrderParams } from '../order-validator';
import type { Wallet } from '../../db/schema';

vi.mock('../min-notional-filter', () => ({
  getMinNotionalFilterService: vi.fn(() => ({
    getSymbolFilters: vi.fn().mockResolvedValue(
      new Map([
        ['BTCUSDT', { minNotional: 5, stepSize: 0.001, tickSize: 0.01, minQty: 0.001 }],
        ['ETHUSDT', { minNotional: 5, stepSize: 0.01, tickSize: 0.01, minQty: 0.01 }],
      ])
    ),
  })),
}));

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
}));

const createWallet = (balance: string = '1000'): Wallet => ({
  id: 'wallet-1',
  userId: 'user-1',
  name: 'Test Wallet',
  type: 'FUTURES',
  exchange: 'BINANCE',
  apiKey: 'encrypted-key',
  apiSecret: 'encrypted-secret',
  currentBalance: balance,
  totalDeposits: '1000',
  totalWithdrawals: '0',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  leverage: 10,
  tradingProfileId: null,
  autoTradingConfigId: null,
}) as unknown as Wallet;

describe('order-validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateOrder', () => {
    it('should validate a correct order', async () => {
      const wallet = createWallet('1000');
      const params: OrderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 0.01,
        price: 45000,
        leverage: 10,
      };

      const result = await validateOrder(wallet, params, 'FUTURES');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should add warning when no filters found for symbol', async () => {
      const wallet = createWallet('1000');
      const params: OrderParams = {
        symbol: 'UNKNOWNUSDT',
        side: 'BUY',
        quantity: 1,
        price: 100,
        leverage: 10,
      };

      const result = await validateOrder(wallet, params, 'FUTURES');

      expect(result.warnings.some(w => w.includes('No filter data found'))).toBe(true);
    });

    it('should adjust quantity to step size and add warning', async () => {
      const wallet = createWallet('1000');
      const params: OrderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 0.0125,
        price: 45000,
        leverage: 10,
      };

      const result = await validateOrder(wallet, params, 'FUTURES');

      expect(result.adjustedQuantity).toBe(0.012);
      expect(result.warnings.some(w => w.includes('Quantity adjusted'))).toBe(true);
    });

    it('should error when quantity below minimum', async () => {
      const wallet = createWallet('1000');
      const params: OrderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 0.0001,
        price: 45000,
        leverage: 10,
      };

      const result = await validateOrder(wallet, params, 'FUTURES');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('below minimum'))).toBe(true);
    });

    it('should adjust price to tick size and add warning', async () => {
      const wallet = createWallet('1000');
      const params: OrderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 0.01,
        price: 45000.555,
        leverage: 10,
      };

      const result = await validateOrder(wallet, params, 'FUTURES');

      expect(result.adjustedPrice).toBeDefined();
      expect(result.warnings.some(w => w.includes('Price adjusted'))).toBe(true);
    });

    it('should error when notional value is below minimum', async () => {
      const wallet = createWallet('1000');
      const params: OrderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 0.001,
        price: 1,
        leverage: 10,
      };

      const result = await validateOrder(wallet, params, 'FUTURES');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('below minimum'))).toBe(true);
    });

    it('should error when insufficient balance', async () => {
      const wallet = createWallet('1');
      const params: OrderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 0.01,
        price: 45000,
        leverage: 1,
      };

      const result = await validateOrder(wallet, params, 'FUTURES');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Insufficient balance'))).toBe(true);
    });

    it('should warn when order uses most of available capital', async () => {
      const wallet = createWallet('50');
      const params: OrderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 0.01,
        price: 48000,
        leverage: 10,
      };

      const result = await validateOrder(wallet, params, 'FUTURES');

      expect(result.warnings.some(w => w.includes('available capital'))).toBe(true);
    });

    it('should skip balance check when skipBalanceCheck option is set', async () => {
      const wallet = createWallet('1');
      const params: OrderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 0.01,
        price: 45000,
        leverage: 10,
      };

      const result = await validateOrder(wallet, params, 'FUTURES', {
        skipBalanceCheck: true,
      });

      expect(result.errors.every(e => !e.includes('Insufficient balance'))).toBe(true);
    });

    it('should error on excessive leverage', async () => {
      const wallet = createWallet('1000');
      const params: OrderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 0.01,
        price: 45000,
        leverage: 200,
      };

      const result = await validateOrder(wallet, params, 'FUTURES');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('exceeds maximum'))).toBe(true);
    });

    it('should warn on high leverage', async () => {
      const wallet = createWallet('1000');
      const params: OrderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 0.01,
        price: 45000,
        leverage: 50,
      };

      const result = await validateOrder(wallet, params, 'FUTURES');

      expect(result.warnings.some(w => w.includes('High leverage'))).toBe(true);
    });

    it('should skip leverage check when skipLeverageCheck is set', async () => {
      const wallet = createWallet('1000');
      const params: OrderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 0.01,
        price: 45000,
        leverage: 200,
      };

      const result = await validateOrder(wallet, params, 'FUTURES', {
        skipLeverageCheck: true,
      });

      expect(result.errors.every(e => !e.includes('exceeds maximum'))).toBe(true);
    });

    it('should not check leverage for SPOT market type', async () => {
      const wallet = createWallet('1000');
      const params: OrderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 0.01,
        price: 45000,
        leverage: 200,
      };

      const result = await validateOrder(wallet, params, 'SPOT');

      expect(result.errors.every(e => !e.includes('exceeds maximum'))).toBe(true);
    });

    it('should not return adjustedQuantity when no adjustment needed', async () => {
      const wallet = createWallet('1000');
      const params: OrderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 0.01,
        price: 45000,
        leverage: 10,
      };

      const result = await validateOrder(wallet, params, 'FUTURES');

      expect(result.adjustedQuantity).toBeUndefined();
    });

    it('should not return adjustedPrice when no adjustment needed', async () => {
      const wallet = createWallet('1000');
      const params: OrderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 0.01,
        price: 45000.01,
        leverage: 10,
      };

      const result = await validateOrder(wallet, params, 'FUTURES');

      expect(result.adjustedPrice).toBeUndefined();
    });

    it('should handle validation error gracefully', async () => {
      const { getMinNotionalFilterService } = await import('../min-notional-filter');
      (getMinNotionalFilterService as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        getSymbolFilters: vi.fn().mockRejectedValue(new Error('DB connection failed')),
      });

      const wallet = createWallet('1000');
      const params: OrderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 0.01,
        price: 45000,
      };

      const result = await validateOrder(wallet, params, 'FUTURES');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Validation error'))).toBe(true);
    });

    it('should handle non-Error thrown during validation', async () => {
      const { getMinNotionalFilterService } = await import('../min-notional-filter');
      (getMinNotionalFilterService as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        getSymbolFilters: vi.fn().mockRejectedValue('raw string error'),
      });

      const wallet = createWallet('1000');
      const params: OrderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 0.01,
        price: 45000,
      };

      const result = await validateOrder(wallet, params, 'FUTURES');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Unknown error'))).toBe(true);
    });

    it('should use default leverage of 1 when not provided', async () => {
      const wallet = createWallet('100');
      const params: OrderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 0.01,
        price: 45000,
      };

      const result = await validateOrder(wallet, params, 'FUTURES');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Insufficient balance'))).toBe(true);
    });
  });

  describe('validateOrderQuick', () => {
    it('should return valid for a good order', () => {
      const result = validateOrderQuick(1, 100, 5);
      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject quantity below minimum', () => {
      const result = validateOrderQuick(0.001, 100, 5, undefined, undefined, 0.01);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('below minimum');
    });

    it('should reject quantity not aligned to step size', () => {
      const result = validateOrderQuick(0.015, 100, 5, 0.01);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('step size');
    });

    it('should accept quantity aligned to step size', () => {
      const result = validateOrderQuick(0.1, 100, 5, 0.01);
      expect(result.isValid).toBe(true);
    });

    it('should reject price not aligned to tick size', () => {
      const result = validateOrderQuick(1, 100.555, 5, undefined, 0.01);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('tick size');
    });

    it('should accept price aligned to tick size', () => {
      const result = validateOrderQuick(1, 100.01, 5, undefined, 0.01);
      expect(result.isValid).toBe(true);
    });

    it('should reject notional below minimum with buffer', () => {
      const result = validateOrderQuick(0.01, 1, 5);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('below minimum');
    });

    it('should skip step size check when stepSize is 0', () => {
      const result = validateOrderQuick(1.015, 100, 5, 0);
      expect(result.isValid).toBe(true);
    });

    it('should skip tick size check when tickSize is 0', () => {
      const result = validateOrderQuick(1, 100.555, 5, undefined, 0);
      expect(result.isValid).toBe(true);
    });

    it('should skip minQty check when not provided', () => {
      const result = validateOrderQuick(1, 100, 5);
      expect(result.isValid).toBe(true);
    });
  });
});
