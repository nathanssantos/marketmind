import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { resetDatabase, setTestDatabase, type DatabaseType } from '../../db/client';
import * as schema from '../../db/schema';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export type TestDatabase = ReturnType<typeof drizzle<typeof schema>>;

let testDb: TestDatabase | null = null;
let tablesCreated = false;

const dropTablesSQL = `
DROP TABLE IF EXISTS pyramid_entries CASCADE;
DROP TABLE IF EXISTS trade_executions CASCADE;
DROP TABLE IF EXISTS trading_setups CASCADE;
DROP TABLE IF EXISTS setup_detections CASCADE;
DROP TABLE IF EXISTS positions CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS symbol_trailing_stop_overrides CASCADE;
DROP TABLE IF EXISTS auto_trading_config CASCADE;
DROP TABLE IF EXISTS active_watchers CASCADE;
DROP TABLE IF EXISTS strategy_performance CASCADE;
DROP TABLE IF EXISTS trade_cooldowns CASCADE;
DROP TABLE IF EXISTS klines CASCADE;
DROP TABLE IF EXISTS price_cache CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS trading_profiles CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;
DROP TABLE IF EXISTS users CASCADE;
`;

const createTablesSQL = `
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS wallets (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  wallet_type VARCHAR(20) DEFAULT 'paper',
  market_type VARCHAR(10) DEFAULT 'FUTURES',
  api_key_encrypted TEXT NOT NULL,
  api_secret_encrypted TEXT NOT NULL,
  initial_balance NUMERIC(20, 8),
  current_balance NUMERIC(20, 8),
  total_deposits NUMERIC(20, 8) DEFAULT '0',
  total_withdrawals NUMERIC(20, 8) DEFAULT '0',
  last_transfer_sync_at TIMESTAMP,
  currency VARCHAR(10) DEFAULT 'USDT',
  exchange VARCHAR(20) DEFAULT 'BINANCE',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS trading_profiles (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  enabled_setup_types TEXT NOT NULL,
  max_position_size NUMERIC(10, 2),
  max_concurrent_positions INTEGER,
  is_default BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  key_encrypted TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, provider)
);

CREATE TABLE IF NOT EXISTS orders (
  order_id BIGINT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(10) NOT NULL,
  type VARCHAR(30) NOT NULL,
  price VARCHAR(50),
  orig_qty VARCHAR(50),
  executed_qty VARCHAR(50),
  status VARCHAR(30) NOT NULL,
  time_in_force VARCHAR(10),
  time BIGINT,
  update_time BIGINT,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  wallet_id VARCHAR(255) NOT NULL REFERENCES wallets(id),
  setup_id VARCHAR(255),
  setup_type VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  market_type VARCHAR(10) DEFAULT 'FUTURES',
  reduce_only BOOLEAN DEFAULT false,
  stop_loss_intent NUMERIC(20, 8),
  take_profit_intent NUMERIC(20, 8)
);

CREATE TABLE IF NOT EXISTS positions (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  wallet_id VARCHAR(255) NOT NULL REFERENCES wallets(id),
  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(10) NOT NULL,
  entry_price NUMERIC(20, 8) NOT NULL,
  entry_qty NUMERIC(20, 8) NOT NULL,
  current_price NUMERIC(20, 8),
  stop_loss NUMERIC(20, 8),
  take_profit NUMERIC(20, 8),
  pnl NUMERIC(20, 8),
  pnl_percent NUMERIC(10, 2),
  status VARCHAR(20) DEFAULT 'open',
  closed_at TIMESTAMP,
  setup_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  market_type VARCHAR(10) DEFAULT 'FUTURES',
  leverage INTEGER DEFAULT 1,
  margin_type VARCHAR(10),
  liquidation_price NUMERIC(20, 8),
  accumulated_funding NUMERIC(20, 8) DEFAULT '0'
);

CREATE TABLE IF NOT EXISTS active_watchers (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id VARCHAR(255) NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  profile_id VARCHAR(255) REFERENCES trading_profiles(id) ON DELETE SET NULL,
  symbol VARCHAR(20) NOT NULL,
  interval VARCHAR(5) NOT NULL,
  market_type VARCHAR(10) DEFAULT 'FUTURES' NOT NULL,
  exchange VARCHAR(20) DEFAULT 'BINANCE',
  is_manual BOOLEAN DEFAULT true NOT NULL,
  started_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS auto_trading_config (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id VARCHAR(255) NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT false NOT NULL,
  max_concurrent_positions INTEGER DEFAULT 5 NOT NULL,
  max_position_size NUMERIC(10, 2) DEFAULT '15' NOT NULL,
  daily_loss_limit NUMERIC(10, 2) DEFAULT '5' NOT NULL,
  enabled_setup_types TEXT NOT NULL,
  position_sizing VARCHAR(20) DEFAULT 'percentage',
  leverage INTEGER DEFAULT 1,
  margin_type VARCHAR(10) DEFAULT 'ISOLATED',
  position_mode VARCHAR(10) DEFAULT 'ONE_WAY',
  use_limit_orders BOOLEAN DEFAULT false NOT NULL,
  use_stochastic_filter BOOLEAN DEFAULT false NOT NULL,
  use_stochastic_recovery_filter BOOLEAN DEFAULT false NOT NULL,
  use_stochastic_htf_filter BOOLEAN DEFAULT false NOT NULL,
  use_stochastic_recovery_htf_filter BOOLEAN DEFAULT false NOT NULL,
  use_momentum_timing_filter BOOLEAN DEFAULT false NOT NULL,
  use_adx_filter BOOLEAN DEFAULT false NOT NULL,
  use_trend_filter BOOLEAN DEFAULT true NOT NULL,
  use_mtf_filter BOOLEAN DEFAULT false NOT NULL,
  use_btc_correlation_filter BOOLEAN DEFAULT true NOT NULL,
  use_market_regime_filter BOOLEAN DEFAULT false NOT NULL,
  use_direction_filter BOOLEAN DEFAULT false NOT NULL,
  direction_mode VARCHAR(15) DEFAULT 'auto' NOT NULL,
  enable_long_in_bear_market BOOLEAN DEFAULT false NOT NULL,
  enable_short_in_bull_market BOOLEAN DEFAULT false NOT NULL,
  use_volume_filter BOOLEAN DEFAULT false NOT NULL,
  volume_filter_obv_lookback_long INTEGER DEFAULT 7,
  volume_filter_obv_lookback_short INTEGER DEFAULT 5,
  use_obv_check_long BOOLEAN DEFAULT false,
  use_obv_check_short BOOLEAN DEFAULT true,
  use_funding_filter BOOLEAN DEFAULT false NOT NULL,
  use_confluence_scoring BOOLEAN DEFAULT false NOT NULL,
  confluence_min_score INTEGER DEFAULT 60 NOT NULL,
  use_choppiness_filter BOOLEAN DEFAULT false NOT NULL,
  choppiness_threshold_high NUMERIC(5, 2) DEFAULT '61.80',
  choppiness_threshold_low NUMERIC(5, 2) DEFAULT '38.20',
  choppiness_period INTEGER DEFAULT 14,
  use_session_filter BOOLEAN DEFAULT false NOT NULL,
  session_start_utc INTEGER DEFAULT 13,
  session_end_utc INTEGER DEFAULT 16,
  use_bollinger_squeeze_filter BOOLEAN DEFAULT false NOT NULL,
  bollinger_squeeze_threshold NUMERIC(5, 3) DEFAULT '0.100',
  bollinger_squeeze_period INTEGER DEFAULT 20,
  bollinger_squeeze_std_dev NUMERIC(4, 2) DEFAULT '2.00',
  use_vwap_filter BOOLEAN DEFAULT false NOT NULL,
  use_super_trend_filter BOOLEAN DEFAULT false NOT NULL,
  super_trend_period INTEGER DEFAULT 10,
  super_trend_multiplier NUMERIC(4, 2) DEFAULT '3.00',
  max_drawdown_enabled BOOLEAN DEFAULT false,
  max_drawdown_percent NUMERIC(5, 2) DEFAULT '15',
  max_risk_per_stop_enabled BOOLEAN DEFAULT false,
  max_risk_per_stop_percent NUMERIC(5, 2) DEFAULT '2',
  margin_top_up_enabled BOOLEAN DEFAULT false,
  margin_top_up_threshold NUMERIC(5, 2) DEFAULT '30',
  margin_top_up_percent NUMERIC(5, 2) DEFAULT '10',
  margin_top_up_max_count INTEGER DEFAULT 3,
  position_size_percent NUMERIC(5, 2) DEFAULT '10.00' NOT NULL,
  max_global_exposure_percent NUMERIC(5, 2) DEFAULT '100.00' NOT NULL,
  min_risk_reward_ratio_long NUMERIC(4, 2) DEFAULT '0.75',
  min_risk_reward_ratio_short NUMERIC(4, 2) DEFAULT '0.75',
  max_fibonacci_entry_progress_percent NUMERIC(5, 1) DEFAULT '127.2' NOT NULL,
  max_fibonacci_entry_progress_percent_long NUMERIC(5, 1) DEFAULT '127.2' NOT NULL,
  max_fibonacci_entry_progress_percent_short NUMERIC(5, 1) DEFAULT '127.2' NOT NULL,
  tp_calculation_mode VARCHAR(20) DEFAULT 'fibonacci' NOT NULL,
  fibonacci_target_level VARCHAR(10) DEFAULT '2' NOT NULL,
  fibonacci_target_level_long VARCHAR(10) DEFAULT '2',
  fibonacci_target_level_short VARCHAR(10) DEFAULT '1.272',
  fibonacci_swing_range VARCHAR(10) DEFAULT 'nearest' NOT NULL,
  initial_stop_mode VARCHAR(20) DEFAULT 'fibo_target' NOT NULL,
  use_dynamic_symbol_selection BOOLEAN DEFAULT false NOT NULL,
  dynamic_symbol_rotation_interval VARCHAR(10) DEFAULT '4h' NOT NULL,
  dynamic_symbol_excluded TEXT,
  enable_auto_rotation BOOLEAN DEFAULT true NOT NULL,
  trailing_stop_mode VARCHAR(10) DEFAULT 'local',
  trailing_stop_enabled BOOLEAN DEFAULT true NOT NULL,
  trailing_activation_percent_long NUMERIC(5, 4) DEFAULT '0.9' NOT NULL,
  trailing_activation_percent_short NUMERIC(5, 4) DEFAULT '0.8' NOT NULL,
  trailing_distance_percent_long NUMERIC(5, 4) DEFAULT '0.4' NOT NULL,
  trailing_distance_percent_short NUMERIC(5, 4) DEFAULT '0.3' NOT NULL,
  use_adaptive_trailing BOOLEAN DEFAULT true NOT NULL,
  use_profit_lock_distance BOOLEAN DEFAULT false NOT NULL,
  trailing_distance_mode VARCHAR(10) DEFAULT 'fixed' NOT NULL,
  trailing_stop_offset_percent NUMERIC(5,4) DEFAULT '0' NOT NULL,
  trailing_activation_mode_long VARCHAR(10) DEFAULT 'auto' NOT NULL,
  trailing_activation_mode_short VARCHAR(10) DEFAULT 'auto' NOT NULL,
  pyramiding_enabled BOOLEAN DEFAULT false NOT NULL,
  pyramiding_mode VARCHAR(20) DEFAULT 'static' NOT NULL,
  max_pyramid_entries INTEGER DEFAULT 5 NOT NULL,
  pyramid_profit_threshold NUMERIC(5, 4) DEFAULT '0.01' NOT NULL,
  pyramid_scale_factor NUMERIC(4, 2) DEFAULT '0.80' NOT NULL,
  pyramid_min_distance NUMERIC(5, 4) DEFAULT '0.005' NOT NULL,
  pyramid_use_atr BOOLEAN DEFAULT true NOT NULL,
  pyramid_use_adx BOOLEAN DEFAULT true NOT NULL,
  pyramid_use_rsi BOOLEAN DEFAULT false NOT NULL,
  pyramid_adx_threshold INTEGER DEFAULT 25 NOT NULL,
  pyramid_rsi_lower_bound INTEGER DEFAULT 40 NOT NULL,
  pyramid_rsi_upper_bound INTEGER DEFAULT 60 NOT NULL,
  pyramid_fibo_levels TEXT DEFAULT '["1", "1.272", "1.618"]',
  leverage_aware_pyramid BOOLEAN DEFAULT true NOT NULL,
  opportunity_cost_enabled BOOLEAN DEFAULT false NOT NULL,
  max_holding_period_bars INTEGER DEFAULT 20 NOT NULL,
  stale_price_threshold_percent NUMERIC(5, 2) DEFAULT '0.5' NOT NULL,
  stale_trade_action VARCHAR(20) DEFAULT 'TIGHTEN_STOP' NOT NULL,
  time_based_stop_tightening_enabled BOOLEAN DEFAULT true NOT NULL,
  time_tighten_after_bars INTEGER DEFAULT 10 NOT NULL,
  time_tighten_percent_per_bar NUMERIC(5, 2) DEFAULT '5' NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS trading_setups (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  type VARCHAR(100) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  interval VARCHAR(5) NOT NULL,
  direction VARCHAR(10) NOT NULL,
  entry_price NUMERIC(20, 8) NOT NULL,
  stop_loss NUMERIC(20, 8) NOT NULL,
  take_profit NUMERIC(20, 8) NOT NULL,
  confidence INTEGER NOT NULL,
  detected_at TIMESTAMP DEFAULT NOW() NOT NULL,
  order_id BIGINT REFERENCES orders(order_id),
  status VARCHAR(20) DEFAULT 'pending',
  pnl NUMERIC(20, 8),
  pnl_percent NUMERIC(10, 2),
  closed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS setup_detections (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  interval VARCHAR(5) NOT NULL,
  setup_type VARCHAR(100) NOT NULL,
  direction VARCHAR(10) NOT NULL,
  entry_price NUMERIC(20, 8) NOT NULL,
  stop_loss NUMERIC(20, 8),
  take_profit NUMERIC(20, 8),
  confidence INTEGER NOT NULL,
  risk_reward NUMERIC(10, 2),
  metadata TEXT,
  detected_at TIMESTAMP DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  viewed BOOLEAN DEFAULT false,
  notified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS trade_executions (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id VARCHAR(255) NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  setup_id VARCHAR(255),
  setup_type VARCHAR(100),
  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(10) NOT NULL,
  entry_order_id BIGINT REFERENCES orders(order_id),
  stop_loss_order_id BIGINT,
  take_profit_order_id BIGINT,
  order_list_id BIGINT,
  exit_order_id BIGINT REFERENCES orders(order_id),
  entry_price NUMERIC(20, 8) NOT NULL,
  exit_price NUMERIC(20, 8),
  quantity NUMERIC(20, 8) NOT NULL,
  stop_loss NUMERIC(20, 8),
  take_profit NUMERIC(20, 8),
  pnl NUMERIC(20, 8),
  pnl_percent NUMERIC(10, 2),
  fees NUMERIC(20, 8) DEFAULT '0',
  exit_source VARCHAR(50),
  exit_reason VARCHAR(50),
  opened_at TIMESTAMP NOT NULL,
  closed_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'open',
  entry_order_type VARCHAR(10) DEFAULT 'MARKET',
  limit_entry_price NUMERIC(20, 8),
  expires_at TIMESTAMP,
  market_type VARCHAR(10) DEFAULT 'FUTURES',
  leverage INTEGER DEFAULT 1,
  liquidation_price NUMERIC(20, 8),
  accumulated_funding NUMERIC(20, 8) DEFAULT '0',
  position_side VARCHAR(10) DEFAULT 'BOTH',
  margin_top_up_count INTEGER DEFAULT 0,
  trigger_kline_index INTEGER,
  trigger_kline_open_time BIGINT,
  trigger_candle_data TEXT,
  trigger_indicator_values TEXT,
  fibonacci_projection TEXT,
  entry_fee NUMERIC(20, 8),
  exit_fee NUMERIC(20, 8),
  commission_asset VARCHAR(20),
  trailing_stop_algo_id BIGINT,
  trailing_stop_mode VARCHAR(10),
  stop_loss_algo_id BIGINT,
  take_profit_algo_id BIGINT,
  stop_loss_is_algo BOOLEAN DEFAULT false,
  take_profit_is_algo BOOLEAN DEFAULT false,
  entry_interval VARCHAR(10),
  bars_in_trade INTEGER DEFAULT 0,
  last_price_movement_bar INTEGER DEFAULT 0,
  highest_price_since_entry NUMERIC(20, 8),
  lowest_price_since_entry NUMERIC(20, 8),
  trailing_activated_at TIMESTAMP,
  highest_price_since_trailing_activation NUMERIC(20, 8),
  lowest_price_since_trailing_activation NUMERIC(20, 8),
  opportunity_cost_alert_sent_at TIMESTAMP,
  original_stop_loss NUMERIC(20, 8),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS strategy_performance (
  id SERIAL PRIMARY KEY,
  strategy_id VARCHAR(100) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  interval VARCHAR(10) NOT NULL,
  total_trades INTEGER DEFAULT 0 NOT NULL,
  winning_trades INTEGER DEFAULT 0 NOT NULL,
  losing_trades INTEGER DEFAULT 0 NOT NULL,
  breakeven_trades INTEGER DEFAULT 0 NOT NULL,
  win_rate NUMERIC(5, 2) DEFAULT '0' NOT NULL,
  total_pnl NUMERIC(20, 8) DEFAULT '0' NOT NULL,
  total_pnl_percent NUMERIC(10, 4) DEFAULT '0' NOT NULL,
  avg_win NUMERIC(10, 4) DEFAULT '0' NOT NULL,
  avg_loss NUMERIC(10, 4) DEFAULT '0' NOT NULL,
  avg_rr NUMERIC(10, 4) DEFAULT '0' NOT NULL,
  max_drawdown NUMERIC(10, 4) DEFAULT '0' NOT NULL,
  max_consecutive_losses INTEGER DEFAULT 0 NOT NULL,
  current_consecutive_losses INTEGER DEFAULT 0 NOT NULL,
  avg_slippage_percent NUMERIC(10, 4) DEFAULT '0' NOT NULL,
  avg_execution_time_ms INTEGER DEFAULT 0 NOT NULL,
  last_trade_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(strategy_id, symbol, interval)
);

CREATE TABLE IF NOT EXISTS trade_cooldowns (
  id SERIAL PRIMARY KEY,
  strategy_id VARCHAR(100) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  interval VARCHAR(10) NOT NULL,
  last_execution_id VARCHAR(50) NOT NULL,
  last_execution_at TIMESTAMP NOT NULL,
  cooldown_until TIMESTAMP NOT NULL,
  cooldown_minutes INTEGER NOT NULL,
  wallet_id VARCHAR(50) NOT NULL,
  reason VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(strategy_id, symbol, interval, wallet_id)
);

CREATE TABLE IF NOT EXISTS klines (
  symbol VARCHAR(20) NOT NULL,
  interval VARCHAR(5) NOT NULL,
  market_type VARCHAR(10) DEFAULT 'FUTURES' NOT NULL,
  open_time TIMESTAMP NOT NULL,
  close_time TIMESTAMP NOT NULL,
  open NUMERIC(20, 8) NOT NULL,
  high NUMERIC(20, 8) NOT NULL,
  low NUMERIC(20, 8) NOT NULL,
  close NUMERIC(20, 8) NOT NULL,
  volume NUMERIC(20, 8) NOT NULL,
  quote_volume NUMERIC(20, 8),
  trades INTEGER,
  taker_buy_base_volume NUMERIC(20, 8),
  taker_buy_quote_volume NUMERIC(20, 8),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (symbol, interval, market_type, open_time)
);

CREATE TABLE IF NOT EXISTS price_cache (
  symbol VARCHAR(20) PRIMARY KEY,
  price NUMERIC(20, 8) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS pyramid_entries (
  id VARCHAR(255) PRIMARY KEY,
  execution_id VARCHAR(255) NOT NULL REFERENCES trade_executions(id) ON DELETE CASCADE,
  entry_number INTEGER NOT NULL,
  entry_price NUMERIC(20, 8) NOT NULL,
  quantity NUMERIC(20, 8) NOT NULL,
  entry_time TIMESTAMP NOT NULL,
  profit_at_entry NUMERIC(10, 4),
  atr_at_entry NUMERIC(20, 8),
  adx_at_entry NUMERIC(10, 2),
  rsi_at_entry NUMERIC(10, 2),
  order_id BIGINT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(execution_id, entry_number)
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  key VARCHAR(100) NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, category, key)
);

CREATE TABLE IF NOT EXISTS symbol_trailing_stop_overrides (
  id SERIAL PRIMARY KEY,
  wallet_id VARCHAR(255) NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  use_individual_config BOOLEAN DEFAULT false NOT NULL,
  trailing_stop_enabled BOOLEAN,
  trailing_activation_percent_long NUMERIC(5, 4),
  trailing_activation_percent_short NUMERIC(5, 4),
  trailing_distance_percent_long NUMERIC(5, 4),
  trailing_distance_percent_short NUMERIC(5, 4),
  use_adaptive_trailing BOOLEAN,
  use_profit_lock_distance BOOLEAN,
  trailing_distance_mode VARCHAR(10),
  trailing_stop_offset_percent NUMERIC(5,4),
  trailing_activation_mode_long VARCHAR(10),
  trailing_activation_mode_short VARCHAR(10),
  manual_trailing_activated_long BOOLEAN DEFAULT false,
  manual_trailing_activated_short BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE UNIQUE INDEX symbol_ts_override_wallet_symbol_idx ON symbol_trailing_stop_overrides(wallet_id, symbol);
`;

export const setupTestDatabase = async (): Promise<TestDatabase> => {
  if (testDb) return testDb;

  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL not set. Make sure globalSetup is configured in vitest.config.ts'
    );
  }

  pool = new Pool({
    connectionString: databaseUrl,
    max: 5,
  });

  testDb = drizzle(pool, { schema });

  setTestDatabase(testDb as unknown as DatabaseType);

  if (!tablesCreated) {
    await testDb.execute(sql.raw(dropTablesSQL));
    await testDb.execute(sql.raw(createTablesSQL));
    tablesCreated = true;
  }

  return testDb;
};

export const teardownTestDatabase = async (): Promise<void> => {
  resetDatabase();

  if (pool) {
    await pool.end();
    pool = null;
  }
  testDb = null;
};

export const getTestDatabase = (): TestDatabase => {
  if (!testDb) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.');
  }
  return testDb;
};

export const cleanupTables = async (): Promise<void> => {
  const db = getTestDatabase();
  await db.execute(sql`SET session_replication_role = 'replica'`);
  await db.delete(schema.priceCache);
  await db.delete(schema.klines);
  await db.delete(schema.tradeCooldowns);
  await db.delete(schema.strategyPerformance);
  await db.delete(schema.tradeExecutions);
  await db.delete(schema.setupDetections);
  await db.delete(schema.tradingSetups);
  await db.delete(schema.positions);
  await db.delete(schema.orders);
  await db.delete(schema.symbolTrailingStopOverrides);
  await db.delete(schema.autoTradingConfig);
  await db.delete(schema.activeWatchers);
  await db.delete(schema.apiKeys);
  await db.delete(schema.userPreferences);
  await db.delete(schema.tradingProfiles);
  await db.delete(schema.sessions);
  await db.delete(schema.wallets);
  await db.delete(schema.users);
  await db.execute(sql`SET session_replication_role = 'origin'`);
};
