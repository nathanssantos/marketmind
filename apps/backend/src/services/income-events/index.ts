export {
  insertIncomeEvent,
  insertIncomeEventsBatch,
  type InsertIncomeEventInput,
} from './insertIncomeEvent';

export {
  linkIncomeToExecution,
  linkUnmatchedEventsForWallet,
  type LinkIncomeToExecutionInput,
} from './matcher';

export {
  getDailyIncomeSum,
  getDailyIncomeBreakdown,
  getEquityCurvePoints,
  type DailyIncomeQuery,
  type DailyIncomeBucket,
  type EquityCurvePoint,
} from './dailyAggregate';

export {
  synthesizePaperClose,
  type SynthesizePaperCloseInput,
} from './synthesizePaperClose';

export {
  syncWalletIncome,
  syncAllWalletsIncome,
  runIncomeSyncOnce,
  startIncomeSync,
  stopIncomeSync,
  type WalletSyncResult,
  type SyncOptions,
  type StartIncomeSyncOptions,
} from './syncFromBinance';

export {
  emitPositionClose,
  type EmitPositionCloseInput,
} from './emitPositionClose';
