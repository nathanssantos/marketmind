/* eslint-disable complexity */

import type {
  ComputedIndicator,
  ComputedIndicators, IndicatorDefinition,
  IndicatorType, Kline
} from '@marketmind/types';

import {
  calculateFundingRate,
  calculateLiquidations,
  calculateOpenInterest,
  calculateRelativeStrength,
  detectFundingRateSignal,
  type FundingRateData,
  type LiquidationData,
  type OpenInterestData,
} from '@marketmind/indicators';

import { getBinanceFuturesDataService } from '../../binance-futures-data';
import { getBTCDominanceDataService } from '../../btc-dominance-data';

import {
  calculateADX,
  calculateAO,
  calculateAroon,
  calculateATR,
  calculateBollingerBandsArray,
  calculateCCI,
  calculateCMF,
  calculateCMO,
  calculateCumulativeRSI,
  calculateDeltaVolume,
  calculateDEMA,
  calculateDMI,
  calculateDonchian,
  calculateElderRay,
  calculateEMA,
  calculateFibonacciRetracement,
  calculateFloorPivotSeries,
  calculateFVG,
  calculateGaps,
  calculateHalvingCycle,
  calculateHMA,
  calculateIBS,
  calculateIchimoku,
  calculateKeltner,
  calculateKlinger,
  calculateLiquidityLevels,
  calculateMACD,
  calculateMassIndex,
  calculateMFI,
  calculateNDayHighLow,
  calculateNR7,
  calculateOBV,
  calculateParabolicSAR,
  calculatePercentBSeries,
  calculatePPO,
  calculateROC,
  calculateRSI,
  calculateSMA,
  calculateStochastic,
  calculateStochRSI,
  calculateSupertrend,
  calculateSwingPoints,
  calculateTEMA,
  calculateTSI,
  calculateUltimateOscillator,
  calculateVortex,
  calculateVWAP,
  calculateWilliamsR,
  calculateWMA,
  findPivotPoints,
} from '@marketmind/indicators';

interface CryptoData {
  fundingRate: FundingRateData[];
  openInterest: OpenInterestData[];
  liquidations: LiquidationData[];
  baseAssetCloses?: number[];
  btcDominance?: number | null;
}

const toNumber = (value: string | number | undefined, defaultValue: number): number => {
  if (value === undefined) return defaultValue;
  return typeof value === 'string' ? parseFloat(value) : value;
};

const MAX_CACHE_SIZE = 100;
const MAX_CRYPTO_CACHE_SIZE = 50;

export class IndicatorEngine {
  private cache: Map<string, ComputedIndicators> = new Map();
  private cryptoDataCache: Map<string, { data: CryptoData; timestamp: number }> = new Map();
  private cryptoDataCacheTTL: number = 60000;

  computeIndicators(
    klines: Kline[],
    indicators: Record<string, IndicatorDefinition>,
    params: Record<string, number>
  ): ComputedIndicators {
    const cacheKey = this.generateCacheKey(klines, indicators, params);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const result: ComputedIndicators = {};

    for (const [id, definition] of Object.entries(indicators)) {
      result[id] = this.computeIndicator(klines, definition, params);
    }

    result['_price'] = {
      type: 'sma' as IndicatorType, // placeholder type
      values: {
        open: klines.map((k) => parseFloat(k.open)),
        high: klines.map((k) => parseFloat(k.high)),
        low: klines.map((k) => parseFloat(k.low)),
        close: klines.map((k) => parseFloat(k.close)),
        volume: klines.map((k) => parseFloat(k.volume)),
      },
    };

    const volumeSma20 = this.calculateVolumeSMA(klines, 20);
    result['volume'] = {
      type: 'sma' as IndicatorType,
      values: {
        current: klines.map((k) => parseFloat(k.volume)),
        sma20: volumeSma20,
      },
    };

    if (!result['adx']) {
      const adxResult = calculateADX(klines, 14);
      result['adx'] = {
        type: 'adx' as IndicatorType,
        values: {
          adx: adxResult.adx,
          plusDI: adxResult.plusDI,
          minusDI: adxResult.minusDI,
        },
      };
    }

    if (!result['atr']) {
      const atrResult = calculateATR(klines, 14);
      result['atr'] = {
        type: 'atr' as IndicatorType,
        values: atrResult,
      };
    }

    if (this.cache.size >= MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(cacheKey, result);
    return result;
  }

  async computeIndicatorsWithCryptoData(
    klines: Kline[],
    indicators: Record<string, IndicatorDefinition>,
    params: Record<string, number>,
    symbol: string,
    baseAssetSymbol?: string
  ): Promise<ComputedIndicators> {
    const result = this.computeIndicators(klines, indicators, params);

    const hasCryptoIndicators = Object.values(indicators).some(
      (def) => ['fundingRate', 'openInterest', 'liquidations', 'relativeStrength', 'btcDominance'].includes(def.type)
    );

    if (!hasCryptoIndicators) return result;

    const cryptoData = await this.fetchCryptoData(symbol, Object.values(indicators).some((def) => def.type === 'btcDominance'));

    for (const [id, definition] of Object.entries(indicators)) {
      const computed = this.computeCryptoIndicator(klines, definition, params, cryptoData, baseAssetSymbol);
      if (computed) {
        result[id] = computed;
      }
    }

    return result;
  }

  private async fetchCryptoData(symbol: string, needsBtcDominance: boolean = false): Promise<CryptoData> {
    const cacheKey = `crypto:${symbol}:${needsBtcDominance}`;
    const cached = this.cryptoDataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cryptoDataCacheTTL) {
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

    if (this.cryptoDataCache.size >= MAX_CRYPTO_CACHE_SIZE) {
      const firstKey = this.cryptoDataCache.keys().next().value;
      if (firstKey) this.cryptoDataCache.delete(firstKey);
    }
    this.cryptoDataCache.set(cacheKey, { data, timestamp: Date.now() });

    return data;
  }

  private readonly cryptoIndicatorHandlers: Partial<Record<
    IndicatorType,
    (klines: Kline[], resolvedParams: Record<string, number | string>, cryptoData: CryptoData) => ComputedIndicator | null
  >> = {
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
      const baseAssetCloses = cryptoData.baseAssetCloses || closes;
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
        values: {
          current: values,
        },
      };
    },
  };

  private computeCryptoIndicator(
    klines: Kline[],
    definition: IndicatorDefinition,
    params: Record<string, number>,
    cryptoData: CryptoData,
    _baseAssetSymbol?: string
  ): ComputedIndicator | null {
    const resolvedParams = this.resolveParams(definition.params, params);
    const handler = this.cryptoIndicatorHandlers[definition.type];
    return handler ? handler(klines, resolvedParams, cryptoData) : null;
  }

  private readonly indicatorComputeHandlers: Record<
    IndicatorType,
    (klines: Kline[], resolvedParams: Record<string, number | string>) => ComputedIndicator
  > = {
    sma: (klines, resolvedParams) => ({
      type: 'sma',
      values: calculateSMA(klines, toNumber(resolvedParams['period'], 20)),
    }),

    ema: (klines, resolvedParams) => ({
      type: 'ema',
      values: calculateEMA(klines, toNumber(resolvedParams['period'], 20)),
    }),

    rsi: (klines, resolvedParams) => {
      const rsiResult = calculateRSI(klines, toNumber(resolvedParams['period'], 14));
      return { type: 'rsi', values: rsiResult.values };
    },

    macd: (klines, resolvedParams) => {
      const macdResult = calculateMACD(
        klines,
        toNumber(resolvedParams['fastPeriod'], 12),
        toNumber(resolvedParams['slowPeriod'], 26),
        toNumber(resolvedParams['signalPeriod'], 9)
      );
      return {
        type: 'macd',
        values: {
          macd: macdResult.macd,
          signal: macdResult.signal,
          histogram: macdResult.histogram,
        },
      };
    },

    bollingerBands: (klines, resolvedParams) => {
      const bbResult = calculateBollingerBandsArray(
        klines,
        toNumber(resolvedParams['period'], 20),
        toNumber(resolvedParams['stdDev'], 2)
      );
      return {
        type: 'bollingerBands',
        values: {
          upper: bbResult.map((b) => b?.upper ?? null),
          middle: bbResult.map((b) => b?.middle ?? null),
          lower: bbResult.map((b) => b?.lower ?? null),
        },
      };
    },

    atr: (klines, resolvedParams) => {
      const atrResult = calculateATR(klines, toNumber(resolvedParams['period'], 14));
      return {
        type: 'atr',
        values: atrResult.map((v) => (isNaN(v) ? null : v)),
      };
    },

    stochastic: (klines, resolvedParams) => {
      const stochResult = calculateStochastic(
        klines,
        toNumber(resolvedParams['kPeriod'], 14),
        toNumber(resolvedParams['kSmoothing'], 3),
        toNumber(resolvedParams['dPeriod'], 3)
      );
      return {
        type: 'stochastic',
        values: {
          k: stochResult.k,
          d: stochResult.d,
        },
      };
    },

    stochRsi: (klines, resolvedParams) => {
      const stochRsiResult = calculateStochRSI(
        klines,
        toNumber(resolvedParams['rsiPeriod'], 14),
        toNumber(resolvedParams['stochPeriod'], 14),
        toNumber(resolvedParams['kSmooth'], 3),
        toNumber(resolvedParams['dSmooth'], 3)
      );
      return {
        type: 'stochRsi',
        values: {
          k: stochRsiResult.k,
          d: stochRsiResult.d,
        },
      };
    },

    ichimoku: (klines, resolvedParams) => {
      const ichimokuResult = calculateIchimoku(
        klines,
        toNumber(resolvedParams['tenkanPeriod'], 9),
        toNumber(resolvedParams['kijunPeriod'], 26),
        toNumber(resolvedParams['senkouBPeriod'], 52),
        toNumber(resolvedParams['displacement'], 26)
      );
      return {
        type: 'ichimoku',
        values: {
          tenkan: ichimokuResult.tenkan,
          kijun: ichimokuResult.kijun,
          senkouA: ichimokuResult.senkouA,
          senkouB: ichimokuResult.senkouB,
          chikou: ichimokuResult.chikou,
        },
      };
    },

    halvingCycle: (klines) => {
      const halvingResult = calculateHalvingCycle(klines);
      return {
        type: 'halvingCycle',
        values: {
          phase: halvingResult.phase as unknown as (number | null)[],
          daysFromHalving: halvingResult.daysFromHalving,
          cycleProgress: halvingResult.cycleProgress,
        },
      };
    },

    vwap: (klines) => {
      const vwapResult = calculateVWAP(klines);
      return { type: 'vwap', values: vwapResult };
    },

    pivotPoints: (klines, resolvedParams) => {
      const pivots = findPivotPoints(klines, toNumber(resolvedParams['lookback'], 5));
      const pivotValues: (number | null)[] = new Array(klines.length).fill(null);
      for (const pivot of pivots) {
        if (pivot.index >= 0 && pivot.index < pivotValues.length) {
          pivotValues[pivot.index] = pivot.price;
        }
      }
      return { type: 'pivotPoints', values: pivotValues };
    },

    adx: (klines, resolvedParams) => {
      const adxResult = calculateADX(klines, toNumber(resolvedParams['period'], 14));
      return {
        type: 'adx',
        values: {
          adx: adxResult.adx,
          plusDI: adxResult.plusDI,
          minusDI: adxResult.minusDI,
        },
      };
    },

    obv: (klines, resolvedParams) => {
      const smaPeriod = resolvedParams['smaPeriod'];
      const obvResult = calculateOBV(klines, typeof smaPeriod === 'number' ? smaPeriod : undefined);
      return {
        type: 'obv',
        values: {
          obv: obvResult.values,
          sma: obvResult.sma,
        },
      };
    },

    williamsR: (klines, resolvedParams) => {
      const williamsResult = calculateWilliamsR(klines, toNumber(resolvedParams['period'], 14));
      return { type: 'williamsR', values: williamsResult };
    },

    cci: (klines, resolvedParams) => {
      const cciResult = calculateCCI(klines, toNumber(resolvedParams['period'], 20));
      return { type: 'cci', values: cciResult };
    },

    mfi: (klines, resolvedParams) => {
      const mfiResult = calculateMFI(klines, toNumber(resolvedParams['period'], 14));
      return { type: 'mfi', values: mfiResult };
    },

    donchian: (klines, resolvedParams) => {
      const donchianResult = calculateDonchian(klines, toNumber(resolvedParams['period'], 20));
      return {
        type: 'donchian',
        values: {
          upper: donchianResult.upper,
          middle: donchianResult.middle,
          lower: donchianResult.lower,
        },
      };
    },

    keltner: (klines, resolvedParams) => {
      const keltnerResult = calculateKeltner(
        klines,
        toNumber(resolvedParams['emaPeriod'], 20),
        toNumber(resolvedParams['atrPeriod'], 10),
        toNumber(resolvedParams['multiplier'], 2)
      );
      return {
        type: 'keltner',
        values: {
          upper: keltnerResult.upper,
          middle: keltnerResult.middle,
          lower: keltnerResult.lower,
        },
      };
    },

    supertrend: (klines, resolvedParams) => {
      const supertrendResult = calculateSupertrend(
        klines,
        toNumber(resolvedParams['period'], 10),
        toNumber(resolvedParams['multiplier'], 3)
      );
      return {
        type: 'supertrend',
        values: {
          trend: supertrendResult.trend.map((t) => (t === 'up' ? 1 : t === 'down' ? -1 : null)),
          value: supertrendResult.value,
        },
      };
    },

    ibs: (klines) => {
      const ibsResult = calculateIBS(klines);
      return { type: 'ibs', values: ibsResult.values };
    },

    percentB: (klines, resolvedParams) => {
      const percentBResult = calculatePercentBSeries(
        klines,
        toNumber(resolvedParams['period'], 20),
        toNumber(resolvedParams['stdDev'], 2)
      );
      return { type: 'percentB', values: percentBResult.values };
    },

    cumulativeRsi: (klines, resolvedParams) => {
      const cumulativeRsiResult = calculateCumulativeRSI(
        klines,
        toNumber(resolvedParams['rsiPeriod'], 2),
        toNumber(resolvedParams['sumPeriod'], 2)
      );
      return {
        type: 'cumulativeRsi',
        values: {
          cumulative: cumulativeRsiResult.values,
          rsi: cumulativeRsiResult.rsiValues,
        },
      };
    },

    nDayHighLow: (klines, resolvedParams) => {
      const nDayResult = calculateNDayHighLow(klines, toNumber(resolvedParams['period'], 7));
      return {
        type: 'nDayHighLow',
        values: {
          isNDayHigh: nDayResult.isNDayHigh.map((v) => (v ? 1 : 0)),
          isNDayLow: nDayResult.isNDayLow.map((v) => (v ? 1 : 0)),
          highestClose: nDayResult.highestClose,
          lowestClose: nDayResult.lowestClose,
        },
      };
    },

    nr7: (klines, resolvedParams) => {
      const nr7Result = calculateNR7(klines, toNumber(resolvedParams['lookback'], 7));
      return {
        type: 'nr7',
        values: nr7Result.isNR7.map((v) => (v ? 1 : 0)),
      };
    },

    roc: (klines, resolvedParams) => {
      const rocResult = calculateROC(klines, toNumber(resolvedParams['period'], 12));
      return { type: 'roc', values: rocResult.values };
    },

    dema: (klines, resolvedParams) => {
      const demaResult = calculateDEMA(klines, toNumber(resolvedParams['period'], 20));
      return { type: 'dema', values: demaResult.values };
    },

    tema: (klines, resolvedParams) => {
      const temaResult = calculateTEMA(klines, toNumber(resolvedParams['period'], 20));
      return { type: 'tema', values: temaResult.values };
    },

    wma: (klines, resolvedParams) => {
      const wmaResult = calculateWMA(klines, toNumber(resolvedParams['period'], 20));
      return { type: 'wma', values: wmaResult.values };
    },

    hma: (klines, resolvedParams) => {
      const hmaResult = calculateHMA(klines, toNumber(resolvedParams['period'], 20));
      return { type: 'hma', values: hmaResult.values };
    },

    cmo: (klines, resolvedParams) => {
      const cmoResult = calculateCMO(klines, toNumber(resolvedParams['period'], 14));
      return { type: 'cmo', values: cmoResult.values };
    },

    ao: (klines, resolvedParams) => {
      const aoResult = calculateAO(klines, toNumber(resolvedParams['fastPeriod'], 5), toNumber(resolvedParams['slowPeriod'], 34));
      return { type: 'ao', values: aoResult.values };
    },

    ppo: (klines, resolvedParams) => {
      const ppoResult = calculatePPO(klines, toNumber(resolvedParams['fastPeriod'], 12), toNumber(resolvedParams['slowPeriod'], 26), toNumber(resolvedParams['signalPeriod'], 9));
      return {
        type: 'ppo',
        values: {
          ppo: ppoResult.ppo,
          signal: ppoResult.signal,
          histogram: ppoResult.histogram,
        },
      };
    },

    tsi: (klines, resolvedParams) => {
      const tsiResult = calculateTSI(klines, toNumber(resolvedParams['longPeriod'], 25), toNumber(resolvedParams['shortPeriod'], 13), toNumber(resolvedParams['signalPeriod'], 13));
      return {
        type: 'tsi',
        values: {
          tsi: tsiResult.tsi,
          signal: tsiResult.signal,
        },
      };
    },

    ultimateOscillator: (klines, resolvedParams) => {
      const uoResult = calculateUltimateOscillator(klines, toNumber(resolvedParams['period1'], 7), toNumber(resolvedParams['period2'], 14), toNumber(resolvedParams['period3'], 28));
      return { type: 'ultimateOscillator', values: uoResult.values };
    },

    aroon: (klines, resolvedParams) => {
      const aroonResult = calculateAroon(klines, toNumber(resolvedParams['period'], 25));
      return {
        type: 'aroon',
        values: {
          up: aroonResult.aroonUp,
          down: aroonResult.aroonDown,
          oscillator: aroonResult.oscillator,
        },
      };
    },

    dmi: (klines, resolvedParams) => {
      const dmiResult = calculateDMI(klines, toNumber(resolvedParams['period'], 14));
      return {
        type: 'dmi',
        values: {
          plusDI: dmiResult.plusDI,
          minusDI: dmiResult.minusDI,
          dx: dmiResult.dx,
        },
      };
    },

    vortex: (klines, resolvedParams) => {
      const vortexResult = calculateVortex(klines, toNumber(resolvedParams['period'], 14));
      return {
        type: 'vortex',
        values: {
          viPlus: vortexResult.viPlus,
          viMinus: vortexResult.viMinus,
        },
      };
    },

    parabolicSar: (klines, resolvedParams) => {
      const psarResult = calculateParabolicSAR(klines, toNumber(resolvedParams['step'], 0.02), toNumber(resolvedParams['max'], 0.2));
      return {
        type: 'parabolicSar',
        values: {
          sar: psarResult.sar,
          trend: psarResult.trend.map((t) => (t === 'up' ? 1 : -1)),
        },
      };
    },

    massIndex: (klines, resolvedParams) => {
      const massResult = calculateMassIndex(klines, toNumber(resolvedParams['emaPeriod'], 9), toNumber(resolvedParams['sumPeriod'], 25));
      return { type: 'massIndex', values: massResult.values };
    },

    cmf: (klines, resolvedParams) => {
      const cmfResult = calculateCMF(klines, toNumber(resolvedParams['period'], 20));
      return { type: 'cmf', values: cmfResult.values };
    },

    klinger: (klines, resolvedParams) => {
      const klingerResult = calculateKlinger(klines, toNumber(resolvedParams['shortPeriod'], 34), toNumber(resolvedParams['longPeriod'], 55), toNumber(resolvedParams['signalPeriod'], 13));
      return {
        type: 'klinger',
        values: {
          kvo: klingerResult.kvo,
          signal: klingerResult.signal,
        },
      };
    },

    elderRay: (klines, resolvedParams) => {
      const elderResult = calculateElderRay(klines, toNumber(resolvedParams['period'], 13));
      return {
        type: 'elderRay',
        values: {
          bullPower: elderResult.bullPower,
          bearPower: elderResult.bearPower,
        },
      };
    },

    deltaVolume: (klines) => {
      const deltaResult = calculateDeltaVolume(klines);
      return {
        type: 'deltaVolume',
        values: {
          delta: deltaResult.delta,
          cumulative: deltaResult.cumulativeDelta,
        },
      };
    },

    swingPoints: (klines, resolvedParams) => {
      const swingResult = calculateSwingPoints(klines, toNumber(resolvedParams['lookback'], 5));
      return {
        type: 'swingPoints',
        values: {
          high: swingResult.swingHighs,
          low: swingResult.swingLows,
        },
      };
    },

    fvg: (klines) => {
      const fvgResult = calculateFVG(klines);
      const bullishValues: (number | null)[] = new Array(klines.length).fill(null);
      const bearishValues: (number | null)[] = new Array(klines.length).fill(null);
      for (const gap of fvgResult.gaps) {
        if (gap.index >= 0 && gap.index < klines.length) {
          if (gap.type === 'bullish') {
            bullishValues[gap.index] = 1;
          } else {
            bearishValues[gap.index] = 1;
          }
        }
      }
      return {
        type: 'fvg',
        values: {
          bullish: bullishValues,
          bearish: bearishValues,
        },
      };
    },

    gapDetection: (klines, resolvedParams) => {
      const gapsResult = calculateGaps(klines, toNumber(resolvedParams['threshold'], 0.5));
      const gapValues: (number | null)[] = new Array(klines.length).fill(null);
      for (const gap of gapsResult.gaps) {
        if (gap.index >= 0 && gap.index < gapValues.length) {
          gapValues[gap.index] = gap.type === 'up' ? 1 : -1;
        }
      }
      return { type: 'gapDetection', values: gapValues };
    },

    fibonacci: (klines) => {
      const highs = klines.map((k) => parseFloat(k.high));
      const lows = klines.map((k) => parseFloat(k.low));
      const highPrice = Math.max(...highs.filter((h) => !isNaN(h)));
      const lowPrice = Math.min(...lows.filter((l) => !isNaN(l)));
      const fibLevels = calculateFibonacciRetracement(highPrice, lowPrice);
      const getLevel = (targetLevel: number) => fibLevels.find((l) => l.level === targetLevel)?.price ?? null;
      return {
        type: 'fibonacci',
        values: {
          level236: Array(klines.length).fill(getLevel(0.236)),
          level382: Array(klines.length).fill(getLevel(0.382)),
          level500: Array(klines.length).fill(getLevel(0.5)),
          level618: Array(klines.length).fill(getLevel(0.618)),
          level786: Array(klines.length).fill(getLevel(0.786)),
        },
      };
    },

    floorPivots: (klines, resolvedParams) => {
      const highs = klines.map((k) => parseFloat(k.high));
      const lows = klines.map((k) => parseFloat(k.low));
      const closes = klines.map((k) => parseFloat(k.close));
      const pivotTypeParam = resolvedParams['pivotType'];
      const validTypes = ['standard', 'fibonacci', 'woodie', 'camarilla', 'demark'] as const;
      const pivotType = typeof pivotTypeParam === 'string' && validTypes.includes(pivotTypeParam as typeof validTypes[number])
        ? (pivotTypeParam as typeof validTypes[number])
        : 'standard';
      const floorResult = calculateFloorPivotSeries(highs, lows, closes, undefined, pivotType);
      return {
        type: 'floorPivots',
        values: {
          pivot: floorResult.pivot,
          r1: floorResult.r1,
          r2: floorResult.r2,
          r3: floorResult.r3,
          s1: floorResult.s1,
          s2: floorResult.s2,
          s3: floorResult.s3,
        },
      };
    },

    liquidityLevels: (klines, resolvedParams) => {
      const highs = klines.map((k) => parseFloat(k.high));
      const lows = klines.map((k) => parseFloat(k.low));
      const closes = klines.map((k) => parseFloat(k.close));
      const liquidityResult = calculateLiquidityLevels(highs, lows, closes, {
        lookback: toNumber(resolvedParams['lookback'], 50),
        minTouches: toNumber(resolvedParams['minTouches'], 2),
      });
      const supportValues: (number | null)[] = new Array(klines.length).fill(null);
      const resistanceValues: (number | null)[] = new Array(klines.length).fill(null);
      for (const level of liquidityResult) {
        if (level.lastIndex >= 0 && level.lastIndex < klines.length) {
          if (level.type === 'support') {
            supportValues[level.lastIndex] = level.price;
          } else {
            resistanceValues[level.lastIndex] = level.price;
          }
        }
      }
      return {
        type: 'liquidityLevels',
        values: {
          support: supportValues,
          resistance: resistanceValues,
        },
      };
    },

    fundingRate: (klines) => ({
      type: 'fundingRate',
      values: new Array(klines.length).fill(null),
    }),

    openInterest: (klines) => ({
      type: 'openInterest',
      values: new Array(klines.length).fill(null),
    }),

    liquidations: (klines) => ({
      type: 'liquidations',
      values: new Array(klines.length).fill(null),
    }),

    btcDominance: (klines) => ({
      type: 'btcDominance',
      values: new Array(klines.length).fill(null),
    }),

    relativeStrength: (klines) => ({
      type: 'relativeStrength',
      values: new Array(klines.length).fill(null),
    }),

    highest: (klines, resolvedParams) => {
      const period = toNumber(resolvedParams['period'], 20);
      const sourceParam = resolvedParams['source'];
      const source = typeof sourceParam === 'string' ? sourceParam : 'high';
      const values = this.calculateHighest(klines, period, source);
      return { type: 'highest', values };
    },

    lowest: (klines, resolvedParams) => {
      const period = toNumber(resolvedParams['period'], 20);
      const sourceParam = resolvedParams['source'];
      const source = typeof sourceParam === 'string' ? sourceParam : 'low';
      const values = this.calculateLowest(klines, period, source);
      return { type: 'lowest', values };
    },
  };

  private computeIndicator(
    klines: Kline[],
    definition: IndicatorDefinition,
    params: Record<string, number>
  ): ComputedIndicator {
    const resolvedParams = this.resolveParams(definition.params, params);
    const handler = this.indicatorComputeHandlers[definition.type];

    if (!handler) {
      throw new Error(`Unknown indicator type: ${definition.type}`);
    }

    return handler(klines, resolvedParams);
  }

  private resolveParams(
    indicatorParams: Record<string, number | string>,
    strategyParams: Record<string, number>
  ): Record<string, number | string> {
    const resolved: Record<string, number | string> = {};

    for (const [key, value] of Object.entries(indicatorParams)) {
      if (typeof value === 'string' && value.startsWith('$')) {
        const paramName = value.slice(1);
        const paramValue = strategyParams[paramName];
        if (paramValue === undefined) {
          throw new Error(`Unknown parameter reference: ${value}`);
        }
        resolved[key] = paramValue;
      } else if (typeof value === 'number' || typeof value === 'string') {
        resolved[key] = value;
      } else {
        throw new Error(`Invalid parameter value: ${value}`);
      }
    }

    return resolved;
  }

  private parseReference(reference: string): { base: string; subKey: string | null; offset: number } {
    const parts = reference.split('.');
    const base = parts[0] ?? '';
    let subKey: string | null = null;
    let offset = 0;

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      if (part === 'prev') {
        offset = 1;
      } else if (part.startsWith('prev')) {
        const num = parseInt(part.slice(4), 10);
        offset = isNaN(num) ? 1 : num;
      } else if (!subKey) {
        subKey = part;
      }
    }

    return { base, subKey, offset };
  }

  resolveIndicatorValue(
    indicators: ComputedIndicators,
    reference: string,
    index: number
  ): number | null {
    const { base, subKey, offset } = this.parseReference(reference);
    const effectiveIndex = index - offset;

    if (effectiveIndex < 0) return null;

    if (base === 'volume' && subKey) {
      const volumeIndicator = indicators['volume'];
      if (!volumeIndicator) return null;
      const values = volumeIndicator.values as Record<string, (number | null)[]>;
      return values[subKey]?.[effectiveIndex] ?? null;
    }

    if (['open', 'high', 'low', 'close', 'volume'].includes(base)) {
      const priceIndicator = indicators['_price'];
      if (!priceIndicator) return null;
      const values = priceIndicator.values as Record<string, (number | null)[]>;
      return values[base]?.[effectiveIndex] ?? null;
    }

    if (!base) return null;

    const indicator = indicators[base];
    if (!indicator) return null;

    if (Array.isArray(indicator.values)) {
      return indicator.values[effectiveIndex] ?? null;
    }

    const values = indicator.values;
    if (subKey) {
      return values[subKey]?.[effectiveIndex] ?? null;
    }

    const defaultKey = Object.keys(values)[0];
    return defaultKey ? (values[defaultKey]?.[effectiveIndex] ?? null) : null;
  }

  getIndicatorSeries(
    indicators: ComputedIndicators,
    reference: string
  ): (number | null)[] {
    const { base, subKey, offset } = this.parseReference(reference);

    if (!base) return [];

    let baseSeries: (number | null)[] = [];

    if (['open', 'high', 'low', 'close', 'volume'].includes(base)) {
      const priceIndicator = indicators['_price'];
      if (!priceIndicator) return [];
      const values = priceIndicator.values as Record<string, (number | null)[]>;
      baseSeries = values[base] ?? [];
    } else if (base === 'volume' && subKey && !offset) {
      const volumeIndicator = indicators['volume'];
      if (!volumeIndicator) return [];
      const values = volumeIndicator.values as Record<string, (number | null)[]>;
      baseSeries = values[subKey] ?? [];
    } else {
      const indicator = indicators[base];
      if (!indicator) return [];

      if (Array.isArray(indicator.values)) {
        baseSeries = indicator.values;
      } else {
        const values = indicator.values;
        if (subKey) {
          baseSeries = values[subKey] ?? [];
        } else {
          const defaultKey = Object.keys(values)[0];
          baseSeries = defaultKey ? (values[defaultKey] ?? []) : [];
        }
      }
    }

    if (offset > 0 && baseSeries.length > 0) {
      const shifted: (number | null)[] = new Array(baseSeries.length).fill(null);
      for (let i = offset; i < baseSeries.length; i++) {
        shifted[i] = baseSeries[i - offset] ?? null;
      }
      return shifted;
    }

    return baseSeries;
  }

  clearCache(): void {
    this.cache.clear();
  }

  private calculateHighest(klines: Kline[], period: number, source: string): (number | null)[] {
    if (period <= 0 || klines.length === 0) return [];

    const getSourceValue = (k: Kline): number => {
      switch (source) {
        case 'open': return parseFloat(k.open);
        case 'high': return parseFloat(k.high);
        case 'low': return parseFloat(k.low);
        case 'close': return parseFloat(k.close);
        case 'volume': return parseFloat(k.volume);
        default: return parseFloat(k.high);
      }
    };

    const result: (number | null)[] = [];

    for (let i = 0; i < klines.length; i++) {
      if (i < period - 1) {
        result.push(null);
        continue;
      }

      let highest = -Infinity;
      for (let j = 0; j < period; j++) {
        const kline = klines[i - j];
        if (kline) {
          const value = getSourceValue(kline);
          if (value > highest) highest = value;
        }
      }

      result.push(highest === -Infinity ? null : highest);
    }

    return result;
  }

  private calculateLowest(klines: Kline[], period: number, source: string): (number | null)[] {
    if (period <= 0 || klines.length === 0) return [];

    const getSourceValue = (k: Kline): number => {
      switch (source) {
        case 'open': return parseFloat(k.open);
        case 'high': return parseFloat(k.high);
        case 'low': return parseFloat(k.low);
        case 'close': return parseFloat(k.close);
        case 'volume': return parseFloat(k.volume);
        default: return parseFloat(k.low);
      }
    };

    const result: (number | null)[] = [];

    for (let i = 0; i < klines.length; i++) {
      if (i < period - 1) {
        result.push(null);
        continue;
      }

      let lowest = Infinity;
      for (let j = 0; j < period; j++) {
        const kline = klines[i - j];
        if (kline) {
          const value = getSourceValue(kline);
          if (value < lowest) lowest = value;
        }
      }

      result.push(lowest === Infinity ? null : lowest);
    }

    return result;
  }

  private calculateVolumeSMA(klines: Kline[], period: number): (number | null)[] {
    if (period <= 0 || klines.length === 0) {
      return [];
    }

    const result: (number | null)[] = [];

    for (let i = 0; i < klines.length; i++) {
      if (i < period - 1) {
        result.push(null);
        continue;
      }

      let sum = 0;
      for (let j = 0; j < period; j++) {
        const kline = klines[i - j];
        if (!kline) continue;
        sum += parseFloat(kline.volume);
      }

      result.push(sum / period);
    }

    return result;
  }

  private generateCacheKey(
    klines: Kline[],
    indicators: Record<string, IndicatorDefinition>,
    params: Record<string, number>
  ): string {
    const klineKey = klines.length > 0
      ? `${klines.length}-${klines[0]?.openTime}-${klines[klines.length - 1]?.openTime}`
      : 'empty';
    const indicatorKey = JSON.stringify(indicators);
    const paramKey = JSON.stringify(params);
    return `${klineKey}:${indicatorKey}:${paramKey}`;
  }
}
