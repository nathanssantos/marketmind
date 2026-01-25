import {
    bigint,
    boolean,
    index,
    integer,
    numeric,
    pgTable,
    primaryKey,
    serial,
    text,
    timestamp,
    unique,
    varchar
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
  marketType: varchar('market_type', { length: 10 }).$type<'SPOT' | 'FUTURES'>().default('SPOT'),
  apiKeyEncrypted: text('api_key_encrypted').notNull(),
  apiSecretEncrypted: text('api_secret_encrypted').notNull(),
  initialBalance: numeric('initial_balance', { precision: 20, scale: 8 }),
  currentBalance: numeric('current_balance', { precision: 20, scale: 8 }),
  totalDeposits: numeric('total_deposits', { precision: 20, scale: 8 }).default('0'),
  totalWithdrawals: numeric('total_withdrawals', { precision: 20, scale: 8 }).default('0'),
  lastTransferSyncAt: timestamp('last_transfer_sync_at', { mode: 'date' }),
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
  marketType: varchar('market_type', { length: 10 }).$type<'SPOT' | 'FUTURES'>().default('SPOT'),
  reduceOnly: boolean('reduce_only').default(false),
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
  marketType: varchar('market_type', { length: 10 }).$type<'SPOT' | 'FUTURES'>().default('SPOT'),
  leverage: integer().default(1),
  marginType: varchar('margin_type', { length: 10 }).$type<'ISOLATED' | 'CROSSED'>(),
  liquidationPrice: numeric('liquidation_price', { precision: 20, scale: 8 }),
  accumulatedFunding: numeric('accumulated_funding', { precision: 20, scale: 8 }).default('0'),
});

export const klines = pgTable(
  'klines',
  {
    symbol: varchar({ length: 20 }).notNull(),
    interval: varchar({ length: 5 }).notNull(),
    marketType: varchar('market_type', { length: 10 }).$type<'SPOT' | 'FUTURES'>().default('SPOT').notNull(),
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
    pk: primaryKey({ columns: [table.symbol, table.interval, table.marketType, table.openTime] }),
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

export const autoTradingConfig = pgTable('auto_trading_config', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  walletId: varchar('wallet_id', { length: 255 })
    .notNull()
    .references(() => wallets.id, { onDelete: 'cascade' }),
  isEnabled: boolean('is_enabled').default(false).notNull(),
  maxConcurrentPositions: integer('max_concurrent_positions').default(5).notNull(),
  maxPositionSize: numeric('max_position_size', { precision: 10, scale: 2 }).default('15').notNull(), // % of wallet balance
  dailyLossLimit: numeric('daily_loss_limit', { precision: 10, scale: 2 }).default('5').notNull(), // % of wallet balance
  enabledSetupTypes: text('enabled_setup_types').notNull(), // JSON array of setup types
  positionSizing: varchar('position_sizing', { length: 20 }).default('percentage'), // 'fixed' | 'percentage' | 'kelly'
  leverage: integer().default(1),
  marginType: varchar('margin_type', { length: 10 }).$type<'ISOLATED' | 'CROSSED'>().default('ISOLATED'),
  positionMode: varchar('position_mode', { length: 10 }).$type<'ONE_WAY' | 'HEDGE'>().default('ONE_WAY'),
  useLimitOrders: boolean('use_limit_orders').default(false).notNull(),
  useStochasticFilter: boolean('use_stochastic_filter').default(false).notNull(),
  useMomentumTimingFilter: boolean('use_momentum_timing_filter').default(false).notNull(),
  useAdxFilter: boolean('use_adx_filter').default(false).notNull(),
  useTrendFilter: boolean('use_trend_filter').default(true).notNull(),
  useMtfFilter: boolean('use_mtf_filter').default(false).notNull(),
  useBtcCorrelationFilter: boolean('use_btc_correlation_filter').default(false).notNull(),
  useMarketRegimeFilter: boolean('use_market_regime_filter').default(false).notNull(),
  useDirectionFilter: boolean('use_direction_filter').default(false).notNull(),
  enableLongInBearMarket: boolean('enable_long_in_bear_market').default(false).notNull(),
  enableShortInBullMarket: boolean('enable_short_in_bull_market').default(false).notNull(),
  useVolumeFilter: boolean('use_volume_filter').default(false).notNull(),
  volumeFilterObvLookbackLong: integer('volume_filter_obv_lookback_long').default(7),
  volumeFilterObvLookbackShort: integer('volume_filter_obv_lookback_short').default(5),
  useObvCheckLong: boolean('use_obv_check_long').default(false),
  useObvCheckShort: boolean('use_obv_check_short').default(true),
  useFundingFilter: boolean('use_funding_filter').default(false).notNull(),
  useConfluenceScoring: boolean('use_confluence_scoring').default(false).notNull(),
  confluenceMinScore: integer('confluence_min_score').default(60).notNull(),
  useChoppinessFilter: boolean('use_choppiness_filter').default(false).notNull(),
  choppinessThresholdHigh: numeric('choppiness_threshold_high', { precision: 5, scale: 2 }).default('61.80'),
  choppinessThresholdLow: numeric('choppiness_threshold_low', { precision: 5, scale: 2 }).default('38.20'),
  choppinessPeriod: integer('choppiness_period').default(14),
  useSessionFilter: boolean('use_session_filter').default(false).notNull(),
  sessionStartUtc: integer('session_start_utc').default(13),
  sessionEndUtc: integer('session_end_utc').default(16),
  useBollingerSqueezeFilter: boolean('use_bollinger_squeeze_filter').default(false).notNull(),
  bollingerSqueezeThreshold: numeric('bollinger_squeeze_threshold', { precision: 5, scale: 3 }).default('0.100'),
  bollingerSqueezePeriod: integer('bollinger_squeeze_period').default(20),
  bollingerSqueezeStdDev: numeric('bollinger_squeeze_std_dev', { precision: 4, scale: 2 }).default('2.00'),
  useVwapFilter: boolean('use_vwap_filter').default(false).notNull(),
  useSuperTrendFilter: boolean('use_super_trend_filter').default(false).notNull(),
  superTrendPeriod: integer('super_trend_period').default(10),
  superTrendMultiplier: numeric('super_trend_multiplier', { precision: 4, scale: 2 }).default('3.00'),
  maxDrawdownPercent: numeric('max_drawdown_percent', { precision: 5, scale: 2 }).default('15'),
  marginTopUpEnabled: boolean('margin_top_up_enabled').default(false),
  marginTopUpThreshold: numeric('margin_top_up_threshold', { precision: 5, scale: 2 }).default('30'),
  marginTopUpPercent: numeric('margin_top_up_percent', { precision: 5, scale: 2 }).default('10'),
  marginTopUpMaxCount: integer('margin_top_up_max_count').default(3),
  exposureMultiplier: numeric('exposure_multiplier', { precision: 4, scale: 2 }).default('1.50').notNull(),
  minRiskRewardRatioLong: numeric('min_risk_reward_ratio_long', { precision: 4, scale: 2 }).default('1.00'),
  minRiskRewardRatioShort: numeric('min_risk_reward_ratio_short', { precision: 4, scale: 2 }).default('1.00'),
  tpCalculationMode: varchar('tp_calculation_mode', { length: 20 }).$type<'default' | 'fibonacci'>().default('fibonacci').notNull(),
  fibonacciTargetLevel: varchar('fibonacci_target_level', { length: 10 }).$type<'auto' | '1' | '1.272' | '1.382' | '1.5' | '1.618' | '2' | '2.272' | '2.618'>().default('2').notNull(),
  fibonacciTargetLevelLong: varchar('fibonacci_target_level_long', { length: 10 }).$type<'auto' | '1' | '1.272' | '1.382' | '1.5' | '1.618' | '2' | '2.272' | '2.618'>().default('2'),
  fibonacciTargetLevelShort: varchar('fibonacci_target_level_short', { length: 10 }).$type<'auto' | '1' | '1.272' | '1.382' | '1.5' | '1.618' | '2' | '2.272' | '2.618'>().default('1.272'),
  useDynamicSymbolSelection: boolean('use_dynamic_symbol_selection').default(false).notNull(),
  dynamicSymbolRotationInterval: varchar('dynamic_symbol_rotation_interval', { length: 10 }).$type<'1h' | '4h' | '1d'>().default('4h').notNull(),
  dynamicSymbolExcluded: text('dynamic_symbol_excluded'),
  enableAutoRotation: boolean('enable_auto_rotation').default(true).notNull(),
  trailingStopMode: varchar('trailing_stop_mode', { length: 10 }).$type<'local' | 'binance'>().default('local'),
  trailingStopEnabled: boolean('trailing_stop_enabled').default(true).notNull(),
  trailingActivationPercentLong: numeric('trailing_activation_percent_long', { precision: 5, scale: 4 }).default('1.0').notNull(),
  trailingActivationPercentShort: numeric('trailing_activation_percent_short', { precision: 5, scale: 4 }).default('0.886').notNull(),
  trailingDistancePercent: numeric('trailing_distance_percent', { precision: 5, scale: 4 }).default('0.4').notNull(),
  useAdaptiveTrailing: boolean('use_adaptive_trailing').default(true).notNull(),
  pyramidingEnabled: boolean('pyramiding_enabled').default(false).notNull(),
  pyramidingMode: varchar('pyramiding_mode', { length: 20 }).$type<'static' | 'dynamic' | 'fibonacci'>().default('static').notNull(),
  maxPyramidEntries: integer('max_pyramid_entries').default(5).notNull(),
  pyramidProfitThreshold: numeric('pyramid_profit_threshold', { precision: 5, scale: 4 }).default('0.01').notNull(),
  pyramidScaleFactor: numeric('pyramid_scale_factor', { precision: 4, scale: 2 }).default('0.80').notNull(),
  pyramidMinDistance: numeric('pyramid_min_distance', { precision: 5, scale: 4 }).default('0.005').notNull(),
  pyramidUseAtr: boolean('pyramid_use_atr').default(true).notNull(),
  pyramidUseAdx: boolean('pyramid_use_adx').default(true).notNull(),
  pyramidUseRsi: boolean('pyramid_use_rsi').default(false).notNull(),
  pyramidAdxThreshold: integer('pyramid_adx_threshold').default(25).notNull(),
  pyramidRsiLowerBound: integer('pyramid_rsi_lower_bound').default(40).notNull(),
  pyramidRsiUpperBound: integer('pyramid_rsi_upper_bound').default(60).notNull(),
  pyramidFiboLevels: text('pyramid_fibo_levels').default('["1", "1.272", "1.618"]'),
  leverageAwarePyramid: boolean('leverage_aware_pyramid').default(true).notNull(),
  opportunityCostEnabled: boolean('opportunity_cost_enabled').default(false).notNull(),
  maxHoldingPeriodBars: integer('max_holding_period_bars').default(20).notNull(),
  stalePriceThresholdPercent: numeric('stale_price_threshold_percent', { precision: 5, scale: 2 }).default('0.5').notNull(),
  staleTradeAction: varchar('stale_trade_action', { length: 20 }).$type<'ALERT_ONLY' | 'TIGHTEN_STOP' | 'AUTO_CLOSE'>().default('TIGHTEN_STOP').notNull(),
  timeBasedStopTighteningEnabled: boolean('time_based_stop_tightening_enabled').default(true).notNull(),
  timeTightenAfterBars: integer('time_tighten_after_bars').default(10).notNull(),
  timeTightenPercentPerBar: numeric('time_tighten_percent_per_bar', { precision: 5, scale: 2 }).default('5').notNull(),
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
  stopLossOrderId: bigint('stop_loss_order_id', { mode: 'number' }),
  takeProfitOrderId: bigint('take_profit_order_id', { mode: 'number' }),
  orderListId: bigint('order_list_id', { mode: 'number' }),
  exitOrderId: bigint('exit_order_id', { mode: 'number' }).references(() => orders.orderId),
  entryPrice: numeric('entry_price', { precision: 20, scale: 8 }).notNull(),
  exitPrice: numeric('exit_price', { precision: 20, scale: 8 }),
  quantity: numeric({ precision: 20, scale: 8 }).notNull(),
  stopLoss: numeric('stop_loss', { precision: 20, scale: 8 }),
  takeProfit: numeric('take_profit', { precision: 20, scale: 8 }),
  pnl: numeric({ precision: 20, scale: 8 }),
  pnlPercent: numeric('pnl_percent', { precision: 10, scale: 2 }),
  fees: numeric({ precision: 20, scale: 8 }).default('0'),
  exitSource: varchar('exit_source', { length: 50 }),
  exitReason: varchar('exit_reason', { length: 50 }),
  openedAt: timestamp('opened_at', { mode: 'date' }).notNull(),
  closedAt: timestamp('closed_at', { mode: 'date' }),
  status: varchar({ length: 20 }).default('open'), // 'pending' | 'open' | 'closed' | 'cancelled'
  entryOrderType: varchar('entry_order_type', { length: 10 }).$type<'MARKET' | 'LIMIT'>().default('MARKET'),
  limitEntryPrice: numeric('limit_entry_price', { precision: 20, scale: 8 }),
  expiresAt: timestamp('expires_at', { mode: 'date' }),
  marketType: varchar('market_type', { length: 10 }).$type<'SPOT' | 'FUTURES'>().default('SPOT'),
  leverage: integer().default(1),
  liquidationPrice: numeric('liquidation_price', { precision: 20, scale: 8 }),
  accumulatedFunding: numeric('accumulated_funding', { precision: 20, scale: 8 }).default('0'),
  positionSide: varchar('position_side', { length: 10 }).$type<'LONG' | 'SHORT' | 'BOTH'>().default('BOTH'),
  marginTopUpCount: integer('margin_top_up_count').default(0),
  triggerKlineIndex: integer('trigger_kline_index'),
  triggerKlineOpenTime: bigint('trigger_kline_open_time', { mode: 'number' }),
  triggerCandleData: text('trigger_candle_data'),
  triggerIndicatorValues: text('trigger_indicator_values'),
  fibonacciProjection: text('fibonacci_projection'),
  entryFee: numeric('entry_fee', { precision: 20, scale: 8 }),
  exitFee: numeric('exit_fee', { precision: 20, scale: 8 }),
  commissionAsset: varchar('commission_asset', { length: 20 }),
  trailingStopAlgoId: bigint('trailing_stop_algo_id', { mode: 'number' }),
  trailingStopMode: varchar('trailing_stop_mode', { length: 10 }).$type<'local' | 'binance'>(),
  stopLossAlgoId: bigint('stop_loss_algo_id', { mode: 'number' }),
  takeProfitAlgoId: bigint('take_profit_algo_id', { mode: 'number' }),
  stopLossIsAlgo: boolean('stop_loss_is_algo').default(false),
  takeProfitIsAlgo: boolean('take_profit_is_algo').default(false),
  entryInterval: varchar('entry_interval', { length: 10 }),
  barsInTrade: integer('bars_in_trade').default(0),
  lastPriceMovementBar: integer('last_price_movement_bar').default(0),
  highestPriceSinceEntry: numeric('highest_price_since_entry', { precision: 20, scale: 8 }),
  lowestPriceSinceEntry: numeric('lowest_price_since_entry', { precision: 20, scale: 8 }),
  opportunityCostAlertSentAt: timestamp('opportunity_cost_alert_sent_at', { mode: 'date' }),
  originalStopLoss: numeric('original_stop_loss', { precision: 20, scale: 8 }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('trade_executions_user_id_idx').on(table.userId),
  walletIdIdx: index('trade_executions_wallet_id_idx').on(table.walletId),
  statusIdx: index('trade_executions_status_idx').on(table.status),
  openedAtIdx: index('trade_executions_opened_at_idx').on(table.openedAt),
  setupTypeIdx: index('trade_executions_setup_type_idx').on(table.setupType),
  marketTypeIdx: index('trade_executions_market_type_idx').on(table.marketType),
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

export const tradingProfiles = pgTable('trading_profiles', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar({ length: 100 }).notNull(),
  description: text(),
  enabledSetupTypes: text('enabled_setup_types').notNull(),
  maxPositionSize: numeric('max_position_size', { precision: 10, scale: 2 }),
  maxConcurrentPositions: integer('max_concurrent_positions'),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('trading_profiles_user_id_idx').on(table.userId),
}));

export type TradingProfileRow = typeof tradingProfiles.$inferSelect;
export type NewTradingProfileRow = typeof tradingProfiles.$inferInsert;

export const activeWatchers = pgTable('active_watchers', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  walletId: varchar('wallet_id', { length: 255 })
    .notNull()
    .references(() => wallets.id, { onDelete: 'cascade' }),
  profileId: varchar('profile_id', { length: 255 })
    .references(() => tradingProfiles.id, { onDelete: 'set null' }),
  symbol: varchar({ length: 20 }).notNull(),
  interval: varchar({ length: 5 }).notNull(),
  marketType: varchar('market_type', { length: 10 }).$type<'SPOT' | 'FUTURES'>().default('SPOT').notNull(),
  isManual: boolean('is_manual').default(true).notNull(),
  startedAt: timestamp('started_at', { mode: 'date' }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  walletIdIdx: index('active_watchers_wallet_id_idx').on(table.walletId),
  userIdIdx: index('active_watchers_user_id_idx').on(table.userId),
  profileIdIdx: index('active_watchers_profile_id_idx').on(table.profileId),
  marketTypeIdx: index('active_watchers_market_type_idx').on(table.marketType),
  isManualIdx: index('active_watchers_is_manual_idx').on(table.isManual),
}));

export type ActiveWatcherRow = typeof activeWatchers.$inferSelect;
export type NewActiveWatcherRow = typeof activeWatchers.$inferInsert;

export const strategyPerformance = pgTable('strategy_performance', {
  id: serial('id').primaryKey(),
  strategyId: varchar('strategy_id', { length: 100 }).notNull(),
  symbol: varchar({ length: 20 }).notNull(),
  interval: varchar({ length: 10 }).notNull(),
  totalTrades: integer('total_trades').default(0).notNull(),
  winningTrades: integer('winning_trades').default(0).notNull(),
  losingTrades: integer('losing_trades').default(0).notNull(),
  breakevenTrades: integer('breakeven_trades').default(0).notNull(),
  winRate: numeric('win_rate', { precision: 5, scale: 2 }).default('0').notNull(),
  totalPnl: numeric('total_pnl', { precision: 20, scale: 8 }).default('0').notNull(),
  totalPnlPercent: numeric('total_pnl_percent', { precision: 10, scale: 4 }).default('0').notNull(),
  avgWin: numeric('avg_win', { precision: 10, scale: 4 }).default('0').notNull(),
  avgLoss: numeric('avg_loss', { precision: 10, scale: 4 }).default('0').notNull(),
  avgRr: numeric('avg_rr', { precision: 10, scale: 4 }).default('0').notNull(),
  maxDrawdown: numeric('max_drawdown', { precision: 10, scale: 4 }).default('0').notNull(),
  maxConsecutiveLosses: integer('max_consecutive_losses').default(0).notNull(),
  currentConsecutiveLosses: integer('current_consecutive_losses').default(0).notNull(),
  avgSlippagePercent: numeric('avg_slippage_percent', { precision: 10, scale: 4 }).default('0').notNull(),
  avgExecutionTimeMs: integer('avg_execution_time_ms').default(0).notNull(),
  lastTradeAt: timestamp('last_trade_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  uniqueStrategy: unique().on(table.strategyId, table.symbol, table.interval),
  lookupIdx: index('strategy_performance_lookup_idx').on(table.strategyId, table.symbol, table.interval),
  updatedIdx: index('strategy_performance_updated_idx').on(table.updatedAt),
  winRateIdx: index('strategy_performance_win_rate_idx').on(table.winRate),
}));

export const tradeCooldowns = pgTable('trade_cooldowns', {
  id: serial('id').primaryKey(),
  strategyId: varchar('strategy_id', { length: 100 }).notNull(),
  symbol: varchar({ length: 20 }).notNull(),
  interval: varchar({ length: 10 }).notNull(),
  lastExecutionId: varchar('last_execution_id', { length: 50 }).notNull(),
  lastExecutionAt: timestamp('last_execution_at', { mode: 'date' }).notNull(),
  cooldownUntil: timestamp('cooldown_until', { mode: 'date' }).notNull(),
  cooldownMinutes: integer('cooldown_minutes').notNull(),
  walletId: varchar('wallet_id', { length: 50 }).notNull(),
  reason: varchar({ length: 100 }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  uniqueCooldown: unique().on(table.strategyId, table.symbol, table.interval, table.walletId),
  lookupIdx: index('trade_cooldowns_lookup_idx').on(table.strategyId, table.symbol, table.interval, table.walletId),
  expiryIdx: index('trade_cooldowns_expiry_idx').on(table.cooldownUntil),
  walletIdx: index('trade_cooldowns_wallet_idx').on(table.walletId),
}));

export type StrategyPerformance = typeof strategyPerformance.$inferSelect;
export type NewStrategyPerformance = typeof strategyPerformance.$inferInsert;
export type TradeCooldown = typeof tradeCooldowns.$inferSelect;
export type NewTradeCooldown = typeof tradeCooldowns.$inferInsert;

export const apiKeys = pgTable('api_keys', {
  id: varchar({ length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  provider: varchar({ length: 50 }).notNull(),
  keyEncrypted: text('key_encrypted').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  userProviderUnique: unique().on(table.userId, table.provider),
  userIdIdx: index('api_keys_user_id_idx').on(table.userId),
}));

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export const pairMaintenanceLog = pgTable('pair_maintenance_log', {
  id: serial().primaryKey(),
  symbol: text().notNull(),
  interval: text().notNull(),
  marketType: text('market_type').notNull(),
  lastGapCheck: timestamp('last_gap_check', { mode: 'date' }),
  lastCorruptionCheck: timestamp('last_corruption_check', { mode: 'date' }),
  gapsFound: integer('gaps_found').default(0),
  corruptedFixed: integer('corrupted_fixed').default(0),
  earliestKlineDate: timestamp('earliest_kline_date', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  uniquePair: unique().on(table.symbol, table.interval, table.marketType),
  lookupIdx: index('idx_pair_maintenance_lookup').on(table.symbol, table.interval, table.marketType),
  gapCheckIdx: index('idx_last_gap_check').on(table.lastGapCheck),
  corruptionCheckIdx: index('idx_last_corruption_check').on(table.lastCorruptionCheck),
}));

export type PairMaintenanceLog = typeof pairMaintenanceLog.$inferSelect;
export type NewPairMaintenanceLog = typeof pairMaintenanceLog.$inferInsert;

export const userPreferences = pgTable('user_preferences', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  category: varchar({ length: 50 }).notNull(),
  key: varchar({ length: 100 }).notNull(),
  value: text().notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  uniqueUserCategoryKey: unique().on(table.userId, table.category, table.key),
  userIdCategoryIdx: index('user_preferences_user_id_category_idx').on(table.userId, table.category),
}));

export type UserPreference = typeof userPreferences.$inferSelect;
export type NewUserPreference = typeof userPreferences.$inferInsert;
