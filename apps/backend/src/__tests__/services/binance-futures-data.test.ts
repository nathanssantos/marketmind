import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BinanceFuturesDataService, getBinanceFuturesDataService } from '../../services/binance-futures-data';

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
  serializeError: vi.fn((e) => e),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('BinanceFuturesDataService', () => {
  let service: BinanceFuturesDataService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    service = new BinanceFuturesDataService();
    service.clearCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getFundingRate', () => {
    it('should fetch funding rate data', async () => {
      const mockData = [
        { symbol: 'BTCUSDT', fundingTime: 1700000000000, fundingRate: '0.0001', markPrice: '50000' },
        { symbol: 'BTCUSDT', fundingTime: 1700003600000, fundingRate: '0.00015', markPrice: '50100' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await service.getFundingRate('BTCUSDT');

      expect(result).toHaveLength(2);
      expect(result[0]!.rate).toBe(0.01);
      expect((result[0] as unknown as { markPrice: number }).markPrice).toBe(50000);
      expect(result[0]!.timestamp).toBe(1700000000000);
    });

    it('should return cached data on second call', async () => {
      const mockData = [
        { symbol: 'BTCUSDT', fundingTime: 1700000000000, fundingRate: '0.0001', markPrice: '50000' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      await service.getFundingRate('BTCUSDT');
      const result = await service.getFundingRate('BTCUSDT');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });

    it('should return empty array on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await service.getFundingRate('BTCUSDT');
      expect(result).toEqual([]);
    });

    it('should return empty array on fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.getFundingRate('BTCUSDT');
      expect(result).toEqual([]);
    });
  });

  describe('getCurrentFundingRate', () => {
    it('should fetch current funding rate', async () => {
      const mockData = {
        lastFundingRate: '0.0002',
        nextFundingTime: 1700007200000,
        markPrice: '50500',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await service.getCurrentFundingRate('BTCUSDT');

      expect(result).not.toBeNull();
      expect(result!.rate).toBe(0.02);
      expect(result!.nextFundingTime).toBe(1700007200000);
      expect(result!.markPrice).toBe(50500);
    });

    it('should return null on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await service.getCurrentFundingRate('BTCUSDT');
      expect(result).toBeNull();
    });

    it('should return null on fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.getCurrentFundingRate('BTCUSDT');
      expect(result).toBeNull();
    });
  });

  describe('getOpenInterest', () => {
    it('should fetch open interest data', async () => {
      const mockData = [
        { symbol: 'BTCUSDT', sumOpenInterest: '10000', sumOpenInterestValue: '500000000', timestamp: 1700000000000 },
        { symbol: 'BTCUSDT', sumOpenInterest: '10500', sumOpenInterestValue: '525000000', timestamp: 1700003600000 },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await service.getOpenInterest('BTCUSDT');

      expect(result).toHaveLength(2);
      expect(result[0]!.value).toBe(10000);
      expect(result[0]!.timestamp).toBe(1700000000000);
    });

    it('should return empty array on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await service.getOpenInterest('BTCUSDT');
      expect(result).toEqual([]);
    });
  });

  describe('getCurrentOpenInterest', () => {
    it('should fetch current open interest', async () => {
      const mockData = {
        symbol: 'BTCUSDT',
        openInterest: '15000',
        time: 1700000000000,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await service.getCurrentOpenInterest('BTCUSDT');

      expect(result).not.toBeNull();
      expect(result!.openInterest).toBe(15000);
      expect(result!.timestamp).toBe(1700000000000);
    });

    it('should return null on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await service.getCurrentOpenInterest('BTCUSDT');
      expect(result).toBeNull();
    });
  });

  describe('getLiquidations', () => {
    it('should fetch and group liquidation data', async () => {
      const mockData = [
        { symbol: 'BTCUSDT', price: '50000', origQty: '1', executedQty: '1', averagePrice: '50000', status: 'FILLED', timeInForce: 'IOC', type: 'LIMIT', side: 'SELL', time: 1700000000000 },
        { symbol: 'BTCUSDT', price: '50000', origQty: '0.5', executedQty: '0.5', averagePrice: '50000', status: 'FILLED', timeInForce: 'IOC', type: 'LIMIT', side: 'BUY', time: 1700000000000 },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await service.getLiquidations('BTCUSDT');

      expect(result).toHaveLength(1);
      expect(result[0]!.longLiquidations).toBe(50000);
      expect(result[0]!.shortLiquidations).toBe(25000);
      expect(result[0]!.totalLiquidations).toBe(75000);
    });

    it('should support time range filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await service.getLiquidations('BTCUSDT', 1700000000000, 1700007200000);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('startTime=1700000000000'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('endTime=1700007200000'),
        expect.any(Object)
      );
    });

    it('should return empty array on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await service.getLiquidations('BTCUSDT');
      expect(result).toEqual([]);
    });
  });

  describe('getLongShortRatio', () => {
    it('should fetch long/short ratio data', async () => {
      const mockData = [
        { longAccount: '0.55', shortAccount: '0.45', longShortRatio: '1.22', timestamp: 1700000000000 },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await service.getLongShortRatio('BTCUSDT');

      expect(result).toHaveLength(1);
      expect(result[0]!.longAccount).toBe(0.55);
      expect(result[0]!.shortAccount).toBe(0.45);
      expect(result[0]!.longShortRatio).toBe(1.22);
    });

    it('should support different periods', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await service.getLongShortRatio('BTCUSDT', '4h');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('period=4h'),
        expect.any(Object)
      );
    });

    it('should return empty array on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await service.getLongShortRatio('BTCUSDT');
      expect(result).toEqual([]);
    });
  });

  describe('getTopTraderLongShortRatio', () => {
    it('should fetch top trader ratio data', async () => {
      const mockData = [
        { longAccount: '0.60', shortAccount: '0.40', longShortRatio: '1.5', timestamp: 1700000000000 },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await service.getTopTraderLongShortRatio('BTCUSDT');

      expect(result).toHaveLength(1);
      expect(result[0]!.longAccount).toBe(0.60);
      expect(result[0]!.longShortRatio).toBe(1.5);
    });

    it('should return empty array on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await service.getTopTraderLongShortRatio('BTCUSDT');
      expect(result).toEqual([]);
    });
  });

  describe('getTakerBuySellVolume', () => {
    it('should fetch taker buy/sell volume data', async () => {
      const mockData = [
        { buySellRatio: '1.1', buyVol: '1100', sellVol: '1000', timestamp: 1700000000000 },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await service.getTakerBuySellVolume('BTCUSDT');

      expect(result).toHaveLength(1);
      expect(result[0]!.buySellRatio).toBe(1.1);
      expect(result[0]!.buyVol).toBe(1100);
      expect(result[0]!.sellVol).toBe(1000);
    });

    it('should return empty array on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await service.getTakerBuySellVolume('BTCUSDT');
      expect(result).toEqual([]);
    });
  });

  describe('getAllCryptoData', () => {
    it('should fetch all crypto data in parallel', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ symbol: 'BTCUSDT', fundingTime: 1700000000000, fundingRate: '0.0001', markPrice: '50000' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ symbol: 'BTCUSDT', sumOpenInterest: '10000', sumOpenInterestValue: '500000000', timestamp: 1700000000000 }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ longAccount: '0.55', shortAccount: '0.45', longShortRatio: '1.22', timestamp: 1700000000000 }]),
        });

      const result = await service.getAllCryptoData('BTCUSDT');

      expect(result.fundingRate).toHaveLength(1);
      expect(result.openInterest).toHaveLength(1);
      expect(result.liquidations).toHaveLength(0);
      expect(result.longShortRatio).toHaveLength(1);
    });
  });

  describe('getExchangeInfo', () => {
    it('should fetch and filter perpetual symbols', async () => {
      const mockData = {
        symbols: [
          {
            symbol: 'BTCUSDT',
            pair: 'BTCUSDT',
            baseAsset: 'BTC',
            quoteAsset: 'USDT',
            contractType: 'PERPETUAL',
            deliveryDate: 0,
            onboardDate: 1569398400000,
            status: 'TRADING',
            pricePrecision: 2,
            quantityPrecision: 3,
            baseAssetPrecision: 8,
            quotePrecision: 8,
            maintMarginPercent: '2.5000',
            requiredMarginPercent: '5.0000',
            underlyingType: 'COIN',
            underlyingSubType: ['PoW'],
          },
          {
            symbol: 'BTCUSDT_230929',
            pair: 'BTCUSDT',
            baseAsset: 'BTC',
            quoteAsset: 'USDT',
            contractType: 'CURRENT_QUARTER',
            deliveryDate: 1696060800000,
            onboardDate: 1569398400000,
            status: 'TRADING',
            pricePrecision: 2,
            quantityPrecision: 3,
            baseAssetPrecision: 8,
            quotePrecision: 8,
            maintMarginPercent: '2.5000',
            requiredMarginPercent: '5.0000',
            underlyingType: 'COIN',
            underlyingSubType: ['PoW'],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await service.getExchangeInfo();

      expect(result).toHaveLength(1);
      expect(result[0]!.symbol).toBe('BTCUSDT');
      expect(result[0]!.contractType).toBe('PERPETUAL');
      expect(result[0]!.maxLeverage).toBe(125);
    });

    it('should return empty array on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await service.getExchangeInfo();
      expect(result).toEqual([]);
    });
  });

  describe('getHistoricalFundingRates', () => {
    it('should fetch historical funding rates', async () => {
      const mockData = [
        { symbol: 'BTCUSDT', fundingTime: 1700000000000, fundingRate: '0.0001', markPrice: '50000' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await service.getHistoricalFundingRates('BTCUSDT');

      expect(result).toHaveLength(1);
      expect(result[0]!.rate).toBe(0.01);
    });

    it('should support time range filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await service.getHistoricalFundingRates('BTCUSDT', 1700000000000, 1700007200000, 500);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('startTime=1700000000000'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=500'),
        expect.any(Object)
      );
    });

    it('should return empty array on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await service.getHistoricalFundingRates('BTCUSDT');
      expect(result).toEqual([]);
    });
  });

  describe('getFuturesKlines', () => {
    it('should fetch futures klines', async () => {
      const mockData = [
        [1700000000000, '50000', '50500', '49500', '50200', '1000', 1700003599999, '50200000', 5000, '500', '25100000'],
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await service.getFuturesKlines('BTCUSDT', '1h');

      expect(result).toHaveLength(1);
      expect(result[0]!.openTime).toBe(1700000000000);
      expect(result[0]!.open).toBe(50000);
      expect(result[0]!.high).toBe(50500);
      expect(result[0]!.low).toBe(49500);
      expect(result[0]!.close).toBe(50200);
      expect(result[0]!.volume).toBe(1000);
      expect(result[0]!.trades).toBe(5000);
    });

    it('should return empty array on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await service.getFuturesKlines('BTCUSDT', '1h');
      expect(result).toEqual([]);
    });
  });

  describe('getMarkPrice', () => {
    it('should fetch mark price', async () => {
      const mockData = {
        symbol: 'BTCUSDT',
        markPrice: '50100',
        indexPrice: '50000',
        estimatedSettlePrice: '50050',
        lastFundingRate: '0.0001',
        nextFundingTime: 1700007200000,
        interestRate: '0.0001',
        time: 1700000000000,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await service.getMarkPrice('BTCUSDT');

      expect(result).not.toBeNull();
      expect(result!.symbol).toBe('BTCUSDT');
      expect(result!.markPrice).toBe(50100);
      expect(result!.indexPrice).toBe(50000);
      expect(result!.lastFundingRate).toBe(0.01);
      expect(result!.interestRate).toBe(0.01);
    });

    it('should return null on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await service.getMarkPrice('BTCUSDT');
      expect(result).toBeNull();
    });
  });

  describe('getAllMarkPrices', () => {
    it('should fetch all mark prices', async () => {
      const mockData = [
        { symbol: 'BTCUSDT', markPrice: '50100', indexPrice: '50000', lastFundingRate: '0.0001', nextFundingTime: 1700007200000, time: 1700000000000 },
        { symbol: 'ETHUSDT', markPrice: '2500', indexPrice: '2495', lastFundingRate: '0.00015', nextFundingTime: 1700007200000, time: 1700000000000 },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await service.getAllMarkPrices();

      expect(result).toHaveLength(2);
      expect(result[0]!.symbol).toBe('BTCUSDT');
      expect(result[1]!.symbol).toBe('ETHUSDT');
    });

    it('should return empty array on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await service.getAllMarkPrices();
      expect(result).toEqual([]);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      const mockData = [{ symbol: 'BTCUSDT', fundingTime: 1700000000000, fundingRate: '0.0001', markPrice: '50000' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      await service.getFundingRate('BTCUSDT');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      service.clearCache();
      await service.getFundingRate('BTCUSDT');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should respect custom cache TTL', async () => {
      service.setCacheTTL(0);

      const mockData = [{ symbol: 'BTCUSDT', fundingTime: 1700000000000, fundingRate: '0.0001', markPrice: '50000' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      await service.getFundingRate('BTCUSDT');
      await service.getFundingRate('BTCUSDT');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getBinanceFuturesDataService', () => {
    it('should return singleton instance', () => {
      const instance1 = getBinanceFuturesDataService();
      const instance2 = getBinanceFuturesDataService();

      expect(instance1).toBe(instance2);
    });
  });
});
