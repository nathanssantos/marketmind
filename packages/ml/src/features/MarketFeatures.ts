import type { Kline } from '@marketmind/types';
import type { MarketFeatureSet, MarketContext } from '../types';
import { MARKET_FEATURE_NAMES, FEAR_GREED_THRESHOLDS } from '../constants/featureConfig';

export class MarketFeatures {
  constructor(_config?: unknown) {}

  extract(
    _klines: Kline[],
    _index: number,
    marketContext?: MarketContext
  ): MarketFeatureSet {
    const fundingRate = marketContext?.fundingRate ?? 0;
    const fundingRatePercentile = this.calculateFundingRatePercentile(fundingRate);
    const fundingRateSignal = this.getFundingRateSignal(fundingRate);

    const openInterest = marketContext?.openInterest ?? 0;
    const openInterestChange1h = marketContext?.openInterestChange1h ?? 0;
    const openInterestChange24h = marketContext?.openInterestChange24h ?? 0;
    const oiPriceDivergence = 0;

    const takerBuyRatio = marketContext?.takerBuyRatio ?? 0.5;
    const deltaVolume = (takerBuyRatio - 0.5) * 2;
    const deltaVolumeCumulative5 = deltaVolume;
    const largeTradeCount = 0;

    const fearGreedIndex = marketContext?.fearGreedIndex ?? 50;
    const fearGreedCategory = this.getFearGreedCategory(fearGreedIndex);
    const fearGreedChange7d = 0;

    const btcDominance = marketContext?.btcDominance ?? 50;
    const btcDominanceChange24h = marketContext?.btcDominanceChange24h ?? 0;
    const btcDominanceChange7d = marketContext?.btcDominanceChange7d ?? 0;

    const longLiquidations24h = marketContext?.longLiquidations24h ?? 0;
    const shortLiquidations24h = marketContext?.shortLiquidations24h ?? 0;
    const totalLiquidations = longLiquidations24h + shortLiquidations24h;
    const liquidationRatio =
      totalLiquidations > 0 ? longLiquidations24h / totalLiquidations : 0.5;

    return {
      funding_rate: fundingRate,
      funding_rate_percentile: fundingRatePercentile,
      funding_rate_signal: fundingRateSignal,
      open_interest: openInterest,
      open_interest_change_1h: openInterestChange1h,
      open_interest_change_24h: openInterestChange24h,
      oi_price_divergence: oiPriceDivergence,
      taker_buy_ratio: takerBuyRatio,
      delta_volume: deltaVolume,
      delta_volume_cumulative_5: deltaVolumeCumulative5,
      large_trade_count: largeTradeCount,
      fear_greed_index: fearGreedIndex,
      fear_greed_category: fearGreedCategory,
      fear_greed_change_7d: fearGreedChange7d,
      btc_dominance: btcDominance,
      btc_dominance_change_24h: btcDominanceChange24h,
      btc_dominance_change_7d: btcDominanceChange7d,
      long_liquidations_24h: longLiquidations24h,
      short_liquidations_24h: shortLiquidations24h,
      liquidation_ratio: liquidationRatio,
    };
  }

  getFeatureNames(): string[] {
    return [...MARKET_FEATURE_NAMES];
  }

  private calculateFundingRatePercentile(fundingRate: number): number {
    const normalFundingRange = 0.01;
    const percentile = ((fundingRate + normalFundingRange) / (2 * normalFundingRange)) * 100;
    return Math.max(0, Math.min(100, percentile));
  }

  private getFundingRateSignal(fundingRate: number): number {
    const highThreshold = 0.005;
    const lowThreshold = -0.005;

    if (fundingRate > highThreshold) return -1;
    if (fundingRate < lowThreshold) return 1;
    return 0;
  }

  private getFearGreedCategory(index: number): number {
    if (index < FEAR_GREED_THRESHOLDS.extremeFear) return 0;
    if (index < FEAR_GREED_THRESHOLDS.fear) return 1;
    if (index < FEAR_GREED_THRESHOLDS.neutral) return 2;
    if (index < FEAR_GREED_THRESHOLDS.greed) return 3;
    return 4;
  }
}
