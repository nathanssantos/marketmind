export type TradingAction = 'buy' | 'sell' | 'hold';
export type RiskProfile = 'conservative' | 'moderate' | 'aggressive';
export type TradingInterval = '1m' | '5m' | '15m' | '30m' | '1h';
export type AITradeStatus = 'open' | 'closed' | 'closed-profit' | 'closed-loss' | 'closed-manual' | 'cancelled';

export interface AITradingDecision {
  action: TradingAction;
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  reason: string;
  patterns: string[];
  volumeConfirmation: boolean;
  trendAlignment: boolean;
}

export interface AITrade {
  id: string;
  openTime: Date;
  symbol: string;
  timeframe: string;
  action: 'buy' | 'sell';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  reason: string;
  patterns: string[];
  pnl?: number;
  pnlPercent?: number;
  status: AITradeStatus;
  aiModel: string;
  aiProvider: string;
  analysisTokens: number;
  orderId?: string;
  closedAt?: Date;
  exitReason?: 'take-profit' | 'stop-loss' | 'manual' | 'emergency';
}

export interface AITradingConfig {
  enabled: boolean;
  riskProfile: RiskProfile;
  customConfidenceThreshold?: number;
  customRiskReward?: number;
  analysisInterval: TradingInterval;
  maxPositionSize: number;
  defaultStopLoss: number;
  defaultTakeProfit: number;
  maxTradesPerDay: number;
  maxTradesPerHour: number;
  minTimeBetweenTrades: number;
  customPrompt?: string;
  enabledTimeframes: string[];
  emergencyStopLosses: number;
  notifyOnTrade: boolean;
  notifyOnProfit: boolean;
  notifyOnLoss: boolean;
  maxDailyLoss: number;
  accountRiskPercent: number;
}

export interface AITradingStats {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  avgProfit: number;
  avgLoss: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  totalTokensUsed: number;
  estimatedCost: number;
  avgHoldingTime: number;
  bestTrade: AITrade | undefined;
  worstTrade: AITrade | undefined;
  patternSuccess: Map<string, { wins: number; losses: number; winRate: number }>;
}

export interface AITradingState {
  isAutoTradingActive: boolean;
  config: AITradingConfig;
  trades: AITrade[];
  currentPosition?: AITrade;
  stats: AITradingStats;
  lastAnalysisTime?: Date;
  lastTradeTime?: Date;
  analysisInProgress: boolean;
  error?: string;
}
