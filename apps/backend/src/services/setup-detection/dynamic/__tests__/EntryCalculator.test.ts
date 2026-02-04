import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntryPriceConfig, ExitContext, Kline } from '@marketmind/types';

vi.mock('../../../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
}));

const mockIndicatorEngine = {
  resolveIndicatorValue: vi.fn().mockReturnValue(500),
  computeIndicators: vi.fn(),
  clearCache: vi.fn(),
};

vi.mock('../IndicatorEngine', () => ({
  IndicatorEngine: class MockIndicatorEngine {
    resolveIndicatorValue = mockIndicatorEngine.resolveIndicatorValue;
    computeIndicators = mockIndicatorEngine.computeIndicators;
    clearCache = mockIndicatorEngine.clearCache;
  },
}));

import { EntryCalculator } from '../EntryCalculator';
import { IndicatorEngine } from '../IndicatorEngine';

describe('EntryCalculator', () => {
  let entryCalculator: EntryCalculator;
  let indicatorEngine: IndicatorEngine;

  const createMockKlines = (count: number): Kline[] => {
    const klines: Kline[] = [];
    for (let i = 0; i < count; i++) {
      klines.push({
        openTime: Date.now() - (count - i) * 3600000,
        open: (50000 + i * 100).toString(),
        high: (50500 + i * 50).toString(),
        low: (49500 - i * 50).toString(),
        close: (50050 + i * 100).toString(),
        volume: '1000000',
        closeTime: Date.now() - (count - i - 1) * 3600000,
        quoteVolume: '50000000',
        trades: 1000,
        takerBuyBaseVolume: '500000',
        takerBuyQuoteVolume: '25000000',
      });
    }
    return klines;
  };

  const createMockContext = (overrides: Partial<ExitContext> = {}): ExitContext => ({
    direction: 'LONG',
    entryPrice: 50000,
    klines: createMockKlines(50),
    currentIndex: 49,
    indicators: {
      ema: { type: 'ema', values: [50000] },
      atr: { type: 'ema', values: [500] },
    },
    params: {
      atrMultiplier: 2,
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockIndicatorEngine.resolveIndicatorValue.mockReturnValue(500);
    indicatorEngine = new IndicatorEngine();
    entryCalculator = new EntryCalculator(indicatorEngine);
  });

  describe('constructor', () => {
    it('should create EntryCalculator with IndicatorEngine', () => {
      expect(entryCalculator).toBeDefined();
    });
  });

  describe('calculateEntryPrice', () => {
    describe('market order types', () => {
      it('should return MARKET order when config is undefined', () => {
        const context = createMockContext();

        const result = entryCalculator.calculateEntryPrice(undefined, context);

        expect(result.orderType).toBe('MARKET');
        expect(result.price).toBe(50000);
        expect(result.expirationBars).toBe(0);
      });

      it('should return MARKET order for market type', () => {
        const config: EntryPriceConfig = { type: 'market' };
        const context = createMockContext();

        const result = entryCalculator.calculateEntryPrice(config, context);

        expect(result.orderType).toBe('MARKET');
        expect(result.price).toBe(50000);
        expect(result.expirationBars).toBe(0);
      });

      it('should return MARKET order for close type', () => {
        const config: EntryPriceConfig = { type: 'close' };
        const context = createMockContext();

        const result = entryCalculator.calculateEntryPrice(config, context);

        expect(result.orderType).toBe('MARKET');
        expect(result.price).toBe(50000);
        expect(result.expirationBars).toBe(0);
      });
    });

    describe('swingHighLow type', () => {
      const createTightKlines = (): Kline[] => {
        const klines: Kline[] = [];
        for (let i = 0; i < 50; i++) {
          klines.push({
            openTime: Date.now() - (50 - i) * 3600000,
            open: '50000',
            high: '50100',
            low: '49900',
            close: '50050',
            volume: '1000000',
            closeTime: Date.now() - (50 - i - 1) * 3600000,
            quoteVolume: '50000000',
            trades: 1000,
            takerBuyBaseVolume: '500000',
            takerBuyQuoteVolume: '25000000',
          });
        }
        return klines;
      };

      it('should calculate LONG entry using swing lows within distance', () => {
        const config: EntryPriceConfig = {
          type: 'swingHighLow',
          lookback: 3,
          expirationBars: 5,
        };
        const context = createMockContext({
          direction: 'LONG',
          entryPrice: 50050,
          klines: createTightKlines(),
        });

        const result = entryCalculator.calculateEntryPrice(config, context);

        expect(result.orderType).toBe('LIMIT');
        expect(result.price).toBe(49900);
        expect(result.expirationBars).toBe(5);
      });

      it('should calculate SHORT entry using swing highs within distance', () => {
        const config: EntryPriceConfig = {
          type: 'swingHighLow',
          lookback: 3,
          expirationBars: 5,
        };
        const context = createMockContext({
          direction: 'SHORT',
          entryPrice: 50050,
          klines: createTightKlines(),
        });

        const result = entryCalculator.calculateEntryPrice(config, context);

        expect(result.orderType).toBe('LIMIT');
        expect(result.price).toBe(50100);
        expect(result.expirationBars).toBe(5);
      });

      it('should fall back to MARKET when swing entry exceeds distance', () => {
        const config: EntryPriceConfig = {
          type: 'swingHighLow',
          lookback: 3,
        };
        const context = createMockContext({
          direction: 'LONG',
          entryPrice: 50000,
        });

        const result = entryCalculator.calculateEntryPrice(config, context);

        expect(result.orderType).toBe('MARKET');
        expect(result.price).toBe(50000);
      });

      it('should apply ATR buffer to swing entry', () => {
        const config: EntryPriceConfig = {
          type: 'swingHighLow',
          lookback: 2,
          buffer: 0.1,
          indicator: 'atr',
        };
        mockIndicatorEngine.resolveIndicatorValue.mockReturnValue(50);
        const context = createMockContext({
          direction: 'LONG',
          entryPrice: 50050,
          klines: createTightKlines(),
        });

        const result = entryCalculator.calculateEntryPrice(config, context);

        expect(result.orderType).toBe('LIMIT');
      });

      it('should apply percent buffer when no ATR indicator', () => {
        const config: EntryPriceConfig = {
          type: 'swingHighLow',
          lookback: 2,
          buffer: 0.01,
        };
        const context = createMockContext({
          direction: 'LONG',
          entryPrice: 50050,
          klines: createTightKlines(),
        });

        const result = entryCalculator.calculateEntryPrice(config, context);

        expect(result.orderType).toBe('LIMIT');
      });

      it('should use default lookback when not specified', () => {
        const config: EntryPriceConfig = {
          type: 'swingHighLow',
        };
        const context = createMockContext({
          direction: 'LONG',
          entryPrice: 50050,
          klines: createTightKlines(),
        });

        const result = entryCalculator.calculateEntryPrice(config, context);

        expect(result).toBeDefined();
      });

      it('should use default expirationBars when not specified', () => {
        const config: EntryPriceConfig = {
          type: 'swingHighLow',
          lookback: 2,
        };
        const context = createMockContext({
          direction: 'LONG',
          entryPrice: 50050,
          klines: createTightKlines(),
        });

        const result = entryCalculator.calculateEntryPrice(config, context);

        expect(result.expirationBars).toBe(3);
      });
    });

    describe('percent type', () => {
      const createTightKlines = (): Kline[] => {
        const klines: Kline[] = [];
        for (let i = 0; i < 50; i++) {
          klines.push({
            openTime: Date.now() - (50 - i) * 3600000,
            open: '50000',
            high: '50100',
            low: '49900',
            close: '50050',
            volume: '1000000',
            closeTime: Date.now() - (50 - i - 1) * 3600000,
            quoteVolume: '50000000',
            trades: 1000,
            takerBuyBaseVolume: '500000',
            takerBuyQuoteVolume: '25000000',
          });
        }
        return klines;
      };

      it('should calculate percent retracement for LONG within distance', () => {
        const config: EntryPriceConfig = {
          type: 'percent',
          lookback: 3,
          retracementPercent: 50,
          expirationBars: 4,
        };
        const context = createMockContext({
          direction: 'LONG',
          entryPrice: 50050,
          klines: createTightKlines(),
        });

        const result = entryCalculator.calculateEntryPrice(config, context);

        expect(result.orderType).toBe('LIMIT');
        expect(result.expirationBars).toBe(4);
      });

      it('should calculate percent retracement for SHORT within distance', () => {
        const config: EntryPriceConfig = {
          type: 'percent',
          lookback: 3,
          retracementPercent: 80,
          expirationBars: 4,
        };
        const context = createMockContext({
          direction: 'SHORT',
          entryPrice: 50050,
          klines: createTightKlines(),
        });

        const result = entryCalculator.calculateEntryPrice(config, context);

        expect(result.orderType).toBe('LIMIT');
      });

      it('should fall back to MARKET when retracement direction is invalid', () => {
        const config: EntryPriceConfig = {
          type: 'percent',
          lookback: 3,
          retracementPercent: 50,
          expirationBars: 3,
        };
        const context = createMockContext({
          direction: 'SHORT',
          entryPrice: 50050,
          klines: createTightKlines(),
        });

        const result = entryCalculator.calculateEntryPrice(config, context);

        expect(result.orderType).toBe('MARKET');
      });

      it('should use default retracement percent when not specified', () => {
        const config: EntryPriceConfig = {
          type: 'percent',
          lookback: 3,
        };
        const context = createMockContext({
          direction: 'LONG',
          entryPrice: 50050,
          klines: createTightKlines(),
        });

        const result = entryCalculator.calculateEntryPrice(config, context);

        expect(result).toBeDefined();
      });

      it('should return entry price when no klines available', () => {
        const config: EntryPriceConfig = {
          type: 'percent',
          lookback: 3,
          expirationBars: 3,
        };
        const context = createMockContext({
          direction: 'LONG',
          entryPrice: 50000,
          klines: [],
          currentIndex: -1,
        });

        const result = entryCalculator.calculateEntryPrice(config, context);

        expect(result.price).toBe(50000);
        expect(result.orderType).toBe('LIMIT');
      });
    });

    describe('indicator type', () => {
      it('should calculate entry from indicator value within distance', () => {
        const config: EntryPriceConfig = {
          type: 'indicator',
          indicator: 'ema',
          expirationBars: 3,
        };
        mockIndicatorEngine.resolveIndicatorValue.mockReturnValue(49900);
        const context = createMockContext({
          direction: 'LONG',
          entryPrice: 50000,
        });

        const result = entryCalculator.calculateEntryPrice(config, context);

        expect(result.orderType).toBe('LIMIT');
        expect(result.price).toBe(49900);
        expect(result.expirationBars).toBe(3);
      });

      it('should return entry price when indicator not available', () => {
        const config: EntryPriceConfig = {
          type: 'indicator',
          indicator: 'nonexistent',
          expirationBars: 3,
        };
        mockIndicatorEngine.resolveIndicatorValue.mockReturnValue(null);
        const context = createMockContext({
          direction: 'LONG',
          entryPrice: 50000,
        });

        const result = entryCalculator.calculateEntryPrice(config, context);

        expect(result.price).toBe(50000);
        expect(result.orderType).toBe('LIMIT');
      });

      it('should return entry price when indicator config is missing', () => {
        const config: EntryPriceConfig = {
          type: 'indicator',
          expirationBars: 3,
        };
        const context = createMockContext({
          direction: 'LONG',
          entryPrice: 50000,
        });

        const result = entryCalculator.calculateEntryPrice(config, context);

        expect(result.price).toBe(50000);
        expect(result.orderType).toBe('LIMIT');
      });
    });

    describe('validation', () => {
      it('should fall back to MARKET when LONG entry above close within distance', () => {
        const config: EntryPriceConfig = {
          type: 'indicator',
          indicator: 'ema',
        };
        mockIndicatorEngine.resolveIndicatorValue.mockReturnValue(50100);
        const context = createMockContext({
          direction: 'LONG',
          entryPrice: 50000,
        });

        const result = entryCalculator.calculateEntryPrice(config, context);

        expect(result.orderType).toBe('MARKET');
        expect(result.price).toBe(50000);
      });

      it('should fall back to MARKET when SHORT entry below close within distance', () => {
        const config: EntryPriceConfig = {
          type: 'indicator',
          indicator: 'ema',
        };
        mockIndicatorEngine.resolveIndicatorValue.mockReturnValue(49900);
        const context = createMockContext({
          direction: 'SHORT',
          entryPrice: 50000,
        });

        const result = entryCalculator.calculateEntryPrice(config, context);

        expect(result.orderType).toBe('MARKET');
        expect(result.price).toBe(50000);
      });

      it('should fall back to MARKET when entry exceeds max distance', () => {
        const config: EntryPriceConfig = {
          type: 'indicator',
          indicator: 'ema',
        };
        mockIndicatorEngine.resolveIndicatorValue.mockReturnValue(49500);
        const context = createMockContext({
          direction: 'LONG',
          entryPrice: 50000,
        });

        const result = entryCalculator.calculateEntryPrice(config, context);

        expect(result.orderType).toBe('MARKET');
        expect(result.price).toBe(50000);
      });

      it('should accept valid LONG entry at or below close within distance', () => {
        const config: EntryPriceConfig = {
          type: 'indicator',
          indicator: 'ema',
        };
        mockIndicatorEngine.resolveIndicatorValue.mockReturnValue(49800);
        const context = createMockContext({
          direction: 'LONG',
          entryPrice: 50000,
        });

        const result = entryCalculator.calculateEntryPrice(config, context);

        expect(result.orderType).toBe('LIMIT');
        expect(result.price).toBe(49800);
      });

      it('should accept valid SHORT entry at or above close within distance', () => {
        const config: EntryPriceConfig = {
          type: 'indicator',
          indicator: 'ema',
        };
        mockIndicatorEngine.resolveIndicatorValue.mockReturnValue(50200);
        const context = createMockContext({
          direction: 'SHORT',
          entryPrice: 50000,
        });

        const result = entryCalculator.calculateEntryPrice(config, context);

        expect(result.orderType).toBe('LIMIT');
        expect(result.price).toBe(50200);
      });

      it('should accept entry exactly at close price', () => {
        const config: EntryPriceConfig = {
          type: 'indicator',
          indicator: 'ema',
        };
        mockIndicatorEngine.resolveIndicatorValue.mockReturnValue(50000);
        const context = createMockContext({
          direction: 'LONG',
          entryPrice: 50000,
        });

        const result = entryCalculator.calculateEntryPrice(config, context);

        expect(result.orderType).toBe('LIMIT');
        expect(result.price).toBe(50000);
      });
    });

    describe('default unknown type', () => {
      it('should use entry price for unknown type and validate as LIMIT', () => {
        const config = {
          type: 'unknown' as any,
          expirationBars: 3,
        };
        const context = createMockContext({
          direction: 'LONG',
          entryPrice: 50000,
        });

        const result = entryCalculator.calculateEntryPrice(config, context);

        expect(result.price).toBe(50000);
        expect(result.orderType).toBe('LIMIT');
        expect(result.expirationBars).toBe(3);
      });
    });
  });

  describe('resolveOperand', () => {
    it('should resolve parameter reference', () => {
      const config: EntryPriceConfig = {
        type: 'swingHighLow',
        lookback: 2,
        buffer: '$atrMultiplier' as any,
        indicator: 'atr',
      };
      mockIndicatorEngine.resolveIndicatorValue.mockReturnValue(100);
      const context = createMockContext({
        direction: 'LONG',
        entryPrice: 50000,
        params: { atrMultiplier: 0.5 },
      });

      const result = entryCalculator.calculateEntryPrice(config, context);

      expect(result).toBeDefined();
    });

    it('should resolve indicator reference', () => {
      const config: EntryPriceConfig = {
        type: 'swingHighLow',
        lookback: 2,
        buffer: 'atr' as any,
        indicator: 'atr',
      };
      mockIndicatorEngine.resolveIndicatorValue.mockReturnValue(100);
      const context = createMockContext({
        direction: 'LONG',
        entryPrice: 50000,
      });

      const result = entryCalculator.calculateEntryPrice(config, context);

      expect(result).toBeDefined();
    });
  });
});
