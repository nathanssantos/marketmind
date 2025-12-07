export type SetupType =
  | 'setup-9-1'
  | 'setup-9-2'
  | 'setup-9-3'
  | 'setup-9-4'
  | '123-reversal'
  | 'bull-trap'
  | 'bear-trap'
  | 'breakout-retest';

export type SetupDirection = 'LONG' | 'SHORT';

export interface SetupSpecificData {
  [key: string]: unknown;
}

export type SetupCancellationReason =
  | 'ema-reversal'
  | 'trend-broken'
  | 'structure-broken'
  | 'swing-lost'
  | 'pullback-exceeded'
  | 'failure-exceeded'
  | 'extreme-lost'
  | 'pattern-invalidated'
  | 'trap-invalidated'
  | 'breakout-failed'
  | 'retest-failed'
  | 'manual';

export interface TradingSetup {
  id: string;
  type: SetupType;
  direction: SetupDirection;
  openTime: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  confidence: number;
  volumeConfirmation: boolean;
  indicatorConfluence: number;
  klineIndex: number;
  setupData: SetupSpecificData;
  visible: boolean;
  source: 'algorithm';
  label?: string;
  isCancelled?: boolean;
  cancelledAt?: number;
  cancellationReason?: SetupCancellationReason;
  isTriggered?: boolean;
  triggeredAt?: number;
}

export interface PivotPoint {
  index: number;
  openTime: number;
  price: number;
  type: 'high' | 'low';
}

export interface FVG {
  type: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  openTime: number;
}

export interface OrderBlock {
  type: 'bullish' | 'bearish';
  high: number;
  low: number;
  openTime: number;
}

export interface VolumeCluster {
  price: number;
  totalVolume: number;
  avgVolume: number;
  count: number;
}

export interface SetupPerformance {
  totalTrades: number;
  winRate: number;
  avgRR: number;
  expectancy: number;
  sharpeRatio: number;
  maxDrawdown: number;
  last30Days: {
    trades: number;
    winRate: number;
    expectancy: number;
  };
}
