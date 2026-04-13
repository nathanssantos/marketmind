import { describe, expect, it } from 'vitest';
import {
  computeWeights,
  computeIndexPrice,
  mapDbComponentToState,
  mapDbSymbolToState,
  COINGECKO_CACHE_TTL_MS,
  KLINE_INTERVALS,
  type ComponentState,
  type CustomSymbolState,
} from '../../services/custom-symbol-helpers';

describe('computeWeights', () => {
  it('returns equal weights for EQUAL method', () => {
    const result = computeWeights('EQUAL', [100, 200, 300]);
    expect(result).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  it('returns equal weights for single element with EQUAL', () => {
    const result = computeWeights('EQUAL', [500]);
    expect(result).toEqual([1]);
  });

  it('calculates MARKET_CAP proportional weights', () => {
    const result = computeWeights('MARKET_CAP', [100, 300]);
    expect(result[0]).toBeCloseTo(0.25);
    expect(result[1]).toBeCloseTo(0.75);
  });

  it('calculates SQRT_MARKET_CAP weights', () => {
    const result = computeWeights('SQRT_MARKET_CAP', [100, 400]);
    const sqrtTotal = Math.sqrt(100) + Math.sqrt(400);
    expect(result[0]).toBeCloseTo(Math.sqrt(100) / sqrtTotal);
    expect(result[1]).toBeCloseTo(Math.sqrt(400) / sqrtTotal);
  });

  it('returns equal weights when total market cap is zero', () => {
    const result = computeWeights('MARKET_CAP', [0, 0, 0]);
    expect(result).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  it('returns equal weights for SQRT_MARKET_CAP with all zeros', () => {
    const result = computeWeights('SQRT_MARKET_CAP', [0, 0]);
    expect(result).toEqual([0.5, 0.5]);
  });

  it('applies cap for CAPPED_MARKET_CAP', () => {
    const result = computeWeights('CAPPED_MARKET_CAP', [900, 50, 50], 40);
    for (const w of result) {
      expect(w).toBeLessThanOrEqual(0.4 + 0.001);
    }
    const sum = result.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0);
  });

  it('does not apply cap for CAPPED_MARKET_CAP when capPercent is undefined', () => {
    const result = computeWeights('CAPPED_MARKET_CAP', [100, 300]);
    expect(result[0]).toBeCloseTo(0.25);
    expect(result[1]).toBeCloseTo(0.75);
  });

  it('handles MANUAL method same as MARKET_CAP', () => {
    const result = computeWeights('MANUAL', [200, 800]);
    expect(result[0]).toBeCloseTo(0.2);
    expect(result[1]).toBeCloseTo(0.8);
  });

  it('weights sum to 1 for EQUAL', () => {
    const result = computeWeights('EQUAL', [10, 20, 30, 40, 50]);
    const sum = result.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0);
  });

  it('weights sum to 1 for MARKET_CAP', () => {
    const result = computeWeights('MARKET_CAP', [1000, 2000, 3000]);
    const sum = result.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0);
  });
});

describe('computeIndexPrice', () => {
  it('calculates weighted index price', () => {
    const state: CustomSymbolState = {
      id: 1,
      symbol: 'TEST',
      name: 'Test Index',
      baseValue: 1000,
      weightingMethod: 'EQUAL',
      capPercent: null,
      rebalanceIntervalDays: 30,
      lastRebalancedAt: null,
      components: [
        { id: 1, symbol: 'BTCUSDT', marketType: 'SPOT', coingeckoId: null, weight: 0.5, basePrice: 100, currentPrice: 200 },
        { id: 2, symbol: 'ETHUSDT', marketType: 'SPOT', coingeckoId: null, weight: 0.5, basePrice: 50, currentPrice: 75 },
      ],
    };
    const price = computeIndexPrice(state);
    expect(price).toBe(1000 * (0.5 * (200 / 100) + 0.5 * (75 / 50)));
  });

  it('returns 0 when all components have zero base price', () => {
    const state: CustomSymbolState = {
      id: 1,
      symbol: 'TEST',
      name: 'Test',
      baseValue: 1000,
      weightingMethod: 'EQUAL',
      capPercent: null,
      rebalanceIntervalDays: 30,
      lastRebalancedAt: null,
      components: [
        { id: 1, symbol: 'A', marketType: 'SPOT', coingeckoId: null, weight: 0.5, basePrice: 0, currentPrice: 100 },
      ],
    };
    expect(computeIndexPrice(state)).toBe(0);
  });

  it('skips components with zero current price', () => {
    const state: CustomSymbolState = {
      id: 1,
      symbol: 'TEST',
      name: 'Test',
      baseValue: 1000,
      weightingMethod: 'EQUAL',
      capPercent: null,
      rebalanceIntervalDays: 30,
      lastRebalancedAt: null,
      components: [
        { id: 1, symbol: 'A', marketType: 'SPOT', coingeckoId: null, weight: 0.5, basePrice: 100, currentPrice: 0 },
        { id: 2, symbol: 'B', marketType: 'SPOT', coingeckoId: null, weight: 0.5, basePrice: 100, currentPrice: 200 },
      ],
    };
    expect(computeIndexPrice(state)).toBe(1000 * (0.5 * (200 / 100)));
  });

  it('returns 0 for empty components', () => {
    const state: CustomSymbolState = {
      id: 1,
      symbol: 'TEST',
      name: 'Test',
      baseValue: 1000,
      weightingMethod: 'EQUAL',
      capPercent: null,
      rebalanceIntervalDays: 30,
      lastRebalancedAt: null,
      components: [],
    };
    expect(computeIndexPrice(state)).toBe(0);
  });

  it('skips components with negative base price', () => {
    const state: CustomSymbolState = {
      id: 1,
      symbol: 'TEST',
      name: 'Test',
      baseValue: 500,
      weightingMethod: 'EQUAL',
      capPercent: null,
      rebalanceIntervalDays: 30,
      lastRebalancedAt: null,
      components: [
        { id: 1, symbol: 'A', marketType: 'SPOT', coingeckoId: null, weight: 1, basePrice: -10, currentPrice: 100 },
      ],
    };
    expect(computeIndexPrice(state)).toBe(0);
  });
});

describe('mapDbComponentToState', () => {
  it('maps DB component to ComponentState', () => {
    const result = mapDbComponentToState({
      id: 42,
      symbol: 'BTCUSDT',
      marketType: 'FUTURES',
      coingeckoId: 'bitcoin',
      weight: '0.75',
      basePrice: '45000.50',
    });
    expect(result).toEqual({
      id: 42,
      symbol: 'BTCUSDT',
      marketType: 'FUTURES',
      coingeckoId: 'bitcoin',
      weight: 0.75,
      basePrice: 45000.50,
      currentPrice: 0,
    });
  });

  it('handles null basePrice', () => {
    const result = mapDbComponentToState({
      id: 1,
      symbol: 'ETHUSDT',
      marketType: 'SPOT',
      coingeckoId: null,
      weight: '0.5',
      basePrice: null,
    });
    expect(result.basePrice).toBe(0);
  });

  it('always sets currentPrice to 0', () => {
    const result = mapDbComponentToState({
      id: 1,
      symbol: 'X',
      marketType: 'SPOT',
      coingeckoId: null,
      weight: '1',
      basePrice: '100',
    });
    expect(result.currentPrice).toBe(0);
  });
});

describe('mapDbSymbolToState', () => {
  it('maps DB symbol to CustomSymbolState', () => {
    const components: ComponentState[] = [
      { id: 1, symbol: 'BTCUSDT', marketType: 'SPOT', coingeckoId: 'bitcoin', weight: 0.6, basePrice: 40000, currentPrice: 0 },
    ];
    const result = mapDbSymbolToState({
      id: 10,
      symbol: 'CRYPTO10',
      name: 'Crypto Top 10',
      baseValue: '1000',
      weightingMethod: 'MARKET_CAP',
      capPercent: '25',
      rebalanceIntervalDays: 7,
      lastRebalancedAt: new Date('2024-01-01'),
    }, components);

    expect(result.id).toBe(10);
    expect(result.symbol).toBe('CRYPTO10');
    expect(result.name).toBe('Crypto Top 10');
    expect(result.baseValue).toBe(1000);
    expect(result.weightingMethod).toBe('MARKET_CAP');
    expect(result.capPercent).toBe(25);
    expect(result.rebalanceIntervalDays).toBe(7);
    expect(result.lastRebalancedAt).toEqual(new Date('2024-01-01'));
    expect(result.components).toBe(components);
  });

  it('handles null capPercent', () => {
    const result = mapDbSymbolToState({
      id: 1,
      symbol: 'TEST',
      name: 'Test',
      baseValue: '500',
      weightingMethod: 'EQUAL',
      capPercent: null,
      rebalanceIntervalDays: null,
      lastRebalancedAt: null,
    }, []);
    expect(result.capPercent).toBeNull();
    expect(result.rebalanceIntervalDays).toBe(30);
    expect(result.lastRebalancedAt).toBeNull();
  });
});

describe('constants', () => {
  it('COINGECKO_CACHE_TTL_MS is 5 minutes', () => {
    expect(COINGECKO_CACHE_TTL_MS).toBe(5 * 60 * 1000);
  });

  it('KLINE_INTERVALS contains expected intervals', () => {
    expect(KLINE_INTERVALS).toEqual(['1m', '5m', '15m', '1h', '4h', '1d']);
  });
});
