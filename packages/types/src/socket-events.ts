import type { PositionSide } from './direction';
import type { AggTrade, BookTickerUpdate, DepthUpdate, MarkPriceUpdate, ScalpingMetrics, ScalpingSignal } from './scalping';
import type { LiquidityHeatmapBucket, LiquidityHeatmapSnapshot } from './liquidityHeatmap';
import type { MarketType } from './futures';
import type { RiskAlertLevel, RiskAlertType } from './trading-config';

export const CLIENT_TO_SERVER_EVENTS = {
  subscribeOrders: 'subscribe:orders',
  unsubscribeOrders: 'unsubscribe:orders',
  subscribePositions: 'subscribe:positions',
  unsubscribePositions: 'unsubscribe:positions',
  subscribeWallet: 'subscribe:wallet',
  unsubscribeWallet: 'unsubscribe:wallet',
  subscribePrices: 'subscribe:prices',
  subscribePricesBatch: 'subscribe:prices:batch',
  unsubscribePrices: 'unsubscribe:prices',
  subscribeKlines: 'subscribe:klines',
  unsubscribeKlines: 'unsubscribe:klines',
  subscribeSetups: 'subscribe:setups',
  unsubscribeSetups: 'unsubscribe:setups',
  subscribeAutoTradingLogs: 'subscribe:autoTradingLogs',
  unsubscribeAutoTradingLogs: 'unsubscribe:autoTradingLogs',
  subscribeBookTicker: 'subscribe:bookTicker',
  unsubscribeBookTicker: 'unsubscribe:bookTicker',
  subscribeMarkPrice: 'subscribe:markPrice',
  unsubscribeMarkPrice: 'unsubscribe:markPrice',
  subscribeAggTrades: 'subscribe:aggTrades',
  unsubscribeAggTrades: 'unsubscribe:aggTrades',
  subscribeDepth: 'subscribe:depth',
  unsubscribeDepth: 'unsubscribe:depth',
  subscribeLiquidityHeatmap: 'subscribe:liquidityHeatmap',
  unsubscribeLiquidityHeatmap: 'unsubscribe:liquidityHeatmap',
  subscribeScalpingMetrics: 'subscribe:scalpingMetrics',
  unsubscribeScalpingMetrics: 'unsubscribe:scalpingMetrics',
  subscribeScalpingSignals: 'subscribe:scalpingSignals',
  unsubscribeScalpingSignals: 'unsubscribe:scalpingSignals',
} as const;

export const SERVER_TO_CLIENT_EVENTS = {
  orderUpdate: 'order:update',
  orderCreated: 'order:created',
  orderCancelled: 'order:cancelled',
  positionUpdate: 'position:update',
  positionClosed: 'position:closed',
  walletUpdate: 'wallet:update',
  priceUpdate: 'price:update',
  klineUpdate: 'kline:update',
  streamHealth: 'stream:health',
  streamReconnected: 'stream:reconnected',
  setupDetected: 'setup-detected',
  signalSuggestion: 'signal-suggestion',
  sessionScanResult: 'session-scan-result',
  riskAlert: 'risk:alert',
  riskDailyLossLimit: 'risk:daily-loss-limit',
  riskLiquidationWarning: 'risk:liquidation-warning',
  tradeNotification: 'trade:notification',
  notification: 'notification',
  autoTradingLog: 'autoTrading:log',
  bookTickerUpdate: 'bookTicker:update',
  markPriceUpdate: 'markPrice:update',
  aggTradeUpdate: 'aggTrade:update',
  depthUpdate: 'depth:update',
  scalpingMetricsUpdate: 'scalpingMetrics:update',
  scalpingSignalNew: 'scalpingSignal:new',
  liquidityHeatmapSnapshot: 'liquidityHeatmap:snapshot',
  liquidityHeatmapBucket: 'liquidityHeatmap:bucket',
  symbolsActiveUpdated: 'symbols:active:updated',
  backfillProgress: 'backfill:progress',
  backtestProgress: 'backtest:progress',
  backtestComplete: 'backtest:complete',
  backtestFailed: 'backtest:failed',
} as const;

export interface PriceUpdatePayload {
  symbol: string;
  price: number;
  timestamp: number;
}

export interface KlineUpdatePayload {
  symbol: string;
  interval: string;
  marketType?: MarketType;
  openTime: number;
  closeTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  isClosed: boolean;
  timestamp: number;
  synthetic?: boolean;
}

export interface StreamHealthPayload {
  symbol: string;
  interval: string;
  marketType: MarketType;
  status: 'healthy' | 'degraded';
  reason?: string;
  lastMessageAt: number | null;
}

export interface StreamReconnectedPayload {
  // 'user' = Binance Futures user-stream (orders/positions/balance);
  // others can be added later (e.g. 'kline').
  source: 'user';
  reason: 'recovered_message' | 'forced_reconnect' | 'listenkey_expired';
  silenceMs?: number;
}

export interface RiskAlertPayload {
  type: RiskAlertType;
  level: RiskAlertLevel;
  positionId?: string;
  symbol?: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export type TradeNotificationType =
  | 'POSITION_OPENED'
  | 'POSITION_CLOSED'
  | 'POSITION_PYRAMIDED'
  | 'POSITION_PARTIAL_CLOSE'
  | 'TRAILING_STOP_UPDATED'
  | 'LIMIT_FILLED';

export interface TradeNotificationPayload {
  type: TradeNotificationType;
  title: string;
  body: string;
  urgency: 'low' | 'normal' | 'critical';
  data: {
    executionId: string;
    symbol: string;
    side: PositionSide;
    entryPrice?: string;
    exitPrice?: string;
    pnl?: string;
    pnlPercent?: string;
    exitReason?: string;
    oldStopLoss?: string;
    newStopLoss?: string;
  };
}

export interface SetupDetectedPayload {
  symbol: string;
  interval: string;
  setup: {
    id: string;
    setupType: string;
    direction: PositionSide;
    entryPrice: number;
    stopLoss?: number | null;
    takeProfit?: number | null;
    confidence?: number | null;
    riskRewardRatio?: number | null;
    detectedAt: Date | string;
  };
}

export interface SignalSuggestionPayload {
  id: string;
  walletId: string;
  symbol: string;
  interval: string;
  side: PositionSide;
  setupType: string;
  entryPrice: string;
  stopLoss: string | null;
  takeProfit: string | null;
  riskRewardRatio: string | null;
  confidence: number | null;
  expiresAt: string | null;
}

export interface AutoTradingLogEntryPayload {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  emoji: string;
  message: string;
  symbol?: string;
  interval?: string;
}

export interface PositionClosedPayload {
  positionId: string;
  symbol: string;
  side: PositionSide;
  exitReason: string;
  pnl: number;
  pnlPercent: number;
  exitPrice?: number;
}

export interface DailyLossLimitPayload {
  currentLoss: number;
  limit: number;
  percentUsed: number;
}

export interface LiquidationWarningPayload {
  symbol: string;
  side: PositionSide;
  markPrice: number;
  liquidationPrice: number;
  distancePercent: number;
  riskLevel: 'warning' | 'danger' | 'critical';
}

export interface AppNotificationPayload {
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
}

export interface BackfillProgressPayload {
  completed: number;
  total: number;
  currentSymbol: string;
  status: 'in_progress' | 'completed' | 'error';
  error?: string;
}

export type BacktestProgressPhase =
  | 'fetchingKlines'
  | 'detectingSetups'
  | 'simulating'
  | 'computingMetrics';

export interface BacktestProgressPayload {
  backtestId: string;
  phase: BacktestProgressPhase;
  processed: number;
  total: number;
  etaMs: number | null;
  startedAt: number;
}

export interface BacktestCompletePayload {
  backtestId: string;
  resultId: string;
  durationMs: number;
}

export interface BacktestFailedPayload {
  backtestId: string;
  error: string;
}

export interface SessionScanResultPayload {
  sessionId: string;
  presetId: string;
  results: unknown;
}

export interface LiquidityHeatmapBucketEvent {
  symbol: string;
  bucket: LiquidityHeatmapBucket;
  priceBinSize?: number;
  maxQuantity?: number;
}

export interface KlineSubscribePayload {
  symbol: string;
  interval: string;
}

export type ClientToServerEvents = {
  [CLIENT_TO_SERVER_EVENTS.subscribeOrders]: (walletId: string) => void;
  [CLIENT_TO_SERVER_EVENTS.unsubscribeOrders]: (walletId: string) => void;
  [CLIENT_TO_SERVER_EVENTS.subscribePositions]: (walletId: string) => void;
  [CLIENT_TO_SERVER_EVENTS.unsubscribePositions]: (walletId: string) => void;
  [CLIENT_TO_SERVER_EVENTS.subscribeWallet]: (walletId: string) => void;
  [CLIENT_TO_SERVER_EVENTS.unsubscribeWallet]: (walletId: string) => void;
  [CLIENT_TO_SERVER_EVENTS.subscribePrices]: (symbol: string) => void;
  [CLIENT_TO_SERVER_EVENTS.subscribePricesBatch]: (symbols: string[]) => void;
  [CLIENT_TO_SERVER_EVENTS.unsubscribePrices]: (symbol: string) => void;
  [CLIENT_TO_SERVER_EVENTS.subscribeKlines]: (data: KlineSubscribePayload) => void;
  [CLIENT_TO_SERVER_EVENTS.unsubscribeKlines]: (data: KlineSubscribePayload) => void;
  [CLIENT_TO_SERVER_EVENTS.subscribeSetups]: (userId: string) => void;
  [CLIENT_TO_SERVER_EVENTS.unsubscribeSetups]: (userId: string) => void;
  [CLIENT_TO_SERVER_EVENTS.subscribeAutoTradingLogs]: (walletId: string) => void;
  [CLIENT_TO_SERVER_EVENTS.unsubscribeAutoTradingLogs]: (walletId: string) => void;
  [CLIENT_TO_SERVER_EVENTS.subscribeBookTicker]: (symbol: string) => void;
  [CLIENT_TO_SERVER_EVENTS.unsubscribeBookTicker]: (symbol: string) => void;
  [CLIENT_TO_SERVER_EVENTS.subscribeMarkPrice]: (symbol: string) => void;
  [CLIENT_TO_SERVER_EVENTS.unsubscribeMarkPrice]: (symbol: string) => void;
  [CLIENT_TO_SERVER_EVENTS.subscribeAggTrades]: (symbol: string) => void;
  [CLIENT_TO_SERVER_EVENTS.unsubscribeAggTrades]: (symbol: string) => void;
  [CLIENT_TO_SERVER_EVENTS.subscribeDepth]: (symbol: string) => void;
  [CLIENT_TO_SERVER_EVENTS.unsubscribeDepth]: (symbol: string) => void;
  [CLIENT_TO_SERVER_EVENTS.subscribeLiquidityHeatmap]: (symbol: string) => void;
  [CLIENT_TO_SERVER_EVENTS.unsubscribeLiquidityHeatmap]: (symbol: string) => void;
  [CLIENT_TO_SERVER_EVENTS.subscribeScalpingMetrics]: (symbol: string) => void;
  [CLIENT_TO_SERVER_EVENTS.unsubscribeScalpingMetrics]: (symbol: string) => void;
  [CLIENT_TO_SERVER_EVENTS.subscribeScalpingSignals]: (walletId: string) => void;
  [CLIENT_TO_SERVER_EVENTS.unsubscribeScalpingSignals]: (walletId: string) => void;
};

export type ServerToClientEvents = {
  [SERVER_TO_CLIENT_EVENTS.orderUpdate]: (order: unknown) => void;
  [SERVER_TO_CLIENT_EVENTS.orderCreated]: (order: unknown) => void;
  [SERVER_TO_CLIENT_EVENTS.orderCancelled]: (data: { orderId: string }) => void;
  [SERVER_TO_CLIENT_EVENTS.positionUpdate]: (position: unknown) => void;
  [SERVER_TO_CLIENT_EVENTS.positionClosed]: (data: PositionClosedPayload) => void;
  [SERVER_TO_CLIENT_EVENTS.walletUpdate]: (wallet: unknown) => void;
  [SERVER_TO_CLIENT_EVENTS.priceUpdate]: (data: PriceUpdatePayload) => void;
  [SERVER_TO_CLIENT_EVENTS.klineUpdate]: (data: KlineUpdatePayload) => void;
  [SERVER_TO_CLIENT_EVENTS.streamHealth]: (data: StreamHealthPayload) => void;
  [SERVER_TO_CLIENT_EVENTS.streamReconnected]: (data: StreamReconnectedPayload) => void;
  [SERVER_TO_CLIENT_EVENTS.setupDetected]: (data: SetupDetectedPayload) => void;
  [SERVER_TO_CLIENT_EVENTS.signalSuggestion]: (data: SignalSuggestionPayload) => void;
  [SERVER_TO_CLIENT_EVENTS.sessionScanResult]: (data: SessionScanResultPayload) => void;
  [SERVER_TO_CLIENT_EVENTS.riskAlert]: (data: RiskAlertPayload) => void;
  [SERVER_TO_CLIENT_EVENTS.riskDailyLossLimit]: (data: DailyLossLimitPayload) => void;
  [SERVER_TO_CLIENT_EVENTS.riskLiquidationWarning]: (data: LiquidationWarningPayload) => void;
  [SERVER_TO_CLIENT_EVENTS.tradeNotification]: (data: TradeNotificationPayload) => void;
  [SERVER_TO_CLIENT_EVENTS.notification]: (data: AppNotificationPayload) => void;
  [SERVER_TO_CLIENT_EVENTS.autoTradingLog]: (entry: AutoTradingLogEntryPayload) => void;
  [SERVER_TO_CLIENT_EVENTS.bookTickerUpdate]: (data: BookTickerUpdate) => void;
  [SERVER_TO_CLIENT_EVENTS.markPriceUpdate]: (data: MarkPriceUpdate) => void;
  [SERVER_TO_CLIENT_EVENTS.aggTradeUpdate]: (data: AggTrade & { isLargeTrade?: boolean }) => void;
  [SERVER_TO_CLIENT_EVENTS.depthUpdate]: (data: DepthUpdate) => void;
  [SERVER_TO_CLIENT_EVENTS.scalpingMetricsUpdate]: (data: ScalpingMetrics) => void;
  [SERVER_TO_CLIENT_EVENTS.scalpingSignalNew]: (data: ScalpingSignal) => void;
  [SERVER_TO_CLIENT_EVENTS.liquidityHeatmapSnapshot]: (data: LiquidityHeatmapSnapshot) => void;
  [SERVER_TO_CLIENT_EVENTS.liquidityHeatmapBucket]: (data: LiquidityHeatmapBucketEvent) => void;
  [SERVER_TO_CLIENT_EVENTS.symbolsActiveUpdated]: (symbols: string[]) => void;
  [SERVER_TO_CLIENT_EVENTS.backfillProgress]: (data: BackfillProgressPayload) => void;
  [SERVER_TO_CLIENT_EVENTS.backtestProgress]: (data: BacktestProgressPayload) => void;
  [SERVER_TO_CLIENT_EVENTS.backtestComplete]: (data: BacktestCompletePayload) => void;
  [SERVER_TO_CLIENT_EVENTS.backtestFailed]: (data: BacktestFailedPayload) => void;
};

export const ROOMS = {
  orders: (walletId: string): string => `orders:${walletId}`,
  positions: (walletId: string): string => `positions:${walletId}`,
  wallet: (walletId: string): string => `wallet:${walletId}`,
  prices: (symbol: string): string => `prices:${symbol}`,
  klines: (symbol: string, interval: string): string => `klines:${symbol}:${interval}`,
  user: (userId: string): string => `user:${userId}`,
  autoTradingLogs: (walletId: string): string => `autoTradingLogs:${walletId}`,
  bookTicker: (symbol: string): string => `bookTicker:${symbol}`,
  markPrice: (symbol: string): string => `markPrice:${symbol}`,
  aggTrades: (symbol: string): string => `aggTrades:${symbol}`,
  depth: (symbol: string): string => `depth:${symbol}`,
  liquidityHeatmap: (symbol: string): string => `liquidityHeatmap:${symbol}`,
  scalpingMetrics: (symbol: string): string => `scalpingMetrics:${symbol}`,
  scalpingSignals: (walletId: string): string => `scalpingSignals:${walletId}`,
} as const;

export const ROOM_PREFIXES = {
  orders: 'orders:',
  positions: 'positions:',
  wallet: 'wallet:',
  prices: 'prices:',
  klines: 'klines:',
  user: 'user:',
  autoTradingLogs: 'autoTradingLogs:',
  bookTicker: 'bookTicker:',
  aggTrades: 'aggTrades:',
  depth: 'depth:',
  liquidityHeatmap: 'liquidityHeatmap:',
  scalpingMetrics: 'scalpingMetrics:',
  scalpingSignals: 'scalpingSignals:',
} as const;
