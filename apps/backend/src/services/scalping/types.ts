import type { PositionSide, ScalpingMetrics, ScalpingStrategy } from '@marketmind/types';

export interface OrderBookState {
  bids: Map<number, number>;
  asks: Map<number, number>;
  lastUpdateId: number;
}

export interface ImbalanceResult {
  ratio: number;
  bidVolume: number;
  askVolume: number;
}

export interface AbsorptionEvent {
  price: number;
  volume: number;
  side: 'bid' | 'ask';
  priceHeld: boolean;
  score: number;
}

export interface CVDState {
  value: number;
  history: Array<{ value: number; timestamp: number }>;
  priceHistory: Array<{ price: number; timestamp: number }>;
}

export interface IndicatorState {
  ema7: number[];
  ema9: number[];
  cci: number[];
  sarTrend: 'UP' | 'DOWN' | null;
  atr: number | null;
}

export interface StrategyContext {
  symbol: string;
  metrics: ScalpingMetrics;
  cvdState: CVDState;
  currentPrice: number;
  vwap: number;
  avgVolume: number;
  walletBalance: number;
  indicators?: IndicatorState;
}

export interface StrategyResult {
  shouldTrade: boolean;
  direction: PositionSide;
  confidence: number;
  strategy: ScalpingStrategy;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
}

export interface CircuitBreakerState {
  tripped: boolean;
  tradeCount: number;
  sessionPnl: number;
  winCount: number;
  lossCount: number;
  lastResetTime: number;
  dailyTradeCount: number;
  dailyPnl: number;
  dailyResetTime: number;
  consecutiveLosses: number;
  cooldownUntil: number;
}

export interface BalanceCache {
  balance: number;
  timestamp: number;
}
