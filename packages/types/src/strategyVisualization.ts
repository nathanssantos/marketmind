export type CandleRole = 'reference' | 'confirmation' | 'trigger' | 'context';

export interface StrategyCandleEducation {
  offset: number;
  role: CandleRole;
  descriptionKey: string;
}

export interface StrategyCandlePattern {
  lookback: number;
  candles: StrategyCandleEducation[];
  indicatorsToShow: string[];
}

export interface StrategyHowItWorks {
  summaryKey: string;
  entryKey: string;
  exitKey: string;
}

export interface StrategyEducation {
  origin: string;
  createdYear?: number;
  candlePattern: StrategyCandlePattern;
  howItWorks: StrategyHowItWorks;
}

export interface TriggerCandleSnapshot {
  offset: number;
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TriggerIndicatorValues {
  ema9?: number;
  ema9Prev?: number;
  ema9Prev2?: number;
  atr14?: number;
  atr?: number;
  volumeSMA20?: number;
  ema200?: number;
  rsi?: number;
  stochK?: number;
  stochD?: number;
  macdLine?: number;
  macdSignal?: number;
  macdHist?: number;
  adx?: number;
  plusDI?: number;
  minusDI?: number;
  bbUpper?: number;
  bbMiddle?: number;
  bbLower?: number;
  keltnerUpper?: number;
  keltnerMiddle?: number;
  keltnerLower?: number;
  supertrend?: number;
  parabolicSar?: number;
  ppo?: number;
  ppoSignal?: number;
  elderBullPower?: number;
  elderBearPower?: number;
  tema?: number;
  williamsR?: number;
  percentB?: number;
  [key: string]: number | undefined;
}

export interface StrategyPerformanceStats {
  totalTrades: number;
  winRate: number;
  avgWinPercent: number;
  avgLossPercent: number;
  avgRiskReward: number;
  maxDrawdown: number;
  lastTradeAt?: string;
}

export interface StrategyVisualizationData {
  strategyId: string;
  strategyName: string;
  triggerKlineIndex: number;
  triggerOpenTime: number;
  patternCandles: TriggerCandleSnapshot[];
  indicatorValues: TriggerIndicatorValues;
  education: StrategyEducation | null;
  performance: StrategyPerformanceStats | null;
}

export interface HighlightedCandle {
  index: number;
  offset: number;
  role: CandleRole;
}

export interface StrategyVisualizationState {
  highlightedCandles: HighlightedCandle[];
  activeStrategyId: string | null;
  activeExecutionId: string | null;
  popoverData: StrategyVisualizationData | null;
  isLoading: boolean;
}
