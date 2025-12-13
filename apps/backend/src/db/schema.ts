import {
    bigint,
    boolean,
    index,
    integer,
    numeric,
    pgTable,
    primaryKey,
    text,
    timestamp,
    varchar,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: varchar({ length: 255 }).primaryKey(),
  email: varchar({ length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
});

export const wallets = pgTable('wallets', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar({ length: 255 }).notNull(),
  walletType: varchar('wallet_type', { length: 20 }).default('paper').$type<'live' | 'testnet' | 'paper'>(),
  apiKeyEncrypted: text('api_key_encrypted').notNull(),
  apiSecretEncrypted: text('api_secret_encrypted').notNull(),
  initialBalance: numeric('initial_balance', { precision: 20, scale: 8 }),
  currentBalance: numeric('current_balance', { precision: 20, scale: 8 }),
  currency: varchar({ length: 10 }).default('USDT'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

export const orders = pgTable('orders', {
  orderId: bigint('order_id', { mode: 'number' }).primaryKey(),
  symbol: varchar({ length: 20 }).notNull(),
  side: varchar({ length: 10 }).$type<'BUY' | 'SELL'>().notNull(),
  type: varchar({ length: 30 }).notNull(),
  price: varchar({ length: 50 }),
  origQty: varchar('orig_qty', { length: 50 }),
  executedQty: varchar('executed_qty', { length: 50 }),
  status: varchar({ length: 30 }).notNull(),
  timeInForce: varchar('time_in_force', { length: 10 }),
  time: bigint({ mode: 'number' }),
  updateTime: bigint('update_time', { mode: 'number' }),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id),
  walletId: varchar('wallet_id', { length: 255 })
    .notNull()
    .references(() => wallets.id),
  setupId: varchar('setup_id', { length: 255 }),
  setupType: varchar('setup_type', { length: 100 }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const positions = pgTable('positions', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id),
  walletId: varchar('wallet_id', { length: 255 })
    .notNull()
    .references(() => wallets.id),
  symbol: varchar({ length: 20 }).notNull(),
  side: varchar({ length: 10 }).$type<'LONG' | 'SHORT'>().notNull(),
  entryPrice: numeric('entry_price', { precision: 20, scale: 8 }).notNull(),
  entryQty: numeric('entry_qty', { precision: 20, scale: 8 }).notNull(),
  currentPrice: numeric('current_price', { precision: 20, scale: 8 }),
  stopLoss: numeric('stop_loss', { precision: 20, scale: 8 }),
  takeProfit: numeric('take_profit', { precision: 20, scale: 8 }),
  pnl: numeric({ precision: 20, scale: 8 }),
  pnlPercent: numeric('pnl_percent', { precision: 10, scale: 2 }),
  status: varchar({ length: 20 }).default('open'),
  closedAt: timestamp('closed_at', { mode: 'date' }),
  setupId: varchar('setup_id', { length: 255 }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

export const klines = pgTable(
  'klines',
  {
    symbol: varchar({ length: 20 }).notNull(),
    interval: varchar({ length: 5 }).notNull(),
    openTime: timestamp('open_time', { mode: 'date' }).notNull(),
    closeTime: timestamp('close_time', { mode: 'date' }).notNull(),
    open: numeric({ precision: 20, scale: 8 }).notNull(),
    high: numeric({ precision: 20, scale: 8 }).notNull(),
    low: numeric({ precision: 20, scale: 8 }).notNull(),
    close: numeric({ precision: 20, scale: 8 }).notNull(),
    volume: numeric({ precision: 20, scale: 8 }).notNull(),
    quoteVolume: numeric('quote_volume', { precision: 20, scale: 8 }),
    trades: integer(),
    takerBuyBaseVolume: numeric('taker_buy_base_volume', { precision: 20, scale: 8 }),
    takerBuyQuoteVolume: numeric('taker_buy_quote_volume', { precision: 20, scale: 8 }),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.symbol, table.interval, table.openTime] }),
  })
);

export const tradingSetups = pgTable('trading_setups', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id),
  type: varchar({ length: 100 }).notNull(),
  symbol: varchar({ length: 20 }).notNull(),
  interval: varchar({ length: 5 }).notNull(),
  direction: varchar({ length: 10 }).$type<'LONG' | 'SHORT'>().notNull(),
  entryPrice: numeric('entry_price', { precision: 20, scale: 8 }).notNull(),
  stopLoss: numeric('stop_loss', { precision: 20, scale: 8 }).notNull(),
  takeProfit: numeric('take_profit', { precision: 20, scale: 8 }).notNull(),
  confidence: integer().notNull(),
  detectedAt: timestamp('detected_at', { mode: 'date' }).defaultNow().notNull(),
  orderId: bigint('order_id', { mode: 'number' }).references(() => orders.orderId),
  status: varchar({ length: 20 }).default('pending'),
  pnl: numeric({ precision: 20, scale: 8 }),
  pnlPercent: numeric('pnl_percent', { precision: 10, scale: 2 }),
  closedAt: timestamp('closed_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const aiConversations = pgTable('ai_conversations', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id),
  provider: varchar({ length: 50 }).notNull(),
  model: varchar({ length: 100 }).notNull(),
  messages: text().notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

export const aiTrades = pgTable('ai_trades', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id),
  walletId: varchar('wallet_id', { length: 255 })
    .notNull()
    .references(() => wallets.id),
  symbol: varchar({ length: 20 }).notNull(),
  action: varchar({ length: 10 }).$type<'BUY' | 'SELL' | 'HOLD'>().notNull(),
  reasoning: text().notNull(),
  confidence: integer().notNull(),
  orderId: bigint('order_id', { mode: 'number' }).references(() => orders.orderId),
  status: varchar({ length: 20 }).default('pending'),
  pnl: numeric({ precision: 20, scale: 8 }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const setupDetections = pgTable('setup_detections', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  symbol: varchar({ length: 20 }).notNull(),
  interval: varchar({ length: 5 }).notNull(),
  setupType: varchar('setup_type', { length: 100 }).notNull(),
  direction: varchar({ length: 10 }).$type<'LONG' | 'SHORT'>().notNull(),
  entryPrice: numeric('entry_price', { precision: 20, scale: 8 }).notNull(),
  stopLoss: numeric('stop_loss', { precision: 20, scale: 8 }),
  takeProfit: numeric('take_profit', { precision: 20, scale: 8 }),
  confidence: integer().notNull(),
  riskReward: numeric('risk_reward', { precision: 10, scale: 2 }),
  metadata: text(),
  detectedAt: timestamp('detected_at', { mode: 'date' }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  viewed: boolean().default(false),
  notified: boolean().default(false),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('setup_detections_user_id_idx').on(table.userId),
  symbolIntervalIdx: index('setup_detections_symbol_interval_idx').on(table.symbol, table.interval),
  setupTypeIdx: index('setup_detections_setup_type_idx').on(table.setupType),
  detectedAtIdx: index('setup_detections_detected_at_idx').on(table.detectedAt),
  expiresAtIdx: index('setup_detections_expires_at_idx').on(table.expiresAt),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;

export type Kline = typeof klines.$inferSelect;
export type NewKline = typeof klines.$inferInsert;

export type TradingSetup = typeof tradingSetups.$inferSelect;
export type NewTradingSetup = typeof tradingSetups.$inferInsert;

export type AIConversation = typeof aiConversations.$inferSelect;
export type NewAIConversation = typeof aiConversations.$inferInsert;

export type AITrade = typeof aiTrades.$inferSelect;
export type NewAITrade = typeof aiTrades.$inferInsert;

export const autoTradingConfig = pgTable('auto_trading_config', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  walletId: varchar('wallet_id', { length: 255 })
    .notNull()
    .references(() => wallets.id, { onDelete: 'cascade' }),
  isEnabled: boolean('is_enabled').default(false).notNull(),
  maxConcurrentPositions: integer('max_concurrent_positions').default(3).notNull(),
  maxPositionSize: numeric('max_position_size', { precision: 10, scale: 2 }).default('10').notNull(), // % of wallet balance
  dailyLossLimit: numeric('daily_loss_limit', { precision: 10, scale: 2 }).default('5').notNull(), // % of wallet balance
  enabledSetupTypes: text('enabled_setup_types').notNull(), // JSON array of setup types
  positionSizing: varchar('position_sizing', { length: 20 }).default('percentage'), // 'fixed' | 'percentage' | 'kelly'
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('auto_trading_config_user_id_idx').on(table.userId),
  walletIdIdx: index('auto_trading_config_wallet_id_idx').on(table.walletId),
}));

export const tradeExecutions = pgTable('trade_executions', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  walletId: varchar('wallet_id', { length: 255 })
    .notNull()
    .references(() => wallets.id, { onDelete: 'cascade' }),
  setupId: varchar('setup_id', { length: 255 }),
  setupType: varchar('setup_type', { length: 100 }),
  symbol: varchar({ length: 20 }).notNull(),
  side: varchar({ length: 10 }).$type<'LONG' | 'SHORT'>().notNull(),
  entryOrderId: bigint('entry_order_id', { mode: 'number' }).references(() => orders.orderId),
  exitOrderId: bigint('exit_order_id', { mode: 'number' }).references(() => orders.orderId),
  entryPrice: numeric('entry_price', { precision: 20, scale: 8 }).notNull(),
  exitPrice: numeric('exit_price', { precision: 20, scale: 8 }),
  quantity: numeric({ precision: 20, scale: 8 }).notNull(),
  stopLoss: numeric('stop_loss', { precision: 20, scale: 8 }),
  takeProfit: numeric('take_profit', { precision: 20, scale: 8 }),
  pnl: numeric({ precision: 20, scale: 8 }),
  pnlPercent: numeric('pnl_percent', { precision: 10, scale: 2 }),
  fees: numeric({ precision: 20, scale: 8 }).default('0'),
  openedAt: timestamp('opened_at', { mode: 'date' }).notNull(),
  closedAt: timestamp('closed_at', { mode: 'date' }),
  status: varchar({ length: 20 }).default('open'), // 'open' | 'closed' | 'cancelled'
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('trade_executions_user_id_idx').on(table.userId),
  walletIdIdx: index('trade_executions_wallet_id_idx').on(table.walletId),
  statusIdx: index('trade_executions_status_idx').on(table.status),
  openedAtIdx: index('trade_executions_opened_at_idx').on(table.openedAt),
  setupTypeIdx: index('trade_executions_setup_type_idx').on(table.setupType),
}));

export const priceCache = pgTable('price_cache', {
  symbol: varchar({ length: 20 }).primaryKey(),
  price: numeric({ precision: 20, scale: 8 }).notNull(),
  timestamp: timestamp({ mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  timestampIdx: index('price_cache_timestamp_idx').on(table.timestamp),
}));

export type SetupDetection = typeof setupDetections.$inferSelect;
export type NewSetupDetection = typeof setupDetections.$inferInsert;

export type AutoTradingConfig = typeof autoTradingConfig.$inferSelect;
export type NewAutoTradingConfig = typeof autoTradingConfig.$inferInsert;

export type TradeExecution = typeof tradeExecutions.$inferSelect;
export type NewTradeExecution = typeof tradeExecutions.$inferInsert;

export type PriceCache = typeof priceCache.$inferSelect;
export type NewPriceCache = typeof priceCache.$inferInsert;

export const mlModels = pgTable('ml_models', {
  id: varchar({ length: 255 }).primaryKey(),
  name: varchar({ length: 100 }).notNull(),
  version: varchar({ length: 50 }).notNull(),
  type: varchar({ length: 50 }).notNull(),
  status: varchar({ length: 20 }).default('active'),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size'),
  checksum: varchar({ length: 64 }),
  trainedAt: timestamp('trained_at', { mode: 'date' }),
  trainingDataStart: timestamp('training_data_start', { mode: 'date' }),
  trainingDataEnd: timestamp('training_data_end', { mode: 'date' }),
  samplesCount: integer('samples_count'),
  metrics: text(),
  featureConfig: text('feature_config'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

export const mlPredictions = pgTable('ml_predictions', {
  id: varchar({ length: 255 }).primaryKey(),
  modelId: varchar('model_id', { length: 255 })
    .notNull()
    .references(() => mlModels.id),
  setupDetectionId: varchar('setup_detection_id', { length: 255 })
    .references(() => setupDetections.id),
  probability: numeric({ precision: 10, scale: 6 }).notNull(),
  confidence: integer().notNull(),
  predictedLabel: integer('predicted_label').notNull(),
  actualLabel: integer('actual_label'),
  outcomeRecordedAt: timestamp('outcome_recorded_at', { mode: 'date' }),
  inferenceLatencyMs: numeric('inference_latency_ms', { precision: 10, scale: 2 }),
  symbol: varchar({ length: 20 }).notNull(),
  interval: varchar({ length: 5 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  modelIdIdx: index('ml_predictions_model_id_idx').on(table.modelId),
  setupDetectionIdIdx: index('ml_predictions_setup_detection_id_idx').on(table.setupDetectionId),
  symbolIdx: index('ml_predictions_symbol_idx').on(table.symbol),
  createdAtIdx: index('ml_predictions_created_at_idx').on(table.createdAt),
}));

export const mlEvaluations = pgTable('ml_evaluations', {
  id: varchar({ length: 255 }).primaryKey(),
  modelId: varchar('model_id', { length: 255 })
    .notNull()
    .references(() => mlModels.id),
  evaluationStart: timestamp('evaluation_start', { mode: 'date' }).notNull(),
  evaluationEnd: timestamp('evaluation_end', { mode: 'date' }).notNull(),
  accuracy: numeric({ precision: 10, scale: 6 }),
  precision: numeric({ precision: 10, scale: 6 }),
  recall: numeric({ precision: 10, scale: 6 }),
  f1Score: numeric('f1_score', { precision: 10, scale: 6 }),
  auc: numeric({ precision: 10, scale: 6 }),
  winRateImprovement: numeric('win_rate_improvement', { precision: 10, scale: 2 }),
  sharpeImprovement: numeric('sharpe_improvement', { precision: 10, scale: 2 }),
  profitFactorImprovement: numeric('profit_factor_improvement', { precision: 10, scale: 2 }),
  predictionsCount: integer('predictions_count'),
  correctPredictions: integer('correct_predictions'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  modelIdIdx: index('ml_evaluations_model_id_idx').on(table.modelId),
  evaluationStartIdx: index('ml_evaluations_evaluation_start_idx').on(table.evaluationStart),
}));

export const mlFeatureCache = pgTable('ml_feature_cache', {
  id: varchar({ length: 255 }).primaryKey(),
  symbol: varchar({ length: 20 }).notNull(),
  interval: varchar({ length: 5 }).notNull(),
  openTime: timestamp('open_time', { mode: 'date' }).notNull(),
  features: text().notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
}, (table) => ({
  symbolIntervalTimeIdx: index('ml_feature_cache_symbol_interval_time_idx')
    .on(table.symbol, table.interval, table.openTime),
  expiresAtIdx: index('ml_feature_cache_expires_at_idx').on(table.expiresAt),
}));

export type MLModel = typeof mlModels.$inferSelect;
export type NewMLModel = typeof mlModels.$inferInsert;

export type MLPrediction = typeof mlPredictions.$inferSelect;
export type NewMLPrediction = typeof mlPredictions.$inferInsert;

export type MLEvaluation = typeof mlEvaluations.$inferSelect;
export type NewMLEvaluation = typeof mlEvaluations.$inferInsert;

export type MLFeatureCache = typeof mlFeatureCache.$inferSelect;
export type NewMLFeatureCache = typeof mlFeatureCache.$inferInsert;

export const activeWatchers = pgTable('active_watchers', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  walletId: varchar('wallet_id', { length: 255 })
    .notNull()
    .references(() => wallets.id, { onDelete: 'cascade' }),
  symbol: varchar({ length: 20 }).notNull(),
  interval: varchar({ length: 5 }).notNull(),
  startedAt: timestamp('started_at', { mode: 'date' }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  walletIdIdx: index('active_watchers_wallet_id_idx').on(table.walletId),
  userIdIdx: index('active_watchers_user_id_idx').on(table.userId),
}));

export type ActiveWatcher = typeof activeWatchers.$inferSelect;
export type NewActiveWatcher = typeof activeWatchers.$inferInsert;
