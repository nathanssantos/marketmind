import type { Kline } from '@marketmind/types';
import {
  calculateRSI,
  calculateMACD,
  calculateSMA,
  calculateEMA,
  calculateATR,
  calculateBollingerBandsArray,
  calculateADX,
  calculateStochastic,
  calculateCCI,
  calculateMFI,
  calculateROC,
  calculateWilliamsR,
  calculateOBV,
  calculateKeltner,
  type BollingerBands,
} from '@marketmind/indicators';
import type { TechnicalFeatureSet } from '../types';
import {
  RSI_PERIODS,
  ATR_PERIODS,
  EMA_PERIODS,
  SMA_PERIODS,
  MACD_CONFIG,
  BOLLINGER_CONFIG,
  STOCHASTIC_CONFIG,
  ADX_PERIOD,
  CCI_PERIODS,
  MFI_PERIOD,
  ROC_PERIOD,
  WILLIAMS_R_PERIOD,
  OBV_SLOPE_PERIOD,
  VOLUME_SMA_PERIOD,
  MOMENTUM_PERIODS,
  PRICE_CHANNEL_PERIOD,
  KELTNER_CONFIG,
  TECHNICAL_FEATURE_NAMES,
  CANDLE_PATTERNS,
  ADX_TREND_THRESHOLDS,
} from '../constants/featureConfig';

interface PrecomputedIndicators {
  rsi: Map<number, (number | null)[]>;
  ema: Map<number, (number | null)[]>;
  sma: Map<number, (number | null)[]>;
  atr: Map<number, number[]>;
  macd: { macd: number[]; signal: number[]; histogram: number[] };
  bollingerBands: (BollingerBands | null)[];
  adx: { adx: (number | null)[]; plusDI: (number | null)[]; minusDI: (number | null)[] };
  stochastic: { k: (number | null)[]; d: (number | null)[] };
  cci: Map<number, (number | null)[]>;
  mfi: (number | null)[];
  roc: (number | null)[];
  williamsR: (number | null)[];
  obv: number[];
  keltner: { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] };
}

export class TechnicalFeatures {
  private precomputed: PrecomputedIndicators | null = null;
  private klines: Kline[] = [];

  constructor(_config?: unknown) {}

  precompute(klines: Kline[]): void {
    this.klines = klines;
    this.precomputed = {
      rsi: new Map(),
      ema: new Map(),
      sma: new Map(),
      atr: new Map(),
      macd: { macd: [], signal: [], histogram: [] },
      bollingerBands: [],
      adx: { adx: [], plusDI: [], minusDI: [] },
      stochastic: { k: [], d: [] },
      cci: new Map(),
      mfi: [],
      roc: [],
      williamsR: [],
      obv: [],
      keltner: { upper: [], middle: [], lower: [] },
    };

    for (const period of RSI_PERIODS) {
      const result = calculateRSI(klines, period);
      this.precomputed.rsi.set(period, result.values);
    }

    for (const period of EMA_PERIODS) {
      this.precomputed.ema.set(period, calculateEMA(klines, period));
    }

    for (const period of SMA_PERIODS) {
      this.precomputed.sma.set(period, calculateSMA(klines, period));
    }

    for (const period of ATR_PERIODS) {
      this.precomputed.atr.set(period, calculateATR(klines, period));
    }

    this.precomputed.macd = calculateMACD(
      klines,
      MACD_CONFIG.fast,
      MACD_CONFIG.slow,
      MACD_CONFIG.signal
    );

    this.precomputed.bollingerBands = calculateBollingerBandsArray(
      klines,
      BOLLINGER_CONFIG.period,
      BOLLINGER_CONFIG.stdDev
    );

    const adxResult = calculateADX(klines, ADX_PERIOD);
    this.precomputed.adx = {
      adx: adxResult.adx,
      plusDI: adxResult.plusDI,
      minusDI: adxResult.minusDI,
    };

    const stochResult = calculateStochastic(
      klines,
      STOCHASTIC_CONFIG.kPeriod,
      STOCHASTIC_CONFIG.dPeriod
    );
    this.precomputed.stochastic = {
      k: stochResult.k,
      d: stochResult.d,
    };

    for (const period of CCI_PERIODS) {
      this.precomputed.cci.set(period, calculateCCI(klines, period));
    }

    this.precomputed.mfi = calculateMFI(klines, MFI_PERIOD);
    this.precomputed.roc = calculateROC(klines, ROC_PERIOD).values;
    this.precomputed.williamsR = calculateWilliamsR(klines, WILLIAMS_R_PERIOD);
    this.precomputed.obv = calculateOBV(klines).values;

    const keltnerResult = calculateKeltner(
      klines,
      KELTNER_CONFIG.emaPeriod,
      KELTNER_CONFIG.atrPeriod,
      KELTNER_CONFIG.multiplier
    );
    this.precomputed.keltner = {
      upper: keltnerResult.upper,
      middle: keltnerResult.middle,
      lower: keltnerResult.lower,
    };
  }

  extract(klines: Kline[], index: number): TechnicalFeatureSet {
    if (!this.precomputed || this.klines !== klines) {
      this.precompute(klines);
    }

    const kline = klines[index];
    if (!kline) throw new Error(`Invalid kline index: ${index}`);

    const close = parseFloat(kline.close);
    const high = parseFloat(kline.high);
    const low = parseFloat(kline.low);
    const open = parseFloat(kline.open);
    const volume = parseFloat(kline.volume);

    const rsi2 = this.getValue(this.precomputed!.rsi.get(2), index) ?? 50;
    const rsi7 = this.getValue(this.precomputed!.rsi.get(7), index) ?? 50;
    const rsi14 = this.getValue(this.precomputed!.rsi.get(14), index) ?? 50;
    const rsi21 = this.getValue(this.precomputed!.rsi.get(21), index) ?? 50;

    const rsiPrev1 = this.getValue(this.precomputed!.rsi.get(14), index - 1) ?? 50;
    const rsiPrev5 = this.getValue(this.precomputed!.rsi.get(14), index - 5) ?? 50;

    const macdLine = this.precomputed!.macd.macd[index] ?? 0;
    const macdSignal = this.precomputed!.macd.signal[index] ?? 0;
    const macdHistogram = this.precomputed!.macd.histogram[index] ?? 0;
    const macdHistogramPrev = this.precomputed!.macd.histogram[index - 1] ?? 0;

    const macdCrossover = this.detectCrossover(
      this.precomputed!.macd.macd,
      this.precomputed!.macd.signal,
      index
    );

    const atr7 = this.precomputed!.atr.get(7)?.[index] ?? 0;
    const atr14 = this.precomputed!.atr.get(14)?.[index] ?? 0;
    const atr21 = this.precomputed!.atr.get(21)?.[index] ?? 0;
    const atrPercent = close > 0 ? (atr14 / close) * 100 : 0;

    const bb = this.precomputed!.bollingerBands[index];
    const bbUpper = bb?.upper ?? close;
    const bbLower = bb?.lower ?? close;
    const bbMiddle = bb?.middle ?? close;
    const bbWidth = bbMiddle > 0 ? (bbUpper - bbLower) / bbMiddle : 0;
    const bbPosition = bbUpper !== bbLower ? (close - bbLower) / (bbUpper - bbLower) : 0.5;
    const bbPercentB = bbPosition;

    const ema9 = this.getValue(this.precomputed!.ema.get(9), index) ?? close;
    const ema21 = this.getValue(this.precomputed!.ema.get(21), index) ?? close;
    const ema50 = this.getValue(this.precomputed!.ema.get(50), index) ?? close;
    const ema200 = this.getValue(this.precomputed!.ema.get(200), index) ?? close;

    const ema9_21Cross = this.detectCrossover(
      this.precomputed!.ema.get(9)!,
      this.precomputed!.ema.get(21)!,
      index
    );
    const ema50_200Cross = this.detectCrossover(
      this.precomputed!.ema.get(50)!,
      this.precomputed!.ema.get(200)!,
      index
    );

    const priceVsEma9 = ema9 > 0 ? ((close - ema9) / ema9) * 100 : 0;
    const priceVsEma21 = ema21 > 0 ? ((close - ema21) / ema21) * 100 : 0;
    const priceVsEma50 = ema50 > 0 ? ((close - ema50) / ema50) * 100 : 0;
    const priceVsEma200 = ema200 > 0 ? ((close - ema200) / ema200) * 100 : 0;

    const adxValue = this.getValue(this.precomputed!.adx.adx, index) ?? 0;
    const plusDI = this.getValue(this.precomputed!.adx.plusDI, index) ?? 0;
    const minusDI = this.getValue(this.precomputed!.adx.minusDI, index) ?? 0;
    const adxTrendStrength = this.getAdxTrendStrength(adxValue);
    const diCrossover = this.detectCrossover(
      this.precomputed!.adx.plusDI,
      this.precomputed!.adx.minusDI,
      index
    );

    const stochK = this.getValue(this.precomputed!.stochastic.k, index) ?? 50;
    const stochD = this.getValue(this.precomputed!.stochastic.d, index) ?? 50;
    const stochCrossover = this.detectCrossover(
      this.precomputed!.stochastic.k,
      this.precomputed!.stochastic.d,
      index
    );

    const volumeSma = this.calculateVolumeSMA(klines, index, VOLUME_SMA_PERIOD);
    const volumeSmaRatio = volumeSma > 0 ? volume / volumeSma : 1;
    const prevVolume = index > 0 ? parseFloat(klines[index - 1]?.volume ?? '0') : volume;
    const volumeChange = prevVolume > 0 ? ((volume - prevVolume) / prevVolume) * 100 : 0;

    const obvSlope = this.calculateOBVSlope(index);

    const cci14 = this.getValue(this.precomputed!.cci.get(14), index) ?? 0;
    const cci20 = this.getValue(this.precomputed!.cci.get(20), index) ?? 0;
    const williamsR = this.getValue(this.precomputed!.williamsR, index) ?? -50;
    const mfi14 = this.getValue(this.precomputed!.mfi, index) ?? 50;
    const roc12 = this.getValue(this.precomputed!.roc, index) ?? 0;

    const keltnerUpper = this.getValue(this.precomputed!.keltner.upper, index) ?? close;
    const keltnerLower = this.getValue(this.precomputed!.keltner.lower, index) ?? close;
    const keltnerPosition =
      keltnerUpper !== keltnerLower
        ? (close - keltnerLower) / (keltnerUpper - keltnerLower)
        : 0.5;

    const sma20 = this.getValue(this.precomputed!.sma.get(20), index) ?? close;
    const sma50 = this.getValue(this.precomputed!.sma.get(50), index) ?? close;
    const sma200 = this.getValue(this.precomputed!.sma.get(200), index) ?? close;
    const priceVsSma20 = sma20 > 0 ? ((close - sma20) / sma20) * 100 : 0;
    const priceVsSma50 = sma50 > 0 ? ((close - sma50) / sma50) * 100 : 0;
    const priceVsSma200 = sma200 > 0 ? ((close - sma200) / sma200) * 100 : 0;

    const { highestHigh, lowestLow } = this.getPriceChannel(klines, index, PRICE_CHANNEL_PERIOD);
    const priceChannelPosition =
      highestHigh !== lowestLow ? (close - lowestLow) / (highestHigh - lowestLow) : 0.5;

    const avgTrueRangeNormalized = close > 0 ? atr14 / close : 0;

    const priceMomentum5 = this.calculateMomentum(klines, index, MOMENTUM_PERIODS[0]);
    const priceMomentum10 = this.calculateMomentum(klines, index, MOMENTUM_PERIODS[1]);
    const priceMomentum20 = this.calculateMomentum(klines, index, MOMENTUM_PERIODS[2]);

    const bodySize = Math.abs(close - open);
    const candleRange = high - low;
    const candleBodyRatio = candleRange > 0 ? bodySize / candleRange : 0;
    const upperWick = high - Math.max(open, close);
    const lowerWick = Math.min(open, close) - low;
    const candleUpperWick = candleRange > 0 ? upperWick / candleRange : 0;
    const candleLowerWick = candleRange > 0 ? lowerWick / candleRange : 0;

    const isDoji = candleBodyRatio < CANDLE_PATTERNS.dojiThreshold ? 1 : 0;
    const isHammer = this.detectHammer(kline) ? 1 : 0;
    const isEngulfing = this.detectEngulfing(klines, index) ? 1 : 0;

    const { consecutiveGreen, consecutiveRed } = this.countConsecutiveCandles(klines, index);

    return {
      rsi_2: rsi2,
      rsi_7: rsi7,
      rsi_14: rsi14,
      rsi_21: rsi21,
      rsi_change_1: rsi14 - rsiPrev1,
      rsi_change_5: rsi14 - rsiPrev5,
      macd_line: macdLine,
      macd_signal: macdSignal,
      macd_histogram: macdHistogram,
      macd_histogram_change: macdHistogram - macdHistogramPrev,
      macd_crossover: macdCrossover,
      atr_7: atr7,
      atr_14: atr14,
      atr_21: atr21,
      atr_percent: atrPercent,
      bb_width: bbWidth,
      bb_position: bbPosition,
      bb_percent_b: bbPercentB,
      ema_9: ema9,
      ema_21: ema21,
      ema_50: ema50,
      ema_200: ema200,
      ema_9_21_cross: ema9_21Cross,
      ema_50_200_cross: ema50_200Cross,
      price_vs_ema_9: priceVsEma9,
      price_vs_ema_21: priceVsEma21,
      price_vs_ema_50: priceVsEma50,
      price_vs_ema_200: priceVsEma200,
      adx_value: adxValue,
      adx_trend_strength: adxTrendStrength,
      plus_di: plusDI,
      minus_di: minusDI,
      di_crossover: diCrossover,
      stoch_k: stochK,
      stoch_d: stochD,
      stoch_crossover: stochCrossover,
      volume_sma_ratio: volumeSmaRatio,
      volume_change: volumeChange,
      obv_slope: obvSlope,
      cci_14: cci14,
      cci_20: cci20,
      williams_r: williamsR,
      mfi_14: mfi14,
      roc_12: roc12,
      keltner_upper: keltnerUpper,
      keltner_lower: keltnerLower,
      keltner_position: keltnerPosition,
      sma_20: sma20,
      sma_50: sma50,
      sma_200: sma200,
      price_vs_sma_20: priceVsSma20,
      price_vs_sma_50: priceVsSma50,
      price_vs_sma_200: priceVsSma200,
      highest_high_20: highestHigh,
      lowest_low_20: lowestLow,
      price_channel_position: priceChannelPosition,
      avg_true_range_normalized: avgTrueRangeNormalized,
      price_momentum_5: priceMomentum5,
      price_momentum_10: priceMomentum10,
      price_momentum_20: priceMomentum20,
      candle_body_ratio: candleBodyRatio,
      candle_upper_wick: candleUpperWick,
      candle_lower_wick: candleLowerWick,
      is_doji: isDoji,
      is_hammer: isHammer,
      is_engulfing: isEngulfing,
      consecutive_green: consecutiveGreen,
      consecutive_red: consecutiveRed,
    };
  }

  getFeatureNames(): string[] {
    return [...TECHNICAL_FEATURE_NAMES];
  }

  private getValue<T>(arr: T[] | undefined, index: number): T | null {
    if (!arr || index < 0 || index >= arr.length) return null;
    return arr[index] ?? null;
  }

  private detectCrossover(fast: (number | null)[], slow: (number | null)[], index: number): number {
    if (index < 1) return 0;
    const fastCurrent = fast[index];
    const slowCurrent = slow[index];
    const fastPrev = fast[index - 1];
    const slowPrev = slow[index - 1];

    if (
      fastCurrent === null ||
      slowCurrent === null ||
      fastPrev === null ||
      slowPrev === null ||
      fastCurrent === undefined ||
      slowCurrent === undefined ||
      fastPrev === undefined ||
      slowPrev === undefined ||
      isNaN(fastCurrent) ||
      isNaN(slowCurrent) ||
      isNaN(fastPrev) ||
      isNaN(slowPrev)
    ) {
      return 0;
    }

    if (fastPrev <= slowPrev && fastCurrent > slowCurrent) return 1;
    if (fastPrev >= slowPrev && fastCurrent < slowCurrent) return -1;
    return 0;
  }

  private getAdxTrendStrength(adx: number): number {
    if (adx >= ADX_TREND_THRESHOLDS.veryStrong) return 3;
    if (adx >= ADX_TREND_THRESHOLDS.strong) return 2;
    if (adx >= ADX_TREND_THRESHOLDS.moderate) return 1;
    return 0;
  }

  private calculateVolumeSMA(klines: Kline[], index: number, period: number): number {
    if (index < period - 1) return 0;
    let sum = 0;
    for (let i = 0; i < period; i++) {
      const kline = klines[index - i];
      if (kline) sum += parseFloat(kline.volume);
    }
    return sum / period;
  }

  private calculateOBVSlope(index: number): number {
    if (!this.precomputed || index < OBV_SLOPE_PERIOD) return 0;
    const obv = this.precomputed.obv;
    const current = obv[index] ?? 0;
    const previous = obv[index - OBV_SLOPE_PERIOD] ?? 0;
    if (previous === 0) return 0;
    return ((current - previous) / Math.abs(previous)) * 100;
  }

  private getPriceChannel(
    klines: Kline[],
    index: number,
    period: number
  ): { highestHigh: number; lowestLow: number } {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;

    const start = Math.max(0, index - period + 1);
    for (let i = start; i <= index; i++) {
      const kline = klines[i];
      if (!kline) continue;
      const high = parseFloat(kline.high);
      const low = parseFloat(kline.low);
      if (high > highestHigh) highestHigh = high;
      if (low < lowestLow) lowestLow = low;
    }

    if (highestHigh === -Infinity) highestHigh = 0;
    if (lowestLow === Infinity) lowestLow = 0;

    return { highestHigh, lowestLow };
  }

  private calculateMomentum(klines: Kline[], index: number, period: number): number {
    if (index < period) return 0;
    const currentClose = parseFloat(klines[index]?.close ?? '0');
    const previousClose = parseFloat(klines[index - period]?.close ?? '0');
    if (previousClose === 0) return 0;
    return ((currentClose - previousClose) / previousClose) * 100;
  }

  private detectHammer(kline: Kline): boolean {
    const open = parseFloat(kline.open);
    const close = parseFloat(kline.close);
    const high = parseFloat(kline.high);
    const low = parseFloat(kline.low);

    const bodySize = Math.abs(close - open);
    const candleRange = high - low;
    const lowerWick = Math.min(open, close) - low;
    const upperWick = high - Math.max(open, close);

    if (candleRange === 0) return false;

    const bodyRatio = bodySize / candleRange;
    const lowerWickRatio = lowerWick / bodySize;

    return (
      bodyRatio <= CANDLE_PATTERNS.hammerBodyRatio &&
      lowerWickRatio >= CANDLE_PATTERNS.hammerWickRatio &&
      upperWick < bodySize
    );
  }

  private detectEngulfing(klines: Kline[], index: number): boolean {
    if (index < 1) return false;

    const current = klines[index];
    const previous = klines[index - 1];
    if (!current || !previous) return false;

    const currentOpen = parseFloat(current.open);
    const currentClose = parseFloat(current.close);
    const previousOpen = parseFloat(previous.open);
    const previousClose = parseFloat(previous.close);

    const currentBody = Math.abs(currentClose - currentOpen);
    const previousBody = Math.abs(previousClose - previousOpen);

    if (previousBody === 0) return false;

    const isBullishEngulfing =
      previousClose < previousOpen &&
      currentClose > currentOpen &&
      currentOpen <= previousClose &&
      currentClose >= previousOpen &&
      currentBody >= previousBody * CANDLE_PATTERNS.engulfingMinRatio;

    const isBearishEngulfing =
      previousClose > previousOpen &&
      currentClose < currentOpen &&
      currentOpen >= previousClose &&
      currentClose <= previousOpen &&
      currentBody >= previousBody * CANDLE_PATTERNS.engulfingMinRatio;

    return isBullishEngulfing || isBearishEngulfing;
  }

  private countConsecutiveCandles(
    klines: Kline[],
    index: number
  ): { consecutiveGreen: number; consecutiveRed: number } {
    let consecutiveGreen = 0;
    let consecutiveRed = 0;

    for (let i = index; i >= 0; i--) {
      const kline = klines[i];
      if (!kline) break;

      const open = parseFloat(kline.open);
      const close = parseFloat(kline.close);

      if (close > open) {
        if (consecutiveRed > 0) break;
        consecutiveGreen++;
      } else if (close < open) {
        if (consecutiveGreen > 0) break;
        consecutiveRed++;
      } else {
        break;
      }
    }

    return { consecutiveGreen, consecutiveRed };
  }
}
