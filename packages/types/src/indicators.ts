import type { PivotPoint } from './tradingSetup';
import type { TrendDirection } from './filters';

// --- Indicator constants (formerly in indicator-constants.ts) ---

export const INDICATOR_PERIODS = {
  RSI_DEFAULT: 14,
  ADX_DEFAULT: 14,
  ATR_DEFAULT: 14,
  EMA_FAST: 9,
  EMA_MEDIUM: 20,
  EMA_SLOW: 50,
  EMA_TREND: 200,
  MACD_FAST: 12,
  MACD_SLOW: 26,
  MACD_SIGNAL: 9,
  VOLUME_LOOKBACK: 20,
  STOCHASTIC_K: 14,
  STOCHASTIC_D: 3,
  STOCHASTIC_SMOOTH: 3,
  BOLLINGER_PERIOD: 20,
  BOLLINGER_STD_DEV: 2,
} as const;

export const FILTER_THRESHOLDS = {
  ADX_TREND: 20,
  ADX_MIN: 25,
  ADX_STRONG: 40,
  ADX_VERY_STRONG: 45,
  RSI_OVERBOUGHT: 70,
  RSI_OVERSOLD: 30,
  RSI_NEUTRAL_HIGH: 60,
  RSI_NEUTRAL_LOW: 40,
  STOCHASTIC_OVERBOUGHT: 80,
  STOCHASTIC_OVERSOLD: 20,
  CORRELATION_HIGH: 0.7,
  CORRELATION_LOW: 0.3,
  CORRELATION_NEGATIVE: -0.3,
  VOLUME_SPIKE_MULTIPLIER: 1.5,
  VOLUME_CONFIRMATION_MULTIPLIER: 1.2,
  VERY_HIGH_VOLATILITY_ATR: 4.0,
} as const;

export type IndicatorPeriodsConstants = typeof INDICATOR_PERIODS;
export type FilterThresholdsConstants = typeof FILTER_THRESHOLDS;

// --- adx.ts ---

export interface ADXResult {
  adx: (number | null)[];
  plusDI: (number | null)[];
  minusDI: (number | null)[];
}

// --- ao.ts ---

export interface AOResult {
  values: (number | null)[];
}

// --- aroon.ts ---

export interface AroonResult {
  aroonUp: (number | null)[];
  aroonDown: (number | null)[];
  oscillator: (number | null)[];
}

// --- bollingerBands.ts ---

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
}

// --- btcDominance.ts ---

export interface BTCDominanceData {
  timestamp: number;
  dominance: number;
  totalMarketCap?: number;
  btcMarketCap?: number;
}

export interface BTCDominanceResult {
  current: number | null;
  change: number | null;
  change7d: number | null;
  change30d: number | null;
  trend: 'rising' | 'falling' | 'stable';
  altcoinSeason: boolean;
}

export interface BTCDominanceConfig {
  altcoinSeasonThreshold: number;
  trendPeriod: number;
  changeThreshold: number;
}

// --- cci.ts ---

export type CCIResult = (number | null)[];

// --- choppiness.ts ---

export const CHOPPINESS_FILTER = {
  DEFAULT_PERIOD: 14,
  HIGH_THRESHOLD: 61.8,
  LOW_THRESHOLD: 38.2,
} as const;

export interface ChoppinessResult {
  value: number | null;
  isChoppy: boolean;
  isTrending: boolean;
}

// --- cmf.ts ---

export interface CMFResult {
  values: (number | null)[];
}

// --- cmo.ts ---

export interface CMOResult {
  values: (number | null)[];
}

// --- cumulativeRsi.ts ---

export interface CumulativeRSIResult {
  values: (number | null)[];
  rsiValues: (number | null)[];
}

// --- deltaVolume.ts ---

export interface DeltaVolumeResult {
  delta: number[];
  cumulativeDelta: number[];
  buyVolume: number[];
  sellVolume: number[];
}

// --- dema.ts ---

export interface DEMAResult {
  values: (number | null)[];
}

// --- dmi.ts ---

export interface DMIResult {
  plusDI: (number | null)[];
  minusDI: (number | null)[];
  dx: (number | null)[];
}

// --- donchian.ts ---

export interface DonchianResult {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
}

// --- elderRay.ts ---

export interface ElderRayResult {
  bullPower: (number | null)[];
  bearPower: (number | null)[];
}

// --- fibonacci.ts ---

export interface FibonacciLevel {
  level: number;
  price: number;
  label: string;
}

export interface FibonacciResult {
  levels: FibonacciLevel[];
  swingHigh: number;
  swingLow: number;
  direction: 'up' | 'down';
}

// --- floorPivots.ts ---

export interface FloorPivotLevels {
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

export type FloorPivotType = 'standard' | 'fibonacci' | 'woodie' | 'camarilla' | 'demark';

export interface FloorPivotInput {
  high: number;
  low: number;
  close: number;
  open?: number;
}

export interface FloorPivotSeriesResult {
  pivot: (number | null)[];
  r1: (number | null)[];
  r2: (number | null)[];
  r3: (number | null)[];
  s1: (number | null)[];
  s2: (number | null)[];
  s3: (number | null)[];
}

// --- fundingRate.ts ---

export interface FundingRateData {
  timestamp: number;
  rate: number;
  symbol?: string;
}

export interface FundingRateResult {
  current: number | null;
  average: number | null;
  cumulative: number | null;
  isExtreme: boolean;
  direction: 'positive' | 'negative' | 'neutral';
}

export interface FundingRateConfig {
  extremeThreshold: number;
  averagePeriod: number;
}

// --- fvg.ts ---

export interface FairValueGap {
  index: number;
  type: 'bullish' | 'bearish';
  high: number;
  low: number;
  filled: boolean;
  timestamp: number;
}

export interface FVGResult {
  gaps: FairValueGap[];
  bullishFVG: (FairValueGap | null)[];
  bearishFVG: (FairValueGap | null)[];
}

// --- gapDetection.ts ---

export interface Gap {
  index: number;
  type: 'up' | 'down';
  gapHigh: number;
  gapLow: number;
  size: number;
  percentSize: number;
  filled: boolean;
  timestamp: number;
}

export interface GapDetectionResult {
  gaps: Gap[];
  gapUp: (Gap | null)[];
  gapDown: (Gap | null)[];
}

// --- halvingCycle.ts ---

export interface HalvingCycleResult {
  phase: (string | null)[];
  daysFromHalving: (number | null)[];
  cycleProgress: (number | null)[];
}

// --- hma.ts ---

export interface HMAResult {
  values: (number | null)[];
}

// --- ibs.ts ---

export interface IBSResult {
  values: (number | null)[];
}

// --- ichimoku.ts ---

export interface IchimokuResult {
  tenkan: (number | null)[];
  kijun: (number | null)[];
  senkouA: (number | null)[];
  senkouB: (number | null)[];
  chikou: (number | null)[];
}

// --- keltner.ts ---

export interface KeltnerResult {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
}

// --- klinger.ts ---

export interface KlingerResult {
  kvo: (number | null)[];
  signal: (number | null)[];
}

// --- liquidations.ts ---

export interface LiquidationData {
  timestamp: number;
  longLiquidations: number;
  shortLiquidations: number;
  totalLiquidations: number;
  symbol?: string;
}

export interface LiquidationResult {
  longLiquidations: number;
  shortLiquidations: number;
  totalLiquidations: number;
  dominantSide: 'long' | 'short' | 'balanced';
  isCascade: boolean;
  cascadeStrength: number;
}

export interface LiquidationConfig {
  cascadeThreshold: number;
  lookbackPeriods: number;
  imbalanceThreshold: number;
}

// --- liquidityLevels.ts ---

export interface LiquidityLevel {
  price: number;
  type: 'support' | 'resistance';
  strength: number;
  touches: number;
  firstIndex: number;
  lastIndex: number;
}

export interface LiquidityZone {
  high: number;
  low: number;
  type: 'support' | 'resistance';
  strength: number;
  touches: number;
}

export interface LiquidityLevelsConfig {
  lookback: number;
  tolerance: number;
  minTouches: number;
  strengthDecay: number;
}

// --- macd.ts ---

export interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

// --- marketStructure.ts ---

export interface MarketStructureAnalysis {
  trend: 'UPTREND' | 'DOWNTREND' | 'RANGING';
  higherHighs: number;
  higherLows: number;
  lowerHighs: number;
  lowerLows: number;
  lastSwingHigh: SwingPoint | null;
  lastSwingLow: SwingPoint | null;
  confidence: number;
}

export interface StructureConfig {
  lookback?: number;
  minSwingsForTrend?: number;
}

export const MARKET_STRUCTURE_DEFAULTS = {
  LOOKBACK: 50,
  MIN_SWINGS_FOR_TREND: 2,
} as const;

// --- massIndex.ts ---

export interface MassIndexResult {
  values: (number | null)[];
}

// --- mfi.ts ---

export type MFIResult = (number | null)[];

// --- movingAverages.ts ---

export interface MovingAverageData {
  period: number;
  type: 'SMA' | 'EMA';
  values: (number | null)[];
  color: string;
}

export interface MAConfig {
  period: number;
  type: 'SMA' | 'EMA';
  color: string;
  enabled: boolean;
}

export interface MAResult {
  period: number;
  type: 'SMA' | 'EMA';
  color: string;
  values: (number | null)[];
}

// --- nDayHighLow.ts ---

export interface NDayHighLowResult {
  isNDayHigh: boolean[];
  isNDayLow: boolean[];
  highestClose: (number | null)[];
  lowestClose: (number | null)[];
  highestHigh: (number | null)[];
  lowestLow: (number | null)[];
}

// --- nr7.ts ---

export interface NR7Result {
  isNR7: boolean[];
  ranges: (number | null)[];
  minRange: (number | null)[];
}

export interface NR7BreakoutLevels {
  longEntry: (number | null)[];
  shortEntry: (number | null)[];
  longStop: (number | null)[];
  shortStop: (number | null)[];
  targetMultiplier: number;
}

// --- obv.ts ---

export interface OBVResult {
  values: number[];
  sma: (number | null)[];
}

// --- openInterest.ts ---

export interface OpenInterestData {
  timestamp: number;
  value: number;
  symbol?: string;
}

export interface OpenInterestResult {
  current: number | null;
  change: number | null;
  changePercent: number | null;
  trend: 'increasing' | 'decreasing' | 'stable';
  divergence: 'bullish' | 'bearish' | 'none';
}

export interface OpenInterestConfig {
  lookback: number;
  changeThreshold: number;
  trendPeriod: number;
}

// --- parabolicSar.ts ---

export interface ParabolicSARResult {
  sar: (number | null)[];
  trend: ('up' | 'down' | null)[];
}

// --- percentB.ts ---

export interface PercentBResult {
  values: (number | null)[];
}

// --- pivotPoints.ts ---

export type PivotStrength = 'weak' | 'medium' | 'strong';

export interface EnhancedPivotPoint extends PivotPoint {
  strength: PivotStrength;
  volumeConfirmed: boolean;
  volumeRatio: number;
  priceDistance: number;
}

export interface PivotDetectionConfig {
  lookback?: number;
  lookahead?: number;
  volumeLookback?: number;
  volumeMultiplier?: number;
  minPriceDistancePercent?: number;
}

export interface PivotAnalysis {
  pivots: EnhancedPivotPoint[];
  resistanceLevels: number[];
  supportLevels: number[];
  nearestResistance: number | null;
  nearestSupport: number | null;
}

// --- ppo.ts ---

export interface PPOResult {
  ppo: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

// --- relativeStrength.ts ---

export interface RelativeStrengthResult {
  ratio: number | null;
  change: number | null;
  changePercent: number | null;
  outperforming: boolean;
  strength: 'strong' | 'moderate' | 'weak' | 'underperforming';
}

export interface RelativeStrengthConfig {
  period: number;
  outperformThreshold: number;
}

// --- roc.ts ---

export interface ROCResult {
  values: (number | null)[];
}

// --- rsi.ts ---

export interface RSIResult {
  values: (number | null)[];
}

// --- stochRsi.ts ---

export interface StochRSIResult {
  k: (number | null)[];
  d: (number | null)[];
}

// --- stochastic.ts ---

export interface StochasticResult {
  k: (number | null)[];
  d: (number | null)[];
}

export interface StochasticConfig {
  kPeriod: number;
  kSmoothing: number;
  dPeriod: number;
  enabled: boolean;
  kColor: string;
  dColor: string;
  overboughtLevel: number;
  oversoldLevel: number;
}

// --- supertrend.ts ---

export interface SupertrendResult {
  trend: ('up' | 'down' | null)[];
  value: (number | null)[];
}

// --- swingPoints.ts ---

export interface SwingPoint {
  index: number;
  type: 'high' | 'low';
  price: number;
  timestamp: number;
}

export interface SwingPointsResult {
  swingHighs: (number | null)[];
  swingLows: (number | null)[];
  swingPoints: SwingPoint[];
}

export interface SwingPointConfig {
  lookback?: number;
  fractalBarsLeft?: number;
  fractalBarsRight?: number;
}

export const SWING_POINT_DEFAULTS = {
  LOOKBACK: 5,
  FRACTAL_BARS_LEFT: 2,
  FRACTAL_BARS_RIGHT: 2,
} as const;

// --- swingPointStructure.ts ---

export interface MarketStructure {
  type: 'uptrend' | 'downtrend' | 'ranging';
  higherHighs: SwingPoint[];
  higherLows: SwingPoint[];
  lowerHighs: SwingPoint[];
  lowerLows: SwingPoint[];
  breakOfStructure: boolean;
}

// --- tema.ts ---

export interface TEMAResult {
  values: (number | null)[];
}

// --- trendAlignment.ts ---

export interface TrendAlignmentConfig {
  adxPeriod?: number;
  adxThreshold?: number;
  emaPeriod?: number;
  emaConfirmBars?: number;
  rsiPeriod?: number;
  rsiLowerBound?: number;
  rsiUpperBound?: number;
}

export interface TrendInfo {
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  isClearTrend: boolean;
  strength: number;
  adx: number;
  priceVsEma: 'ABOVE' | 'BELOW' | 'CROSSING';
  rsi: number;
}

export interface TrendAlignmentResult {
  asset: TrendInfo;
  btc: TrendInfo;
  isAligned: boolean;
  alignmentScore: number;
  recommendation: 'TRADE' | 'SKIP' | 'CAUTION';
  reason: string;
}

export const TREND_ALIGNMENT_DEFAULTS = {
  ADX_PERIOD: 14,
  ADX_THRESHOLD: 25,
  EMA_PERIOD: 21,
  EMA_CONFIRM_BARS: 3,
  RSI_PERIOD: 14,
  RSI_LOWER_BOUND: 30,
  RSI_UPPER_BOUND: 70,
  MIN_KLINES: 50,
} as const;

// --- trendCore.ts ---

export type TrendMethod = 'ema' | 'adx' | 'supertrend' | 'combined' | 'macd';

export interface TrendDetectionResult {
  direction: TrendDirection;
  isClearTrend: boolean;
  strength: number;
  method: TrendMethod;
  details: TrendDetails;
}

export interface TrendDetails {
  ema?: { value: number; period: number; pricePosition: 'above' | 'below' | 'crossing' };
  adx?: { value: number; plusDI: number; minusDI: number; isStrong: boolean };
  supertrend?: { value: number; trend: 'up' | 'down' };
  macd?: { histogram: number; signal: number; macdLine: number };
  rsi?: { value: number };
  price: number;
}

export interface TrendCoreConfig {
  method: TrendMethod;
  emaPeriod?: number;
  emaConfirmBars?: number;
  adxPeriod?: number;
  adxThreshold?: number;
  supertrendPeriod?: number;
  supertrendMultiplier?: number;
  rsiPeriod?: number;
}

// --- tsi.ts ---

export interface TSIResult {
  tsi: (number | null)[];
  signal: (number | null)[];
}

// --- ultimateOscillator.ts ---

export interface UltimateOscillatorResult {
  values: (number | null)[];
}

// --- validation.ts ---

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// --- volumeUtils.ts ---

export interface VolumeAnalysis {
  average: number;
  current: number;
  ratio: number;
  isSpike: boolean;
}

// --- vortex.ts ---

export interface VortexResult {
  viPlus: (number | null)[];
  viMinus: (number | null)[];
}

// --- williamsR.ts ---

export type WilliamsRResult = (number | null)[];

// --- wma.ts ---

export interface WMAResult {
  values: (number | null)[];
}
