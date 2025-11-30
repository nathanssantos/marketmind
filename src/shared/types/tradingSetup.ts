export type SetupType =
  | 'setup-9-1'
  | 'setup-9-2'
  | 'setup-9-3'
  | 'setup-9-4'
  | '123-reversal'
  | 'bull-trap'
  | 'bear-trap'
  | 'breakout-retest'
  | 'pin-inside-combo'
  | 'order-block-fvg'
  | 'vwap-ema-cross'
  | 'divergence-reversal'
  | 'liquidity-sweep'
  | 'market-structure-break';

export type SetupDirection = 'LONG' | 'SHORT';

export interface SetupSpecificData {
  [key: string]: unknown;
}

export interface TradingSetup {
  id: string;
  type: SetupType;
  direction: SetupDirection;
  timestamp: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  confidence: number;
  volumeConfirmation: boolean;
  indicatorConfluence: number;
  candleIndex: number;
  setupData: SetupSpecificData;
  visible: boolean;
  source: 'algorithm';
  label?: string;
}

export interface PivotPoint {
  index: number;
  timestamp: number;
  price: number;
  type: 'high' | 'low';
}

export interface FVG {
  type: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  timestamp: number;
}

export interface OrderBlock {
  type: 'bullish' | 'bearish';
  high: number;
  low: number;
  timestamp: number;
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
