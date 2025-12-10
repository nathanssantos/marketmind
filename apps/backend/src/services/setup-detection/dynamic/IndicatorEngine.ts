/**
 * Indicator Engine
 *
 * Computes technical indicators based on strategy definitions.
 * Maps JSON indicator definitions to @marketmind/indicators functions.
 */

import type {
    ComputedIndicator,
    ComputedIndicators, IndicatorDefinition,
    IndicatorType, Kline
} from '@marketmind/types';

import {
    calculateFundingRate,
    detectFundingRateSignal,
    calculateOpenInterest,
    calculateLiquidations,
    calculateRelativeStrength,
    type FundingRateData,
    type OpenInterestData,
    type LiquidationData,
} from '@marketmind/indicators';

import { getBinanceFuturesDataService } from '../../binance-futures-data';
import { getBTCDominanceDataService } from '../../btc-dominance-data';

import {
    calculateADX,
    calculateATR,
    calculateBollingerBandsArray,
    calculateCCI,
    calculateCumulativeRSI,
    calculateDonchian,
    calculateEMA,
    calculateIBS,
    calculateKeltner,
    calculateMACD,
    calculateMFI,
    calculateNDayHighLow,
    calculateNR7,
    calculateOBV,
    calculatePercentBSeries,
    calculateRSI,
    calculateSMA,
    calculateStochastic,
    calculateSupertrend,
    calculateVWAP,
    calculateWilliamsR,
    findPivotPoints,
    calculateROC,
    calculateDEMA,
    calculateTEMA,
    calculateWMA,
    calculateHMA,
    calculateCMO,
    calculateAO,
    calculatePPO,
    calculateTSI,
    calculateUltimateOscillator,
    calculateAroon,
    calculateDMI,
    calculateVortex,
    calculateParabolicSAR,
    calculateMassIndex,
    calculateCMF,
    calculateKlinger,
    calculateElderRay,
    calculateDeltaVolume,
    calculateSwingPoints,
    calculateFVG,
    calculateCandlePatterns,
    calculateGaps,
    calculateFibonacciRetracement,
    calculateFloorPivotSeries,
    calculateLiquidityLevels,
} from '@marketmind/indicators';

interface CryptoData {
  fundingRate: FundingRateData[];
  openInterest: OpenInterestData[];
  liquidations: LiquidationData[];
  baseAssetCloses?: number[];
  btcDominance?: number | null;
}

/**
 * Engine for computing indicators defined in strategy JSON
 */
export class IndicatorEngine {
  private cache: Map<string, ComputedIndicators> = new Map();
  private cryptoDataCache: Map<string, { data: CryptoData; timestamp: number }> = new Map();
  private cryptoDataCacheTTL: number = 60000;

  /**
   * Compute all indicators defined in a strategy
   */
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

    // Add built-in price/volume series
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

    // Compute volume SMA for confidence bonuses (calculate SMA of volume, not close)
    const volumeSma20 = this.calculateVolumeSMA(klines, 20);
    result['volume'] = {
      type: 'sma' as IndicatorType,
      values: {
        current: klines.map((k) => parseFloat(k.volume)),
        sma20: volumeSma20,
      },
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Compute all indicators with async crypto data from Binance Futures API
   */
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

  /**
   * Fetch crypto-specific data from Binance Futures API and BTC Dominance
   */
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

    this.cryptoDataCache.set(cacheKey, { data, timestamp: Date.now() });

    return data;
  }

  /**
   * Compute a crypto-specific indicator
   */
  private computeCryptoIndicator(
    klines: Kline[],
    definition: IndicatorDefinition,
    params: Record<string, number>,
    cryptoData: CryptoData,
    _baseAssetSymbol?: string
  ): ComputedIndicator | null {
    const resolvedParams = this.resolveParams(definition.params, params);
    const closes = klines.map((k) => parseFloat(k.close));

    switch (definition.type) {
      case 'fundingRate': {
        if (cryptoData.fundingRate.length === 0) {
          return { type: 'fundingRate', values: new Array(klines.length).fill(null) };
        }

        const result = calculateFundingRate(cryptoData.fundingRate, {
          extremeThreshold: resolvedParams['extremeThreshold'] ?? 0.1,
          averagePeriod: resolvedParams['averagePeriod'] ?? 7,
        });

        const signalResult = detectFundingRateSignal(cryptoData.fundingRate, {
          extremeThreshold: resolvedParams['extremeThreshold'] ?? 0.1,
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
      }

      case 'openInterest': {
        if (cryptoData.openInterest.length === 0) {
          return { type: 'openInterest', values: new Array(klines.length).fill(null) };
        }

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
          lookback: resolvedParams['lookback'] ?? 10,
          changeThreshold: resolvedParams['changeThreshold'] ?? 5,
          trendPeriod: resolvedParams['trendPeriod'] ?? 5,
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
      }

      case 'liquidations': {
        if (cryptoData.liquidations.length === 0) {
          return { type: 'liquidations', values: new Array(klines.length).fill(null) };
        }

        const result = calculateLiquidations(cryptoData.liquidations, {
          cascadeThreshold: resolvedParams['cascadeThreshold'] ?? 1000000,
          lookbackPeriods: resolvedParams['lookbackPeriods'] ?? 6,
          imbalanceThreshold: resolvedParams['imbalanceThreshold'] ?? 0.7,
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
      }

      case 'relativeStrength': {
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
      }

      case 'btcDominance': {
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
      }

      default:
        return null;
    }
  }

  /**
   * Compute a single indicator
   */
  private computeIndicator(
    klines: Kline[],
    definition: IndicatorDefinition,
    params: Record<string, number>
  ): ComputedIndicator {
    const resolvedParams = this.resolveParams(definition.params, params);

    switch (definition.type) {
      case 'sma':
        return {
          type: 'sma',
          values: calculateSMA(klines, resolvedParams['period'] ?? 20),
        };

      case 'ema':
        return {
          type: 'ema',
          values: calculateEMA(klines, resolvedParams['period'] ?? 20),
        };

      case 'rsi':
        const rsiResult = calculateRSI(klines, resolvedParams['period'] ?? 14);
        return {
          type: 'rsi',
          values: rsiResult.values,
        };

      case 'macd':
        const macdResult = calculateMACD(
          klines,
          resolvedParams['fastPeriod'] ?? 12,
          resolvedParams['slowPeriod'] ?? 26,
          resolvedParams['signalPeriod'] ?? 9
        );
        return {
          type: 'macd',
          values: {
            macd: macdResult.macd,
            signal: macdResult.signal,
            histogram: macdResult.histogram,
          },
        };

      case 'bollingerBands':
        const bbResult = calculateBollingerBandsArray(
          klines,
          resolvedParams['period'] ?? 20,
          resolvedParams['stdDev'] ?? 2
        );
        return {
          type: 'bollingerBands',
          values: {
            upper: bbResult.map((b) => b?.upper ?? null),
            middle: bbResult.map((b) => b?.middle ?? null),
            lower: bbResult.map((b) => b?.lower ?? null),
          },
        };

      case 'atr':
        const atrResult = calculateATR(klines, resolvedParams['period'] ?? 14);
        return {
          type: 'atr',
          values: atrResult.map((v) => (isNaN(v) ? null : v)),
        };

      case 'stochastic':
        const stochResult = calculateStochastic(
          klines,
          resolvedParams['kPeriod'] ?? 14,
          resolvedParams['dPeriod'] ?? 3
        );
        return {
          type: 'stochastic',
          values: {
            k: stochResult.k,
            d: stochResult.d,
          },
        };

      case 'vwap':
        const vwapResult = calculateVWAP(klines);
        return {
          type: 'vwap',
          values: vwapResult,
        };

      case 'pivotPoints':
        const pivots = findPivotPoints(klines, resolvedParams['lookback'] ?? 5);
        const pivotValues: (number | null)[] = new Array(klines.length).fill(null);
        for (const pivot of pivots) {
          if (pivot.index >= 0 && pivot.index < pivotValues.length) {
            pivotValues[pivot.index] = pivot.price;
          }
        }
        return {
          type: 'pivotPoints',
          values: pivotValues,
        };

      case 'adx':
        const adxResult = calculateADX(klines, resolvedParams['period'] ?? 14);
        return {
          type: 'adx',
          values: {
            adx: adxResult.adx,
            plusDI: adxResult.plusDI,
            minusDI: adxResult.minusDI,
          },
        };

      case 'obv':
        const obvResult = calculateOBV(klines, resolvedParams['smaPeriod']);
        return {
          type: 'obv',
          values: {
            obv: obvResult.values,
            sma: obvResult.sma,
          },
        };

      case 'williamsR':
        const williamsResult = calculateWilliamsR(klines, resolvedParams['period'] ?? 14);
        return {
          type: 'williamsR',
          values: williamsResult,
        };

      case 'cci':
        const cciResult = calculateCCI(klines, resolvedParams['period'] ?? 20);
        return {
          type: 'cci',
          values: cciResult,
        };

      case 'mfi':
        const mfiResult = calculateMFI(klines, resolvedParams['period'] ?? 14);
        return {
          type: 'mfi',
          values: mfiResult,
        };

      case 'donchian':
        const donchianResult = calculateDonchian(klines, resolvedParams['period'] ?? 20);
        return {
          type: 'donchian',
          values: {
            upper: donchianResult.upper,
            middle: donchianResult.middle,
            lower: donchianResult.lower,
          },
        };

      case 'keltner':
        const keltnerResult = calculateKeltner(
          klines,
          resolvedParams['emaPeriod'] ?? 20,
          resolvedParams['atrPeriod'] ?? 10,
          resolvedParams['multiplier'] ?? 2
        );
        return {
          type: 'keltner',
          values: {
            upper: keltnerResult.upper,
            middle: keltnerResult.middle,
            lower: keltnerResult.lower,
          },
        };

      case 'supertrend':
        const supertrendResult = calculateSupertrend(
          klines,
          resolvedParams['period'] ?? 10,
          resolvedParams['multiplier'] ?? 3
        );
        return {
          type: 'supertrend',
          values: {
            trend: supertrendResult.trend.map((t) => (t === 'up' ? 1 : t === 'down' ? -1 : null)),
            value: supertrendResult.value,
          },
        };

      case 'ibs':
        const ibsResult = calculateIBS(klines);
        return {
          type: 'ibs',
          values: ibsResult.values,
        };

      case 'percentB':
        const percentBResult = calculatePercentBSeries(
          klines,
          resolvedParams['period'] ?? 20,
          resolvedParams['stdDev'] ?? 2
        );
        return {
          type: 'percentB',
          values: percentBResult.values,
        };

      case 'cumulativeRsi':
        const cumulativeRsiResult = calculateCumulativeRSI(
          klines,
          resolvedParams['rsiPeriod'] ?? 2,
          resolvedParams['sumPeriod'] ?? 2
        );
        return {
          type: 'cumulativeRsi',
          values: {
            cumulative: cumulativeRsiResult.values,
            rsi: cumulativeRsiResult.rsiValues,
          },
        };

      case 'nDayHighLow':
        const nDayResult = calculateNDayHighLow(klines, resolvedParams['period'] ?? 7);
        return {
          type: 'nDayHighLow',
          values: {
            isNDayHigh: nDayResult.isNDayHigh.map((v) => (v ? 1 : 0)),
            isNDayLow: nDayResult.isNDayLow.map((v) => (v ? 1 : 0)),
            highestClose: nDayResult.highestClose,
            lowestClose: nDayResult.lowestClose,
          },
        };

      case 'nr7':
        const nr7Result = calculateNR7(klines, resolvedParams['lookback'] ?? 7);
        return {
          type: 'nr7',
          values: nr7Result.isNR7.map((v) => (v ? 1 : 0)),
        };

      case 'roc': {
        const rocResult = calculateROC(klines, resolvedParams['period'] ?? 12);
        return { type: 'roc', values: rocResult.values };
      }

      case 'dema': {
        const demaResult = calculateDEMA(klines, resolvedParams['period'] ?? 20);
        return { type: 'dema', values: demaResult.values };
      }

      case 'tema': {
        const temaResult = calculateTEMA(klines, resolvedParams['period'] ?? 20);
        return { type: 'tema', values: temaResult.values };
      }

      case 'wma': {
        const wmaResult = calculateWMA(klines, resolvedParams['period'] ?? 20);
        return { type: 'wma', values: wmaResult.values };
      }

      case 'hma': {
        const hmaResult = calculateHMA(klines, resolvedParams['period'] ?? 20);
        return { type: 'hma', values: hmaResult.values };
      }

      case 'cmo': {
        const cmoResult = calculateCMO(klines, resolvedParams['period'] ?? 14);
        return { type: 'cmo', values: cmoResult.values };
      }

      case 'ao': {
        const aoResult = calculateAO(klines, resolvedParams['fastPeriod'] ?? 5, resolvedParams['slowPeriod'] ?? 34);
        return { type: 'ao', values: aoResult.values };
      }

      case 'ppo': {
        const ppoResult = calculatePPO(klines, resolvedParams['fastPeriod'] ?? 12, resolvedParams['slowPeriod'] ?? 26, resolvedParams['signalPeriod'] ?? 9);
        return {
          type: 'ppo',
          values: {
            ppo: ppoResult.ppo,
            signal: ppoResult.signal,
            histogram: ppoResult.histogram,
          },
        };
      }

      case 'tsi': {
        const tsiResult = calculateTSI(klines, resolvedParams['longPeriod'] ?? 25, resolvedParams['shortPeriod'] ?? 13, resolvedParams['signalPeriod'] ?? 13);
        return {
          type: 'tsi',
          values: {
            tsi: tsiResult.tsi,
            signal: tsiResult.signal,
          },
        };
      }

      case 'ultimateOscillator': {
        const uoResult = calculateUltimateOscillator(klines, resolvedParams['period1'] ?? 7, resolvedParams['period2'] ?? 14, resolvedParams['period3'] ?? 28);
        return { type: 'ultimateOscillator', values: uoResult.values };
      }

      case 'aroon': {
        const aroonResult = calculateAroon(klines, resolvedParams['period'] ?? 25);
        return {
          type: 'aroon',
          values: {
            up: aroonResult.aroonUp,
            down: aroonResult.aroonDown,
            oscillator: aroonResult.oscillator,
          },
        };
      }

      case 'dmi': {
        const dmiResult = calculateDMI(klines, resolvedParams['period'] ?? 14);
        return {
          type: 'dmi',
          values: {
            plusDI: dmiResult.plusDI,
            minusDI: dmiResult.minusDI,
            dx: dmiResult.dx,
          },
        };
      }

      case 'vortex': {
        const vortexResult = calculateVortex(klines, resolvedParams['period'] ?? 14);
        return {
          type: 'vortex',
          values: {
            viPlus: vortexResult.viPlus,
            viMinus: vortexResult.viMinus,
          },
        };
      }

      case 'parabolicSar': {
        const psarResult = calculateParabolicSAR(klines, resolvedParams['step'] ?? 0.02, resolvedParams['max'] ?? 0.2);
        return {
          type: 'parabolicSar',
          values: {
            sar: psarResult.sar,
            trend: psarResult.trend.map((t) => (t === 'up' ? 1 : -1)),
          },
        };
      }

      case 'massIndex': {
        const massResult = calculateMassIndex(klines, resolvedParams['emaPeriod'] ?? 9, resolvedParams['sumPeriod'] ?? 25);
        return { type: 'massIndex', values: massResult.values };
      }

      case 'cmf': {
        const cmfResult = calculateCMF(klines, resolvedParams['period'] ?? 20);
        return { type: 'cmf', values: cmfResult.values };
      }

      case 'klinger': {
        const klingerResult = calculateKlinger(klines, resolvedParams['shortPeriod'] ?? 34, resolvedParams['longPeriod'] ?? 55, resolvedParams['signalPeriod'] ?? 13);
        return {
          type: 'klinger',
          values: {
            kvo: klingerResult.kvo,
            signal: klingerResult.signal,
          },
        };
      }

      case 'elderRay': {
        const elderResult = calculateElderRay(klines, resolvedParams['period'] ?? 13);
        return {
          type: 'elderRay',
          values: {
            bullPower: elderResult.bullPower,
            bearPower: elderResult.bearPower,
          },
        };
      }

      case 'deltaVolume': {
        const deltaResult = calculateDeltaVolume(klines);
        return {
          type: 'deltaVolume',
          values: {
            delta: deltaResult.delta,
            cumulative: deltaResult.cumulativeDelta,
          },
        };
      }

      case 'swingPoints': {
        const swingResult = calculateSwingPoints(klines, resolvedParams['lookback'] ?? 5);
        return {
          type: 'swingPoints',
          values: {
            high: swingResult.swingHighs,
            low: swingResult.swingLows,
          },
        };
      }

      case 'fvg': {
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
      }

      case 'candlePatterns': {
        const patternsResult = calculateCandlePatterns(klines);
        const patternValues: (number | null)[] = new Array(klines.length).fill(null);
        for (const pattern of patternsResult.patterns) {
          if (pattern.index >= 0 && pattern.index < patternValues.length) {
            patternValues[pattern.index] = pattern.signal === 'bullish' ? 1 : pattern.signal === 'bearish' ? -1 : 0;
          }
        }
        return { type: 'candlePatterns', values: patternValues };
      }

      case 'gapDetection': {
        const gapsResult = calculateGaps(klines, resolvedParams['threshold'] ?? 0.5);
        const gapValues: (number | null)[] = new Array(klines.length).fill(null);
        for (const gap of gapsResult.gaps) {
          if (gap.index >= 0 && gap.index < gapValues.length) {
            gapValues[gap.index] = gap.type === 'up' ? 1 : -1;
          }
        }
        return { type: 'gapDetection', values: gapValues };
      }

      case 'fibonacci': {
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
      }

      case 'floorPivots': {
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
      }

      case 'liquidityLevels': {
        const highs = klines.map((k) => parseFloat(k.high));
        const lows = klines.map((k) => parseFloat(k.low));
        const closes = klines.map((k) => parseFloat(k.close));
        const liquidityResult = calculateLiquidityLevels(highs, lows, closes, {
          lookback: resolvedParams['lookback'] ?? 50,
          minTouches: resolvedParams['minTouches'] ?? 2,
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
      }

      case 'fundingRate':
      case 'openInterest':
      case 'liquidations':
      case 'btcDominance':
      case 'relativeStrength':
        return {
          type: definition.type,
          values: new Array(klines.length).fill(null),
        };

      default:
        throw new Error(`Unknown indicator type: ${definition.type}`);
    }
  }

  /**
   * Resolve parameter references ($paramName) to actual values
   */
  private resolveParams(
    indicatorParams: Record<string, number | string>,
    strategyParams: Record<string, number>
  ): Record<string, number> {
    const resolved: Record<string, number> = {};

    for (const [key, value] of Object.entries(indicatorParams)) {
      if (typeof value === 'string' && value.startsWith('$')) {
        const paramName = value.slice(1);
        const paramValue = strategyParams[paramName];
        if (paramValue === undefined) {
          throw new Error(`Unknown parameter reference: ${value}`);
        }
        resolved[key] = paramValue;
      } else if (typeof value === 'number') {
        resolved[key] = value;
      } else {
        throw new Error(`Invalid parameter value: ${value}`);
      }
    }

    return resolved;
  }

  /**
   * Parse a reference string to extract base indicator, sub-key, and offset
   *
   * Examples:
   * - "close" -> { base: "close", subKey: null, offset: 0 }
   * - "close.prev" -> { base: "close", subKey: null, offset: 1 }
   * - "close.prev2" -> { base: "close", subKey: null, offset: 2 }
   * - "ema9.prev" -> { base: "ema9", subKey: null, offset: 1 }
   * - "bb.upper.prev" -> { base: "bb", subKey: "upper", offset: 1 }
   * - "macd.signal.prev3" -> { base: "macd", subKey: "signal", offset: 3 }
   */
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

  /**
   * Resolve an indicator reference to a value at a specific index
   *
   * Supports:
   * - "close", "open", "high", "low", "volume" - price data
   * - "rsi" - simple indicator value
   * - "bb.upper", "bb.lower", "bb.middle" - nested indicator values
   * - "macd.signal", "macd.histogram" - nested indicator values
   * - ".prev", ".prev2", ".prev3" suffixes for historical values
   *   e.g., "close.prev", "ema9.prev2", "bb.upper.prev"
   */
  resolveIndicatorValue(
    indicators: ComputedIndicators,
    reference: string,
    index: number
  ): number | null {
    const { base, subKey, offset } = this.parseReference(reference);
    const effectiveIndex = index - offset;

    if (effectiveIndex < 0) return null;

    // Handle volume.sma20 and volume.current FIRST (before checking price references)
    if (base === 'volume' && subKey) {
      const volumeIndicator = indicators['volume'];
      if (!volumeIndicator) return null;
      const values = volumeIndicator.values as Record<string, (number | null)[]>;
      return values[subKey]?.[effectiveIndex] ?? null;
    }

    // Handle price references (including raw volume when no subKey)
    if (['open', 'high', 'low', 'close', 'volume'].includes(base)) {
      const priceIndicator = indicators['_price'];
      if (!priceIndicator) return null;
      const values = priceIndicator.values as Record<string, (number | null)[]>;
      return values[base]?.[effectiveIndex] ?? null;
    }

    if (!base) return null;

    const indicator = indicators[base];
    if (!indicator) return null;

    // Check if values is an array (simple indicator) or object (compound indicator)
    if (Array.isArray(indicator.values)) {
      return indicator.values[effectiveIndex] ?? null;
    }

    // Compound indicator with sub-keys
    const values = indicator.values as Record<string, (number | null)[]>;
    if (subKey) {
      return values[subKey]?.[effectiveIndex] ?? null;
    }

    // If no sub-key provided, try to get a default value
    // For RSI-like indicators, return the main value
    const defaultKey = Object.keys(values)[0];
    return defaultKey ? (values[defaultKey]?.[effectiveIndex] ?? null) : null;
  }

  /**
   * Get indicator values as array for crossover detection
   * Supports .prev, .prev2, etc. offsets - returns shifted arrays
   */
  getIndicatorSeries(
    indicators: ComputedIndicators,
    reference: string
  ): (number | null)[] {
    const { base, subKey, offset } = this.parseReference(reference);

    if (!base) return [];

    let baseSeries: (number | null)[] = [];

    // Handle price references
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
        const values = indicator.values as Record<string, (number | null)[]>;
        if (subKey) {
          baseSeries = values[subKey] ?? [];
        } else {
          const defaultKey = Object.keys(values)[0];
          baseSeries = defaultKey ? (values[defaultKey] ?? []) : [];
        }
      }
    }

    // Apply offset if needed (shift series by offset positions)
    if (offset > 0 && baseSeries.length > 0) {
      const shifted: (number | null)[] = new Array(baseSeries.length).fill(null);
      for (let i = offset; i < baseSeries.length; i++) {
        shifted[i] = baseSeries[i - offset] ?? null;
      }
      return shifted;
    }

    return baseSeries;
  }

  /**
   * Clear the indicator cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Calculate SMA of volume values (not close prices)
   */
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

  /**
   * Generate a cache key for computed indicators
   */
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
