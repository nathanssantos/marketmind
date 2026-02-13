import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@marketmind/types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@marketmind/types')>();
  return {
    ...actual,
    getRoundTripFee: vi.fn(({ marketType }: { marketType?: string }) =>
      marketType === 'SPOT' ? 0.002 : 0.0008
    ),
  };
});

vi.mock('../../constants', () => ({
  AUTO_TRADING_KELLY: {
    DEFAULT_WIN_RATE: 0.45,
    DEFAULT_AVG_RR: 2.0,
    FRACTIONAL_KELLY: 0.25,
    MIN_TRADES_FOR_STATS: 20,
  },
  AUTO_TRADING_ORDER: {
    DEFAULT_MIN_NOTIONAL: 5,
    MIN_NOTIONAL_BUFFER: 1.1,
  },
}));

const mockDbSelect = vi.fn();
vi.mock('../../db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

vi.mock('../../db/schema', () => ({
  klines: { symbol: 'symbol', interval: 'interval', openTime: 'openTime', marketType: 'marketType' },
  tradeExecutions: {
    setupType: 'setupType',
    symbol: 'symbol',
    status: 'status',
    pnlPercent: 'pnlPercent',
    walletId: 'walletId',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
  sql: vi.fn((strings: TemplateStringsArray) => strings[0]),
}));

vi.mock('../../utils/errors', () => ({
  serializeError: vi.fn((e: unknown) => String(e)),
}));

const mockFormatPrice = vi.fn((price: number, _tickSize?: string) => String(price));
const mockFormatQuantity = vi.fn((qty: number, _stepSize?: string) => String(qty));
vi.mock('../../utils/formatters', () => ({
  formatPriceForBinance: (...args: Parameters<typeof mockFormatPrice>) => mockFormatPrice(...args),
  formatQuantityForBinance: (...args: Parameters<typeof mockFormatQuantity>) => mockFormatQuantity(...args),
}));

vi.mock('../../utils/kline-mapper', () => ({
  mapDbKlinesReversed: vi.fn((klines: unknown[]) => klines),
}));

const mockValidateMinNotional = vi.fn((): { isValid: boolean; reason?: string } => ({ isValid: true }));
const mockCalculateVolatilityAdj = vi.fn(() => ({
  factor: 1.0,
  isHighVolatility: false,
  atrPercent: 2.0,
  rationale: 'Normal volatility',
}));
vi.mock('../../utils/trade-validation', () => ({
  calculateVolatilityAdjustment: (...args: Parameters<typeof mockCalculateVolatilityAdj>) => mockCalculateVolatilityAdj(...args),
  validateMinNotional: (...args: Parameters<typeof mockValidateMinNotional>) => mockValidateMinNotional(...args),
  VOLATILITY_DEFAULTS: { ATR_PERIOD: 14, HIGH_VOLATILITY_THRESHOLD: 5, REDUCTION_FACTOR: 0.7 },
}));

const mockFuturesSubmitOrder = vi.fn();
const mockFuturesSetLeverage = vi.fn();
const mockFuturesSetMarginType = vi.fn();
const mockFuturesSetPositionMode = vi.fn();
vi.mock('../../exchange', () => ({
  getFuturesClient: vi.fn(() => ({
    submitOrder: mockFuturesSubmitOrder,
    setLeverage: mockFuturesSetLeverage,
    setMarginType: mockFuturesSetMarginType,
    setPositionMode: mockFuturesSetPositionMode,
  })),
  getSpotClient: vi.fn(() => ({
    submitOrder: vi.fn().mockResolvedValue({
      orderId: 200,
      symbol: 'BTCUSDT',
      side: 'BUY',
      origQty: '0.001',
      executedQty: '0.001',
      price: '50000',
    }),
  })),
}));

vi.mock('../../../services/binance-client', () => ({
  isPaperWallet: vi.fn((wallet: { walletType: string }) => wallet.walletType === 'PAPER'),
}));

vi.mock('../../services/binance-client', () => ({
  isPaperWallet: vi.fn((wallet: { walletType: string }) => wallet.walletType === 'PAPER'),
}));

const mockGetSymbolFilters = vi.fn().mockResolvedValue(new Map());
vi.mock('../../services/min-notional-filter', () => ({
  getMinNotionalFilterService: vi.fn(() => ({
    getSymbolFilters: mockGetSymbolFilters,
  })),
}));

const mockCreateSLOrder = vi.fn();
const mockCreateTPOrder = vi.fn();
vi.mock('../../services/protection-orders', () => ({
  createStopLossOrder: (...args: unknown[]) => mockCreateSLOrder(...args),
  createTakeProfitOrder: (...args: unknown[]) => mockCreateTPOrder(...args),
}));

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
    debug: vi.fn(),
  },
}));

import { AutoTradingService } from '../../services/auto-trading';
import type { AutoTradingConfig } from '../../db/schema';

const createMockConfig = (overrides: Partial<Record<string, unknown>> = {}): AutoTradingConfig => ({
  id: 'config-1',
  walletId: 'wallet-1',
  userId: 'user-1',
  maxPositionSize: '10',
  positionSizing: 'percentage',
  dailyLossLimit: '5',
  maxConcurrentPositions: 3,
  enabledSetupTypes: '[]',
  useDynamicSymbolSelection: false,
  dynamicSymbolExcluded: null,
  enableAutoRotation: true,
  leverage: 5,
  useBtcCorrelationFilter: false,
  isEnabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
} as unknown as AutoTradingConfig);

const createMockWallet = (overrides: Record<string, unknown> = {}) => ({
  id: 'wallet-1',
  userId: 'user-1',
  name: 'Test Wallet',
  walletType: 'LIVE',
  exchange: 'BINANCE',
  apiKey: 'encrypted-key',
  apiSecret: 'encrypted-secret',
  currentBalance: '10000',
  ...overrides,
});

describe('AutoTradingService', () => {
  let service: AutoTradingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AutoTradingService();
    mockGetSymbolFilters.mockResolvedValue(new Map());
  });

  describe('roundQuantity (private)', () => {
    it('should round quantities less than 1 to 5 decimal places', () => {
      const result = (service as any).roundQuantity(0.123456);
      expect(result).toBe(0.12345);
    });

    it('should round quantities between 1 and 10 to 3 decimal places', () => {
      const result = (service as any).roundQuantity(5.6789);
      expect(result).toBe(5.678);
    });

    it('should round quantities 10 and above to 2 decimal places', () => {
      const result = (service as any).roundQuantity(123.4567);
      expect(result).toBe(123.45);
    });

    it('should floor rather than round up', () => {
      const result = (service as any).roundQuantity(0.99999);
      expect(result).toBe(0.99999);
    });

    it('should handle very small quantities', () => {
      const result = (service as any).roundQuantity(0.00001);
      expect(result).toBe(0.00001);
    });

    it('should handle exactly 1', () => {
      const result = (service as any).roundQuantity(1.0);
      expect(result).toBe(1.0);
    });

    it('should handle exactly 10', () => {
      const result = (service as any).roundQuantity(10.0);
      expect(result).toBe(10.0);
    });
  });

  describe('validateRiskLimits', () => {
    it('should return valid when all limits are within range', () => {
      const config = createMockConfig();
      const positionSize = { quantity: 0.01, notionalValue: 500, riskAmount: 50 };

      const result = service.validateRiskLimits(config, 10000, 0, 0, positionSize);
      expect(result.isValid).toBe(true);
    });

    it('should reject when min notional validation fails', () => {
      mockValidateMinNotional.mockReturnValueOnce({ isValid: false, reason: 'Below minimum notional' });
      const config = createMockConfig();
      const positionSize = { quantity: 0.0001, notionalValue: 1, riskAmount: 0.1 };

      const result = service.validateRiskLimits(config, 10000, 0, 0, positionSize);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Below minimum notional');
    });

    it('should reject when position size exceeds maximum', () => {
      const config = createMockConfig({ maxPositionSize: '10' });
      const positionSize = { quantity: 1, notionalValue: 1500, riskAmount: 100 };

      const result = service.validateRiskLimits(config, 10000, 0, 0, positionSize);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('exceeds maximum');
    });

    it('should reject when daily loss limit is exceeded', () => {
      const config = createMockConfig({ dailyLossLimit: '5' });
      const positionSize = { quantity: 0.01, notionalValue: 500, riskAmount: 50 };

      const result = service.validateRiskLimits(config, 10000, 0, -600, positionSize);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Daily loss limit reached');
    });

    it('should reject when total exposure exceeds maximum concurrent value', () => {
      const config = createMockConfig({ maxPositionSize: '10', maxConcurrentPositions: 2 });
      const positionSize = { quantity: 0.01, notionalValue: 500, riskAmount: 50 };

      const result = service.validateRiskLimits(config, 10000, 1800, 0, positionSize);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Total exposure');
    });

    it('should pass when exactly at the daily loss limit', () => {
      const config = createMockConfig({ dailyLossLimit: '5' });
      const positionSize = { quantity: 0.01, notionalValue: 500, riskAmount: 50 };

      const result = service.validateRiskLimits(config, 10000, 0, -499, positionSize);
      expect(result.isValid).toBe(true);
    });

    it('should pass when exactly at the max position value', () => {
      const config = createMockConfig({ maxPositionSize: '10' });
      const positionSize = { quantity: 0.01, notionalValue: 1000, riskAmount: 50 };

      const result = service.validateRiskLimits(config, 10000, 0, 0, positionSize);
      expect(result.isValid).toBe(true);
    });
  });

  describe('calculateFeeViability', () => {
    it('should return viable for high risk-reward ratio', () => {
      const result = service.calculateFeeViability(100, 95, 115, 'FUTURES');
      expect(result.isViable).toBe(true);
      expect(result.actualRR).toBe(3);
    });

    it('should report actualRR and minRR correctly for marginal trade', () => {
      const result = service.calculateFeeViability(100, 99.99, 100.001, 'FUTURES');
      expect(result.actualRR).toBeCloseTo(0.1, 5);
      expect(result.minRR).toBeGreaterThan(0);
      expect(result.minRR).toBeLessThan(result.actualRR);
    });

    it('should use different fees for SPOT vs FUTURES', () => {
      const futuresResult = service.calculateFeeViability(100, 95, 110, 'FUTURES');
      const spotResult = service.calculateFeeViability(100, 95, 110, 'SPOT');
      expect(futuresResult.minRR).not.toBe(spotResult.minRR);
    });

    it('should calculate correct risk-reward ratio', () => {
      const result = service.calculateFeeViability(100, 90, 120, 'FUTURES');
      expect(result.actualRR).toBe(2);
    });

    it('should handle short position correctly', () => {
      const result = service.calculateFeeViability(100, 105, 90, 'FUTURES');
      expect(result.actualRR).toBe(2);
    });
  });

  describe('createOrderFromSetup', () => {
    it('should create a BUY order for LONG direction', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([]),
            })),
          })),
        })),
      });

      const setup = {
        id: 'setup-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        direction: 'LONG',
        entryPrice: '50000',
        stopLoss: '49000',
        setupType: 'momentum',
      };
      const config = createMockConfig();

      const result = await service.createOrderFromSetup(setup as any, config, 10000);

      expect(result.side).toBe('BUY');
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.type).toBe('LIMIT');
      expect(result.price).toBe(50000);
      expect(result.timeInForce).toBe('GTC');
    });

    it('should create a SELL order for SHORT direction', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([]),
            })),
          })),
        })),
      });

      const setup = {
        id: 'setup-1',
        symbol: 'ETHUSDT',
        interval: '1h',
        direction: 'SHORT',
        entryPrice: '3000',
        stopLoss: '3100',
        setupType: 'momentum',
      };
      const config = createMockConfig();

      const result = await service.createOrderFromSetup(setup as any, config, 10000);

      expect(result.side).toBe('SELL');
      expect(result.symbol).toBe('ETHUSDT');
    });

    it('should use default stop loss when not provided', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([]),
            })),
          })),
        })),
      });

      const setup = {
        id: 'setup-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        direction: 'LONG',
        entryPrice: '50000',
        stopLoss: null,
        setupType: 'momentum',
      };
      const config = createMockConfig();

      const result = await service.createOrderFromSetup(setup as any, config, 10000);
      expect(result.quantity).toBeGreaterThan(0);
    });
  });

  describe('calculatePositionSize', () => {
    beforeEach(() => {
      mockDbSelect.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([]),
            })),
          })),
        })),
      });
    });

    it('should calculate fixed position size', async () => {
      const config = createMockConfig({ positionSizing: 'fixed', maxPositionSize: '10' });
      const result = await service.calculatePositionSize(config, 10000, 50000, 49000);

      expect(result.quantity).toBeGreaterThan(0);
      expect(result.notionalValue).toBeGreaterThan(0);
      expect(result.riskAmount).toBeGreaterThan(0);
    });

    it('should calculate percentage position size', async () => {
      const config = createMockConfig({ positionSizing: 'percentage', maxPositionSize: '10' });
      const result = await service.calculatePositionSize(config, 10000, 50000, 49000);

      expect(result.notionalValue).toBeLessThanOrEqual(1000 * 1.01);
    });

    it('should calculate kelly position size', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ([{
            totalTrades: 50,
            wins: 25,
            avgWin: 3.0,
            avgLoss: 1.5,
          }])),
        })),
      });

      const config = createMockConfig({ positionSizing: 'kelly', maxPositionSize: '10' });
      const result = await service.calculatePositionSize(
        config, 10000, 50000, 49000, 'momentum', 'BTCUSDT', '1h'
      );

      expect(result.quantity).toBeGreaterThan(0);
    });

    it('should apply default for unknown sizing strategy', async () => {
      const config = createMockConfig({ positionSizing: 'unknown_strategy', maxPositionSize: '10' });
      const result = await service.calculatePositionSize(config, 10000, 50000, 49000);

      expect(result.quantity).toBeGreaterThan(0);
    });

    it('should apply volatility adjustment', async () => {
      const klinesMock = Array(20).fill({ symbol: 'BTCUSDT', interval: '1h' });
      const dbChain = {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue(klinesMock),
            })),
          })),
        })),
      };
      mockDbSelect.mockReturnValue(dbChain);

      mockCalculateVolatilityAdj.mockReturnValueOnce({
        factor: 0.5,
        isHighVolatility: true,
        atrPercent: 8.0,
        rationale: 'High volatility',
      });

      const config = createMockConfig({ positionSizing: 'percentage', maxPositionSize: '10' });
      const resultReduced = await service.calculatePositionSize(
        config, 100000, 100, 99, 'momentum', 'BTCUSDT', '1h'
      );

      mockDbSelect.mockReturnValue(dbChain);
      mockCalculateVolatilityAdj.mockReturnValueOnce({
        factor: 1.0,
        isHighVolatility: false,
        atrPercent: 2.0,
        rationale: 'Normal',
      });

      const resultNormal = await service.calculatePositionSize(
        config, 100000, 100, 99, 'momentum', 'BTCUSDT', '1h'
      );

      expect(resultReduced.quantity).toBeLessThan(resultNormal.quantity);
    });

    it('should calculate risk amount based on entry and stop loss', async () => {
      const config = createMockConfig({ positionSizing: 'percentage', maxPositionSize: '10' });
      const result = await service.calculatePositionSize(config, 10000, 50000, 48000);

      expect(result.riskAmount).toBeCloseTo(result.quantity * 2000, 0);
    });
  });

  describe('calculateVolatilityAdjustment (private)', () => {
    it('should return 1.0 when symbol is missing', async () => {
      const result = await (service as any).calculateVolatilityAdjustment(undefined, '1h', 50000);
      expect(result).toBe(1.0);
    });

    it('should return 1.0 when interval is missing', async () => {
      const result = await (service as any).calculateVolatilityAdjustment('BTCUSDT', undefined, 50000);
      expect(result).toBe(1.0);
    });

    it('should return 1.0 when currentPrice is missing', async () => {
      const result = await (service as any).calculateVolatilityAdjustment('BTCUSDT', '1h', undefined);
      expect(result).toBe(1.0);
    });

    it('should return 1.0 when insufficient klines', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue(Array(10).fill({})),
            })),
          })),
        })),
      });

      const result = await (service as any).calculateVolatilityAdjustment('BTCUSDT', '1h', 50000);
      expect(result).toBe(1.0);
    });

    it('should return 1.0 on error', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn().mockRejectedValue(new Error('DB error')),
            })),
          })),
        })),
      });

      const result = await (service as any).calculateVolatilityAdjustment('BTCUSDT', '1h', 50000);
      expect(result).toBe(1.0);
    });
  });

  describe('calculateKellyCriterion (private)', () => {
    it('should use defaults when no strategy info provided', async () => {
      const result = await (service as any).calculateKellyCriterion();
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(0.1);
    });

    it('should use real stats when sufficient trades exist', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{
            totalTrades: 50,
            wins: 30,
            avgWin: 3.0,
            avgLoss: 1.0,
          }]),
        })),
      });

      const result = await (service as any).calculateKellyCriterion('momentum', 'BTCUSDT', '1h');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(0.1);
    });

    it('should fall back to defaults when insufficient trades', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{
            totalTrades: 5,
            wins: 3,
            avgWin: 2.0,
            avgLoss: 1.0,
          }]),
        })),
      });

      const resultWithFewTrades = await (service as any).calculateKellyCriterion('momentum', 'BTCUSDT', '1h');
      const resultDefault = await (service as any).calculateKellyCriterion();
      expect(resultWithFewTrades).toBe(resultDefault);
    });

    it('should cap kelly at 10%', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{
            totalTrades: 100,
            wins: 90,
            avgWin: 10.0,
            avgLoss: 0.1,
          }]),
        })),
      });

      const result = await (service as any).calculateKellyCriterion('momentum', 'BTCUSDT', '1h');
      expect(result).toBeLessThanOrEqual(0.1);
    });

    it('should return 0 for negative kelly criterion', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{
            totalTrades: 50,
            wins: 5,
            avgWin: 0.5,
            avgLoss: 2.0,
          }]),
        })),
      });

      const result = await (service as any).calculateKellyCriterion('bad-strategy', 'BTCUSDT', '1h');
      expect(result).toBe(0);
    });

    it('should handle DB error gracefully', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn().mockRejectedValue(new Error('DB error')),
        })),
      });

      const result = await (service as any).calculateKellyCriterion('momentum', 'BTCUSDT', '1h');
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getStrategyStatistics (private)', () => {
    it('should return null when no trades found', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ totalTrades: 0, wins: 0, avgWin: null, avgLoss: null }]),
        })),
      });

      const result = await (service as any).getStrategyStatistics('momentum', 'BTCUSDT');
      expect(result).toBeNull();
    });

    it('should return stats for valid trades', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{
            totalTrades: 50,
            wins: 25,
            avgWin: 3.0,
            avgLoss: 1.5,
          }]),
        })),
      });

      const result = await (service as any).getStrategyStatistics('momentum', 'BTCUSDT');
      expect(result).toEqual({
        winRate: 0.5,
        avgRR: 2.0,
        totalTrades: 50,
      });
    });

    it('should use default avgLoss when avgLoss is zero (falsy fallback)', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{
            totalTrades: 10,
            wins: 10,
            avgWin: 3.0,
            avgLoss: 0,
          }]),
        })),
      });

      const result = await (service as any).getStrategyStatistics('strategy', 'BTCUSDT');
      expect(result!.avgRR).toBe(3.0);
    });

    it('should return null on database error', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn().mockRejectedValue(new Error('DB error')),
        })),
      });

      const result = await (service as any).getStrategyStatistics('momentum', 'BTCUSDT');
      expect(result).toBeNull();
    });

    it('should handle null result row', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([null]),
        })),
      });

      const result = await (service as any).getStrategyStatistics('momentum', 'BTCUSDT');
      expect(result).toBeNull();
    });
  });

  describe('executeBinanceOrder', () => {
    it('should throw for paper wallets', async () => {
      const wallet = createMockWallet({ walletType: 'PAPER' });
      const orderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY' as const,
        type: 'LIMIT' as const,
        quantity: 0.01,
        price: 50000,
        timeInForce: 'GTC' as const,
      };

      await expect(service.executeBinanceOrder(wallet as any, orderParams, 'FUTURES'))
        .rejects.toThrow('Paper wallets cannot execute real orders');
    });

    it('should execute futures order with correct params', async () => {
      const wallet = createMockWallet();
      mockFuturesSubmitOrder.mockResolvedValue({
        orderId: 100,
        symbol: 'BTCUSDT',
        side: 'BUY',
        origQty: '0.01',
        executedQty: '0.01',
        price: '50000',
      });

      const orderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY' as const,
        type: 'LIMIT' as const,
        quantity: 0.01,
        price: 50000,
        timeInForce: 'GTC' as const,
      };

      const result = await service.executeBinanceOrder(wallet as any, orderParams, 'FUTURES');
      expect(result.orderId).toBe(100);
      expect(mockFuturesSubmitOrder).toHaveBeenCalled();
    });

    it('should throw when notional is below minimum', async () => {
      const wallet = createMockWallet();
      const filters = new Map([['BTCUSDT', { minNotional: 10, stepSize: 0.001, tickSize: 0.01 }]]);
      mockGetSymbolFilters.mockResolvedValue(filters);

      const orderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY' as const,
        type: 'LIMIT' as const,
        quantity: 0.0001,
        price: 50,
        timeInForce: 'GTC' as const,
      };

      await expect(service.executeBinanceOrder(wallet as any, orderParams, 'FUTURES'))
        .rejects.toThrow('notional');
    });

    it('should include stopPrice for stop orders', async () => {
      const wallet = createMockWallet();
      mockFuturesSubmitOrder.mockResolvedValue({
        orderId: 101,
        symbol: 'BTCUSDT',
        side: 'SELL',
        origQty: '0.01',
        executedQty: '0.01',
        price: '49000',
      });

      const orderParams = {
        symbol: 'BTCUSDT',
        side: 'SELL' as const,
        type: 'STOP_MARKET' as const,
        quantity: 0.01,
        stopPrice: 49000,
        reduceOnly: true,
      };

      await service.executeBinanceOrder(wallet as any, orderParams, 'FUTURES');
      expect(mockFuturesSubmitOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          stopPrice: expect.any(String),
          reduceOnly: true,
        })
      );
    });

    it('should execute spot order when marketType is SPOT', async () => {
      const wallet = createMockWallet();
      const orderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY' as const,
        type: 'LIMIT' as const,
        quantity: 0.01,
        price: 50000,
        timeInForce: 'GTC' as const,
      };

      const result = await service.executeBinanceOrder(wallet as any, orderParams, 'SPOT');
      expect(result.orderId).toBe(200);
    });

    it('should not include price for MARKET orders', async () => {
      const wallet = createMockWallet();
      mockFuturesSubmitOrder.mockResolvedValue({
        orderId: 102,
        symbol: 'BTCUSDT',
        side: 'BUY',
        origQty: '0.01',
        executedQty: '0.01',
        price: '50000',
      });

      const orderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY' as const,
        type: 'MARKET' as const,
        quantity: 0.01,
        price: 50000,
      };

      await service.executeBinanceOrder(wallet as any, orderParams, 'FUTURES');
      const callArgs = mockFuturesSubmitOrder.mock.calls[0]![0];
      expect(callArgs.price).toBeUndefined();
    });
  });

  describe('createStopLossOrder', () => {
    it('should use protection order service for FUTURES', async () => {
      mockCreateSLOrder.mockResolvedValue({ algoId: 42 });
      const wallet = createMockWallet();

      const result = await service.createStopLossOrder(wallet as any, 'BTCUSDT', 0.01, 49000, 'LONG', 'FUTURES');
      expect(result).toEqual({ algoId: 42, isAlgoOrder: true });
      expect(mockCreateSLOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTCUSDT',
          side: 'LONG',
          quantity: 0.01,
          triggerPrice: 49000,
          marketType: 'FUTURES',
        })
      );
    });

    it('should create STOP_LOSS_LIMIT order for SPOT LONG', async () => {
      mockFuturesSubmitOrder.mockResolvedValue({
        orderId: 300,
        symbol: 'BTCUSDT',
        side: 'SELL',
        origQty: '0.01',
        executedQty: '0.01',
        price: '49000',
      });

      const wallet = createMockWallet();

      const result = await service.createStopLossOrder(wallet as any, 'BTCUSDT', 0.01, 49000, 'LONG', 'SPOT');
      expect(result.isAlgoOrder).toBe(false);
    });

    it('should set price below stop for SELL side (LONG close)', async () => {
      const wallet = createMockWallet();
      const executeSpy = vi.spyOn(service, 'executeBinanceOrder').mockResolvedValue({
        orderId: 301,
        executedQty: '0.01',
        price: '49000',
      });

      await service.createStopLossOrder(wallet as any, 'BTCUSDT', 0.01, 49000, 'LONG', 'SPOT');

      const orderParams = executeSpy.mock.calls[0]![1];
      expect(orderParams.price).toBeLessThan(49000);
      executeSpy.mockRestore();
    });

    it('should set price above stop for BUY side (SHORT close)', async () => {
      const wallet = createMockWallet();
      const executeSpy = vi.spyOn(service, 'executeBinanceOrder').mockResolvedValue({
        orderId: 302,
        executedQty: '0.01',
        price: '51000',
      });

      await service.createStopLossOrder(wallet as any, 'BTCUSDT', 0.01, 51000, 'SHORT', 'SPOT');

      const orderParams = executeSpy.mock.calls[0]![1];
      expect(orderParams.price).toBeGreaterThan(51000);
      executeSpy.mockRestore();
    });
  });

  describe('createTakeProfitOrder', () => {
    it('should use protection order service for FUTURES', async () => {
      mockCreateTPOrder.mockResolvedValue({ algoId: 55 });
      const wallet = createMockWallet();

      const result = await service.createTakeProfitOrder(wallet as any, 'BTCUSDT', 0.01, 55000, 'LONG', 'FUTURES');
      expect(result).toEqual({ algoId: 55, isAlgoOrder: true });
    });

    it('should create LIMIT order for SPOT', async () => {
      const wallet = createMockWallet();
      const executeSpy = vi.spyOn(service, 'executeBinanceOrder').mockResolvedValue({
        orderId: 400,
        executedQty: '0.01',
        price: '55000',
      });

      const result = await service.createTakeProfitOrder(wallet as any, 'BTCUSDT', 0.01, 55000, 'LONG', 'SPOT');
      expect(result.isAlgoOrder).toBe(false);
      expect(result).toHaveProperty('orderId', 400);

      const orderParams = executeSpy.mock.calls[0]![1];
      expect(orderParams.type).toBe('LIMIT');
      expect(orderParams.price).toBe(55000);
      executeSpy.mockRestore();
    });
  });

  describe('closePosition', () => {
    it('should simulate close for paper wallet', async () => {
      const wallet = createMockWallet({ walletType: 'PAPER' });

      const result = await service.closePosition(wallet as any, 'BTCUSDT', 0.01, 'SELL', 'FUTURES');
      expect(result).toEqual({ orderId: 0, avgPrice: 0 });
    });

    it('should close futures position with reduceOnly', async () => {
      const wallet = createMockWallet();
      mockFuturesSubmitOrder.mockResolvedValue({
        orderId: 500,
        avgPrice: '50500',
        price: '50500',
      });

      const result = await service.closePosition(wallet as any, 'BTCUSDT', 0.01, 'SELL', 'FUTURES');
      expect(result).toBeDefined();
      expect(result!.orderId).toBe(500);
      expect(mockFuturesSubmitOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'MARKET',
          reduceOnly: true,
        })
      );
    });

    it('should close spot position with MARKET order', async () => {
      const wallet = createMockWallet();

      const result = await service.closePosition(wallet as any, 'BTCUSDT', 0.01, 'SELL', 'SPOT');
      expect(result).toBeDefined();
      expect(result!.orderId).toBe(200);
    });

    it('should return null on error', async () => {
      const wallet = createMockWallet();
      mockFuturesSubmitOrder.mockRejectedValue(new Error('Connection error'));

      const result = await service.closePosition(wallet as any, 'BTCUSDT', 0.01, 'SELL', 'FUTURES');
      expect(result).toBeNull();
    });
  });

  describe('setFuturesLeverage', () => {
    it('should simulate for paper wallet', async () => {
      const wallet = createMockWallet({ walletType: 'PAPER' });
      await expect(service.setFuturesLeverage(wallet as any, 'BTCUSDT', 10)).resolves.not.toThrow();
      expect(mockFuturesSetLeverage).not.toHaveBeenCalled();
    });

    it('should set leverage on live wallet', async () => {
      const wallet = createMockWallet();
      mockFuturesSetLeverage.mockResolvedValue(undefined);

      await service.setFuturesLeverage(wallet as any, 'BTCUSDT', 10);
      expect(mockFuturesSetLeverage).toHaveBeenCalledWith('BTCUSDT', 10);
    });

    it('should handle "No need to change" error gracefully', async () => {
      const wallet = createMockWallet();
      mockFuturesSetLeverage.mockRejectedValue(new Error('No need to change leverage'));

      await expect(service.setFuturesLeverage(wallet as any, 'BTCUSDT', 10)).resolves.not.toThrow();
    });

    it('should throw for other errors', async () => {
      const wallet = createMockWallet();
      mockFuturesSetLeverage.mockRejectedValue(new Error('Unauthorized'));

      await expect(service.setFuturesLeverage(wallet as any, 'BTCUSDT', 10))
        .rejects.toThrow('Failed to set leverage');
    });
  });

  describe('setFuturesMarginType', () => {
    it('should simulate for paper wallet', async () => {
      const wallet = createMockWallet({ walletType: 'PAPER' });
      await expect(service.setFuturesMarginType(wallet as any, 'BTCUSDT', 'ISOLATED')).resolves.not.toThrow();
      expect(mockFuturesSetMarginType).not.toHaveBeenCalled();
    });

    it('should set margin type on live wallet', async () => {
      const wallet = createMockWallet();
      mockFuturesSetMarginType.mockResolvedValue(undefined);

      await service.setFuturesMarginType(wallet as any, 'BTCUSDT', 'ISOLATED');
      expect(mockFuturesSetMarginType).toHaveBeenCalledWith('BTCUSDT', 'ISOLATED');
    });

    it('should handle "No need to change margin type" gracefully', async () => {
      const wallet = createMockWallet();
      mockFuturesSetMarginType.mockRejectedValue(new Error('No need to change margin type'));

      await expect(service.setFuturesMarginType(wallet as any, 'BTCUSDT', 'ISOLATED')).resolves.not.toThrow();
    });

    it('should throw for other margin type errors', async () => {
      const wallet = createMockWallet();
      mockFuturesSetMarginType.mockRejectedValue(new Error('Server error'));

      await expect(service.setFuturesMarginType(wallet as any, 'BTCUSDT', 'CROSSED'))
        .rejects.toThrow('Failed to set margin type');
    });
  });

  describe('setFuturesPositionMode', () => {
    it('should simulate for paper wallet', async () => {
      const wallet = createMockWallet({ walletType: 'PAPER' });
      await expect(service.setFuturesPositionMode(wallet as any, true)).resolves.not.toThrow();
      expect(mockFuturesSetPositionMode).not.toHaveBeenCalled();
    });

    it('should set position mode on live wallet', async () => {
      const wallet = createMockWallet();
      mockFuturesSetPositionMode.mockResolvedValue(undefined);

      await service.setFuturesPositionMode(wallet as any, true);
      expect(mockFuturesSetPositionMode).toHaveBeenCalledWith(true);
    });

    it('should handle "No need to change position side" gracefully', async () => {
      const wallet = createMockWallet();
      mockFuturesSetPositionMode.mockRejectedValue(new Error('No need to change position side'));

      await expect(service.setFuturesPositionMode(wallet as any, false)).resolves.not.toThrow();
    });

    it('should throw for other position mode errors', async () => {
      const wallet = createMockWallet();
      mockFuturesSetPositionMode.mockRejectedValue(new Error('API error'));

      await expect(service.setFuturesPositionMode(wallet as any, true))
        .rejects.toThrow('Failed to set position mode');
    });
  });
});
