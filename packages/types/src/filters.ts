export interface BaseFilterResult {
  isAllowed: boolean;
  reason: string;
}

export type TrendDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type TrendStrength = 'STRONG' | 'MODERATE' | 'WEAK';
export type RsiMomentum = 'RISING' | 'FALLING' | 'NEUTRAL';

export type BtcTrend = TrendDirection;
export type HtfTrend = TrendDirection;

export interface BtcCorrelationResult extends BaseFilterResult {
  btcTrend: BtcTrend;
  btcStrength: TrendStrength;
  btcEma21: number | null;
  btcPrice: number | null;
  btcMacdHistogram: number | null;
  btcRsi: number | null;
  btcRsiMomentum: RsiMomentum;
  isAltcoin: boolean;
  correlationScore: number;
}

export interface MtfFilterResult extends BaseFilterResult {
  htfTrend: HtfTrend;
  htfInterval: string | null;
  ema50: number | null;
  ema200: number | null;
  price: number | null;
  goldenCross: boolean;
  deathCross: boolean;
  priceAboveEma50: boolean;
  priceAboveEma200: boolean;
}

export type MarketRegime = 'TRENDING' | 'WEAK_TREND' | 'RANGING' | 'VOLATILE';
export type StrategyType = 'TREND_FOLLOWING' | 'MEAN_REVERSION' | 'ANY';
export type SetupStrategyType = StrategyType;
export type SetupMomentumType = 'BREAKOUT' | 'PULLBACK' | 'REVERSAL' | 'ANY';
export type MarketVolatilityLevel = 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME';

export interface MarketRegimeResult extends BaseFilterResult {
  regime: MarketRegime;
  adx: number | null;
  plusDI: number | null;
  minusDI: number | null;
  atr: number | null;
  atrPercentile: number | null;
  volatilityLevel: MarketVolatilityLevel;
  recommendedStrategy: StrategyType;
}

export type FundingLevel = 'NORMAL' | 'WARNING' | 'EXTREME';
export type FundingSignal = 'LONG_CONTRARIAN' | 'SHORT_CONTRARIAN' | 'NEUTRAL';

export interface FundingFilterResult extends BaseFilterResult {
  currentRate: number | null;
  fundingLevel: FundingLevel;
  signal: FundingSignal;
  nextFundingTime: Date | null;
}

export type SetupVolumeType = 'BREAKOUT' | 'PULLBACK' | 'REVERSAL' | 'ANY';
export type ObvTrend = 'RISING' | 'FALLING' | 'FLAT';

export interface VolumeFilterResult extends BaseFilterResult {
  currentVolume: number | null;
  averageVolume: number | null;
  volumeRatio: number | null;
  isVolumeSpike: boolean;
  obvTrend: ObvTrend;
}

export interface StochasticFilterResult extends BaseFilterResult {
  currentK: number | null;
  currentD: number | null;
  isOversold: boolean;
  isOverbought: boolean;
}

export interface MomentumTimingResult extends BaseFilterResult {
  rsiValue: number | null;
  rsiPrevValue: number | null;
  rsiMomentum: RsiMomentum;
  mfiValue: number | null;
  mfiConfirmation: boolean;
}

export interface AdxFilterResult extends BaseFilterResult {
  adx: number | null;
  plusDI: number | null;
  minusDI: number | null;
  isBullish: boolean;
  isBearish: boolean;
  isStrongTrend: boolean;
}

export interface TrendFilterResult extends BaseFilterResult {
  ema21: number | null;
  price: number | null;
  isBullish: boolean;
  isBearish: boolean;
}

export type RecommendationLevel = 'STRONG_ENTRY' | 'MODERATE_ENTRY' | 'WEAK_ENTRY' | 'NO_ENTRY';

export interface FilterContribution {
  filterName: string;
  passed: boolean;
  score: number;
  maxScore: number;
  reason: string;
}

export interface ConfluenceResult extends BaseFilterResult {
  totalScore: number;
  maxPossibleScore: number;
  scorePercent: number;
  contributions: FilterContribution[];
  alignmentBonus: number;
  recommendation: RecommendationLevel;
}

export interface ChoppinessFilterResult extends BaseFilterResult {
  choppinessValue: number | null;
  isChoppy: boolean;
  isTrending: boolean;
}

export interface SessionFilterResult extends BaseFilterResult {
  currentHourUtc: number;
  isInSession: boolean;
}

export interface BollingerSqueezeFilterResult extends BaseFilterResult {
  bbWidth: number | null;
  isSqueezing: boolean;
}

export type PriceVsVwap = 'ABOVE' | 'BELOW' | 'AT';

export interface VwapFilterResult extends BaseFilterResult {
  vwap: number | null;
  currentPrice: number | null;
  priceVsVwap: PriceVsVwap | null;
}

export type SupertrendTrend = 'up' | 'down';

export interface SupertrendFilterResult extends BaseFilterResult {
  trend: SupertrendTrend | null;
  value: number | null;
}

export type MarketDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface DirectionFilterResult extends BaseFilterResult {
  direction: MarketDirection;
  ema200: number | null;
  ema200Slope: number | null;
  currentPrice: number;
  priceVsEma200Percent: number | null;
}

export interface DirectionFilterConfig {
  enableLongInBearMarket?: boolean;
  enableShortInBullMarket?: boolean;
}

export interface FilterResults {
  mtf?: MtfFilterResult | null;
  btcCorrelation?: BtcCorrelationResult | null;
  marketRegime?: MarketRegimeResult | null;
  volume?: VolumeFilterResult | null;
  fundingRate?: FundingFilterResult | null;
  stochastic?: StochasticFilterResult | null;
  momentumTiming?: MomentumTimingResult | null;
  adx?: AdxFilterResult | null;
  trend?: TrendFilterResult | null;
  direction?: DirectionFilterResult | null;
  choppiness?: ChoppinessFilterResult | null;
  session?: SessionFilterResult | null;
  bollingerSqueeze?: BollingerSqueezeFilterResult | null;
  vwap?: VwapFilterResult | null;
  supertrend?: SupertrendFilterResult | null;
  trendAllowed?: boolean;
  adxValue?: number | null;
}
