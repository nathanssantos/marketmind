export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  emoji: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface SetupLogEntry {
  type: string;
  direction: string;
  confidence: number;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  riskReward: string;
}

export interface FilterCheckEntry {
  filterName: string;
  passed: boolean;
  reason: string;
  details?: Record<string, string | number | boolean | null>;
}

export interface RejectionEntry {
  setupType: string;
  direction: string;
  reason: string;
  details?: Record<string, string | number | boolean | null>;
}

export interface TradeExecutionEntry {
  setupType: string;
  direction: string;
  entryPrice: string;
  quantity: string;
  stopLoss?: string;
  takeProfit?: string;
  orderType: string;
  status: 'executed' | 'pending' | 'failed';
}

export interface WatcherResult {
  watcherId: string;
  symbol: string;
  interval: string;
  marketType: string;
  profileName?: string;
  status: 'success' | 'skipped' | 'pending' | 'error';
  reason?: string;
  klinesCount?: number;
  setupsDetected: SetupLogEntry[];
  filterChecks: FilterCheckEntry[];
  rejections: RejectionEntry[];
  tradeExecutions: TradeExecutionEntry[];
  tradesExecuted: number;
  durationMs: number;
  logs: LogEntry[];
}

export interface BatchResult {
  batchId: number;
  startTime: Date;
  endTime: Date;
  totalWatchers: number;
  successCount: number;
  skippedCount: number;
  pendingCount: number;
  errorCount: number;
  totalSetupsDetected: number;
  totalRejections: number;
  totalFilterBlocks: number;
  totalTradesExecuted: number;
  watcherResults: WatcherResult[];
}

export interface RestoredWatcherInfo {
  symbol: string;
  interval: string;
  marketType: string;
  profileId?: string;
  isManual: boolean;
  status: 'success' | 'failed';
  error?: string;
  klinesPrefetched?: number;
  totalKlinesInDb?: number;
  nextCandleClose?: Date;
}

export interface GapFillEntry {
  symbol: string;
  interval: string;
  marketType: string;
  gapsFound: number;
  candlesFilled: number;
  status: 'success' | 'partial' | 'skipped' | 'error';
  reason?: string;
}

export interface CorruptionFixEntry {
  symbol: string;
  interval: string;
  marketType: string;
  corruptedFound: number;
  fixed: number;
  status: 'success' | 'partial' | 'error';
}

export interface MaintenanceResult {
  type: 'startup' | 'periodic';
  startTime: Date;
  endTime: Date;
  pairsChecked: number;
  totalGapsFound: number;
  totalCandlesFilled: number;
  totalCorruptedFixed: number;
  gapFills: GapFillEntry[];
  corruptionFixes: CorruptionFixEntry[];
}

export interface RotationLogEntry {
  timestamp: Date;
  emoji: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface KlineValidationEntry {
  symbol: string;
  gapsFilled: number;
  corruptedFixed: number;
}

export interface RotationResult {
  walletId: string;
  startTime: Date;
  endTime: Date;
  interval: string;
  marketType: string;
  targetCount: number;
  slotsAvailable: number;
  currentSymbols: string[];
  optimalSymbols: string[];
  added: string[];
  removed: string[];
  kept: number;
  skippedWithPositions: string[];
  skippedInsufficientKlines: string[];
  skippedInsufficientCapital: string[];
  klineValidations: KlineValidationEntry[];
  hasChanges: boolean;
  logs: RotationLogEntry[];
}

export interface OHLCMismatchEntry {
  symbol: string;
  interval: string;
  marketType: string;
  openTime: Date;
  field: 'open' | 'high' | 'low' | 'close' | 'volume';
  dbValue: number;
  apiValue: number;
  diffPercent: number;
  fixed: boolean;
}

export interface ReconnectionValidationResult {
  startTime: Date;
  endTime: Date;
  pairsChecked: number;
  klinesChecked: number;
  totalMismatches: number;
  totalFixed: number;
  mismatches: OHLCMismatchEntry[];
}

export interface OrphanedPositionEntry {
  walletId: string;
  executionId: string;
  symbol: string;
  side: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
}

export interface UnknownPositionEntry {
  walletId: string;
  symbol: string;
  positionAmt: number;
  entryPrice: number;
  unrealizedPnl: number;
  leverage: number;
  marginType: string;
}

export interface UpdatedPositionEntry {
  walletId: string;
  executionId: string;
  symbol: string;
  field: string;
  oldValue: number;
  newValue: number;
}

export interface WalletSyncEntry {
  walletId: string;
  walletName: string;
  synced: boolean;
  orphanedCount: number;
  unknownCount: number;
  updatedCount: number;
  error?: string;
}

export interface PositionSyncResult {
  startTime: Date;
  endTime: Date;
  walletsChecked: number;
  totalOrphaned: number;
  totalUnknown: number;
  totalUpdated: number;
  walletSummaries: WalletSyncEntry[];
  orphanedPositions: OrphanedPositionEntry[];
  unknownPositions: UnknownPositionEntry[];
  updatedPositions: UpdatedPositionEntry[];
}

export interface PendingOrderAction {
  executionId: string;
  symbol: string;
  side: string;
  action: 'EXPIRED' | 'INVALID' | 'FILLED' | 'PENDING' | 'ERROR';
  limitPrice: number | null;
  currentPrice?: number;
  expiresAt?: Date;
  error?: string;
}

export interface PendingOrdersCheckResult {
  startTime: Date;
  endTime: Date;
  totalChecked: number;
  expiredCount: number;
  invalidCount: number;
  filledCount: number;
  pendingCount: number;
  errorCount: number;
  actions: PendingOrderAction[];
}
