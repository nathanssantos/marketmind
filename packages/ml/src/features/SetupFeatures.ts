import type { Kline, TradingSetup } from '@marketmind/types';
import type { SetupFeatureSet } from '../types';
import { calculateEMA, calculateATR } from '@marketmind/indicators';
import { SETUP_FEATURE_NAMES, SETUP_TYPE_ENCODING_LENGTH, EMA_PERIODS } from '../constants/featureConfig';

const KNOWN_SETUP_TYPES = [
  'keltner-breakout-optimized',
  'bollinger-breakout-crypto',
  'larry-williams-9-1',
  'larry-williams-9-2',
  'larry-williams-9-3',
  'larry-williams-9-4',
  'williams-momentum',
  'tema-momentum',
  'elder-ray-crypto',
  'ppo-momentum',
  'parabolic-sar-crypto',
  'supertrend-follow',
  'mean-reversion',
  'breakout',
  'pullback',
  'trend-continuation',
  'rsi-oversold',
  'rsi-overbought',
  'macd-crossover',
  'other',
] as const;

export class SetupFeatures {
  private recentSetupResults: Map<string, boolean[]> = new Map();

  constructor(_config?: unknown) {}

  extract(setup: TradingSetup, klines: Kline[], index: number): SetupFeatureSet {
    const setupTypeEncoded = this.encodeSetupType(setup.type);
    const setupDirection = setup.direction === 'LONG' ? 1 : -1;
    const setupConfidenceOriginal = setup.confidence;
    const riskRewardRatio = setup.riskRewardRatio;
    const volumeConfirmation = setup.volumeConfirmation ? 1 : 0;
    const indicatorConfluence = setup.indicatorConfluence;

    const entryPrice = setup.entryPrice;
    const kline = klines[index];
    const close = kline ? parseFloat(kline.close) : entryPrice;

    const ema9Values = calculateEMA(klines.slice(0, index + 1), EMA_PERIODS[0]);
    const ema21Values = calculateEMA(klines.slice(0, index + 1), EMA_PERIODS[1]);
    const ema200Values = calculateEMA(klines.slice(0, index + 1), EMA_PERIODS[3]);

    const ema9 = ema9Values[ema9Values.length - 1] ?? close;
    const ema21 = ema21Values[ema21Values.length - 1] ?? close;
    const ema200 = ema200Values[ema200Values.length - 1] ?? close;

    const entryVsEma9 = ema9 > 0 ? ((entryPrice - ema9) / ema9) * 100 : 0;
    const entryVsEma21 = ema21 > 0 ? ((entryPrice - ema21) / ema21) * 100 : 0;
    const entryVsEma200 = ema200 > 0 ? ((entryPrice - ema200) / ema200) * 100 : 0;

    const atrValues = calculateATR(klines.slice(0, index + 1), 14);
    const atr = atrValues[atrValues.length - 1] ?? 0;
    const entryVsAtr = atr > 0 ? entryPrice / atr : 0;

    const stopLoss = setup.stopLoss ?? entryPrice;
    const takeProfit = setup.takeProfit ?? entryPrice;
    const stopLossDistance = Math.abs(entryPrice - stopLoss);
    const takeProfitDistance = Math.abs(takeProfit - entryPrice);

    const stopLossAtrMultiple = atr > 0 ? stopLossDistance / atr : 0;
    const takeProfitAtrMultiple = atr > 0 ? takeProfitDistance / atr : 0;

    const barsSinceLastSetup = this.getBarsSinceLastSetup(setup, klines, index);
    const recentSetupWinRate = this.getRecentSetupWinRate(setup.type);

    return {
      setup_type_encoded: setupTypeEncoded,
      setup_direction: setupDirection,
      setup_confidence_original: setupConfidenceOriginal,
      risk_reward_ratio: riskRewardRatio,
      volume_confirmation: volumeConfirmation,
      indicator_confluence: indicatorConfluence,
      entry_vs_ema_9: entryVsEma9,
      entry_vs_ema_21: entryVsEma21,
      entry_vs_ema_200: entryVsEma200,
      entry_vs_atr: entryVsAtr,
      stop_loss_atr_multiple: stopLossAtrMultiple,
      take_profit_atr_multiple: takeProfitAtrMultiple,
      bars_since_last_setup: barsSinceLastSetup,
      recent_setup_win_rate: recentSetupWinRate,
    };
  }

  getFeatureNames(): string[] {
    const baseNames = [...SETUP_FEATURE_NAMES];
    const encodingNames = Array.from(
      { length: SETUP_TYPE_ENCODING_LENGTH },
      (_, i) => `setup_type_${i}`
    );
    return [...encodingNames, ...baseNames];
  }

  recordSetupOutcome(setupType: string, isWinner: boolean): void {
    const results = this.recentSetupResults.get(setupType) ?? [];
    results.push(isWinner);
    if (results.length > 50) {
      results.shift();
    }
    this.recentSetupResults.set(setupType, results);
  }

  private encodeSetupType(type: string): number[] {
    const encoded = new Array(SETUP_TYPE_ENCODING_LENGTH).fill(0);

    const normalizedType = type.toLowerCase().replace(/_/g, '-');
    let index = KNOWN_SETUP_TYPES.indexOf(normalizedType as typeof KNOWN_SETUP_TYPES[number]);

    if (index === -1) {
      for (let i = 0; i < KNOWN_SETUP_TYPES.length; i++) {
        const setupType = KNOWN_SETUP_TYPES[i];
        if (setupType && normalizedType.includes(setupType)) {
          index = i;
          break;
        }
      }
    }

    if (index === -1) {
      index = KNOWN_SETUP_TYPES.length - 1;
    }

    if (index < SETUP_TYPE_ENCODING_LENGTH) {
      encoded[index] = 1;
    }

    return encoded;
  }

  private getBarsSinceLastSetup(
    _currentSetup: TradingSetup,
    _klines: Kline[],
    _index: number
  ): number {
    return 10;
  }

  private getRecentSetupWinRate(setupType: string): number {
    const results = this.recentSetupResults.get(setupType);
    if (!results || results.length === 0) return 0.5;

    const wins = results.filter((r) => r).length;
    return wins / results.length;
  }
}
