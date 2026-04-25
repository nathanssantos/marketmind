import {
  calculateFundingRate,
  calculateLiquidations,
  calculateOpenInterest,
  calculateRelativeStrength,
  detectFundingRateSignal,
  type FundingRateData,
  type LiquidationData,
  type OpenInterestData,
} from '../../lib/indicators';

import { getBinanceFuturesDataService } from '../binance-futures-data';
import { getBTCDominanceDataService } from '../btc-dominance-data';

import type { CryptoData, CryptoHandlerMap } from './types';
import { MAX_CRYPTO_CACHE_SIZE, toNumber } from './types';

export const createCryptoIndicatorHandlers = (): CryptoHandlerMap => ({
  fundingRate: (klines, resolvedParams, cryptoData) => {
    if (cryptoData.fundingRate.length === 0) {
      return { type: 'fundingRate', values: new Array(klines.length).fill(null) };
    }

    const result = calculateFundingRate(cryptoData.fundingRate, {
      extremeThreshold: toNumber(resolvedParams['extremeThreshold'], 0.1),
      averagePeriod: toNumber(resolvedParams['averagePeriod'], 7),
    });

    const signalResult = detectFundingRateSignal(cryptoData.fundingRate, {
      extremeThreshold: toNumber(resolvedParams['extremeThreshold'], 0.1),
    });

    const values: (number | null)[] = new Array(klines.length).fill(null);
    if (result.current !== null) {
      values[klines.length - 1] = result.current;
    }

    return {
      type: 'fundingRate',
      values: {
        current: values,
        signal: new Array(klines.length).fill(signalResult.signal === 'long' ? 1 : signalResult.signal === 'short' ? -1 : 0),
      },
    };
  },

  openInterest: (klines, resolvedParams, cryptoData) => {
    if (cryptoData.openInterest.length === 0) {
      return { type: 'openInterest', values: new Array(klines.length).fill(null) };
    }

    const closes = klines.map((k) => parseFloat(k.close));
    const priceChanges: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      const prev = closes[i - 1];
      const curr = closes[i];
      if (prev !== undefined && curr !== undefined && prev !== 0) {
        priceChanges.push(((curr - prev) / prev) * 100);
      } else {
        priceChanges.push(0);
      }
    }

    const result = calculateOpenInterest(cryptoData.openInterest, priceChanges, {
      lookback: toNumber(resolvedParams['lookback'], 10),
      changeThreshold: toNumber(resolvedParams['changeThreshold'], 5),
      trendPeriod: toNumber(resolvedParams['trendPeriod'], 5),
    });

    const values: (number | null)[] = new Array(klines.length).fill(null);
    if (result.current !== null) {
      values[klines.length - 1] = result.current;
    }

    return {
      type: 'openInterest',
      values: {
        current: values,
        trend: new Array(klines.length).fill(result.trend === 'increasing' ? 1 : result.trend === 'decreasing' ? -1 : 0),
        divergence: new Array(klines.length).fill(result.divergence === 'bullish' ? 1 : result.divergence === 'bearish' ? -1 : 0),
      },
    };
  },

  liquidations: (klines, resolvedParams, cryptoData) => {
    if (cryptoData.liquidations.length === 0) {
      return { type: 'liquidations', values: new Array(klines.length).fill(null) };
    }

    const result = calculateLiquidations(cryptoData.liquidations, {
      cascadeThreshold: toNumber(resolvedParams['cascadeThreshold'], 1000000),
      lookbackPeriods: toNumber(resolvedParams['lookbackPeriods'], 6),
      imbalanceThreshold: toNumber(resolvedParams['imbalanceThreshold'], 0.7),
    });

    const values: (number | null)[] = new Array(klines.length).fill(null);
    values[klines.length - 1] = result.longLiquidations - result.shortLiquidations;

    return {
      type: 'liquidations',
      values: {
        delta: values,
        cascade: new Array(klines.length).fill(result.isCascade ? 1 : 0),
        dominantSide: new Array(klines.length).fill(result.dominantSide === 'long' ? 1 : result.dominantSide === 'short' ? -1 : 0),
      },
    };
  },

  relativeStrength: (klines, _resolvedParams, cryptoData) => {
    const closes = klines.map((k) => parseFloat(k.close));
    const baseAssetCloses = cryptoData.baseAssetCloses ?? closes;
    const result = calculateRelativeStrength(closes, baseAssetCloses);

    const values: (number | null)[] = new Array(klines.length).fill(null);
    if (result.ratio !== null) {
      values[klines.length - 1] = result.ratio;
    }

    return {
      type: 'relativeStrength',
      values: {
        ratio: values,
        outperforming: new Array(klines.length).fill(result.outperforming ? 1 : 0),
        strength: new Array(klines.length).fill(result.strength === 'strong' ? 2 : result.strength === 'moderate' ? 1 : result.strength === 'weak' ? 0 : -1),
      },
    };
  },

  btcDominance: (klines, _resolvedParams, cryptoData) => {
    const values: (number | null)[] = new Array(klines.length).fill(null);
    if (cryptoData.btcDominance !== undefined && cryptoData.btcDominance !== null) {
      values[klines.length - 1] = cryptoData.btcDominance;
    }

    return {
      type: 'btcDominance',
      values: { current: values },
    };
  },
});

export const fetchCryptoData = async (
  cryptoDataCache: Map<string, { data: CryptoData; timestamp: number }>,
  cryptoDataCacheTTL: number,
  symbol: string,
  needsBtcDominance: boolean = false,
): Promise<CryptoData> => {
  const cacheKey = `crypto:${symbol}:${needsBtcDominance}`;
  const cached = cryptoDataCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < cryptoDataCacheTTL) {
    return cached.data;
  }

  const service = getBinanceFuturesDataService();
  const promises: Promise<unknown>[] = [
    service.getFundingRate(symbol),
    service.getOpenInterest(symbol),
    service.getLiquidations(symbol),
  ];

  if (needsBtcDominance) {
    const btcDominanceService = getBTCDominanceDataService();
    promises.push(btcDominanceService.getBTCDominance());
  }

  const results = await Promise.all(promises);
  const [fundingRate, openInterest, liquidations] = results as [FundingRateData[], OpenInterestData[], LiquidationData[]];

  const data: CryptoData = { fundingRate, openInterest, liquidations };

  if (needsBtcDominance && results[3]) {
    const btcDomData = results[3] as { btcDominance: number } | null;
    data.btcDominance = btcDomData?.btcDominance ?? null;
  }

  if (cryptoDataCache.size >= MAX_CRYPTO_CACHE_SIZE) {
    const firstKey = cryptoDataCache.keys().next().value;
    if (firstKey) cryptoDataCache.delete(firstKey);
  }
  cryptoDataCache.set(cacheKey, { data, timestamp: Date.now() });

  return data;
};
