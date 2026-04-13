export interface ADXResult {
  adx: (number | null)[];
  plusDI: (number | null)[];
  minusDI: (number | null)[];
}

export interface AOResult {
  values: (number | null)[];
}

export interface AroonResult {
  aroonUp: (number | null)[];
  aroonDown: (number | null)[];
  oscillator: (number | null)[];
}

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
}

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

export type CCIResult = (number | null)[];

export interface ChoppinessResult {
  value: number | null;
  isChoppy: boolean;
  isTrending: boolean;
}

export const CHOPPINESS_FILTER = {
  DEFAULT_PERIOD: 14,
  HIGH_THRESHOLD: 61.8,
  LOW_THRESHOLD: 38.2,
} as const;

export interface CMFResult {
  values: (number | null)[];
}

export interface CMOResult {
  values: (number | null)[];
}

export interface CumulativeRSIResult {
  values: (number | null)[];
  rsiValues: (number | null)[];
}

export interface DeltaVolumeResult {
  delta: number[];
  cumulativeDelta: number[];
  buyVolume: number[];
  sellVolume: number[];
}

export interface DEMAResult {
  values: (number | null)[];
}

export interface DMIResult {
  plusDI: (number | null)[];
  minusDI: (number | null)[];
  dx: (number | null)[];
}

export interface DonchianResult {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
}

export interface ElderRayResult {
  bullPower: (number | null)[];
  bearPower: (number | null)[];
}

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

export interface HalvingCycleResult {
  phase: (string | null)[];
  daysFromHalving: (number | null)[];
  cycleProgress: (number | null)[];
}

export interface HMAResult {
  values: (number | null)[];
}

export interface IBSResult {
  values: (number | null)[];
}

export interface IchimokuResult {
  tenkan: (number | null)[];
  kijun: (number | null)[];
  senkouA: (number | null)[];
  senkouB: (number | null)[];
  chikou: (number | null)[];
}

export interface KeltnerResult {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
}

export interface KlingerResult {
  kvo: (number | null)[];
  signal: (number | null)[];
}

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

export interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

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

export interface MarketStructure {
  type: 'uptrend' | 'downtrend' | 'ranging';
  higherHighs: SwingPoint[];
  higherLows: SwingPoint[];
  lowerHighs: SwingPoint[];
  lowerLows: SwingPoint[];
  breakOfStructure: boolean;
}

export interface MassIndexResult {
  values: (number | null)[];
}

export type MFIResult = (number | null)[];

export interface OBVResult {
  values: number[];
  sma: (number | null)[];
}

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

export interface ParabolicSARResult {
  sar: (number | null)[];
  trend: ('up' | 'down' | null)[];
}

export interface PercentBResult {
  values: (number | null)[];
}

export interface PPOResult {
  ppo: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

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

export interface ROCResult {
  values: (number | null)[];
}

export interface RSIResult {
  values: (number | null)[];
}

export interface StochRSIResult {
  k: (number | null)[];
  d: (number | null)[];
}

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

export interface SupertrendResult {
  trend: ('up' | 'down' | null)[];
  value: (number | null)[];
}

export interface TEMAResult {
  values: (number | null)[];
}

export interface TSIResult {
  tsi: (number | null)[];
  signal: (number | null)[];
}

export interface UltimateOscillatorResult {
  values: (number | null)[];
}

export interface VortexResult {
  viPlus: (number | null)[];
  viMinus: (number | null)[];
}

export type WilliamsRResult = (number | null)[];

export interface WMAResult {
  values: (number | null)[];
}

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

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface VolumeAnalysis {
  average: number;
  current: number;
  ratio: number;
  isSpike: boolean;
}

export interface NDayHighLowResult {
  isNDayHigh: boolean[];
  isNDayLow: boolean[];
  highestClose: (number | null)[];
  lowestClose: (number | null)[];
  highestHigh: (number | null)[];
  lowestLow: (number | null)[];
}

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
