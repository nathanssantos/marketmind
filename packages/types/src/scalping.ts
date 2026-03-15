export interface AggTrade {
  tradeId: number;
  symbol: string;
  price: number;
  quantity: number;
  quoteQuantity: number;
  isBuyerMaker: boolean;
  timestamp: number;
  marketType: 'FUTURES' | 'SPOT';
}

export interface BookTickerUpdate {
  symbol: string;
  bidPrice: number;
  bidQty: number;
  askPrice: number;
  askQty: number;
  microprice: number;
  spread: number;
  spreadPercent: number;
  timestamp: number;
}

export interface DepthLevel {
  price: number;
  quantity: number;
}

export interface DepthUpdate {
  symbol: string;
  bids: DepthLevel[];
  asks: DepthLevel[];
  lastUpdateId: number;
  timestamp: number;
}

export interface OrderBookSnapshot {
  symbol: string;
  bids: DepthLevel[];
  asks: DepthLevel[];
  timestamp: number;
  lastUpdateId: number;
}

export interface ScalpingMetrics {
  cvd: number;
  imbalanceRatio: number;
  microprice: number;
  spread: number;
  spreadPercent: number;
  largeBuyVol: number;
  largeSellVol: number;
  absorptionScore: number;
  exhaustionScore: number;
  timestamp: number;
}

export type ScalpingStrategy =
  | 'imbalance'
  | 'cvd-divergence'
  | 'mean-reversion'
  | 'momentum-burst'
  | 'absorption-reversal';

export type ScalpingExecutionMode = 'POST_ONLY' | 'IOC' | 'MARKET';

export interface ScalpingSignal {
  id: string;
  symbol: string;
  strategy: ScalpingStrategy;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  metrics: ScalpingMetrics;
  timestamp: number;
}

export interface ScalpingStatus {
  isRunning: boolean;
  sessionPnl: number;
  tradeCount: number;
  winRate: number;
  circuitBreakerTripped: boolean;
}

export interface TickChartConfig {
  ticksPerBar: number;
}

export interface VolumeChartConfig {
  volumePerBar: number;
}

export interface FootprintLevel {
  bidVol: number;
  askVol: number;
  delta: number;
}

export interface FootprintBar {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  levels: Map<number, FootprintLevel>;
}

export interface VolumeProfileLevel {
  price: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
}

export interface VolumeProfile {
  levels: VolumeProfileLevel[];
  poc: number;
  valueAreaHigh: number;
  valueAreaLow: number;
}

export const SCALPING_STRATEGIES: ScalpingStrategy[] = [
  'imbalance',
  'cvd-divergence',
  'mean-reversion',
  'momentum-burst',
  'absorption-reversal',
];

export const SCALPING_SETUP_PREFIX = 'scalping-' as const;
