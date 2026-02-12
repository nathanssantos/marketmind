-- MarketMind Auto-Trading Backend Migration
-- Run this script to create the new tables for auto-trading

-- Table: auto_trading_config
-- Stores auto-trading configuration per wallet
CREATE TABLE IF NOT EXISTS auto_trading_config (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id VARCHAR(255) NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    max_concurrent_positions INTEGER NOT NULL DEFAULT 3,
    max_position_size NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
    daily_loss_limit NUMERIC(10, 2) NOT NULL DEFAULT 5.00,
    enabled_setup_types TEXT NOT NULL,
    position_sizing VARCHAR(20) DEFAULT 'percentage',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indices for auto_trading_config
CREATE INDEX IF NOT EXISTS auto_trading_config_user_id_idx ON auto_trading_config(user_id);
CREATE INDEX IF NOT EXISTS auto_trading_config_wallet_id_idx ON auto_trading_config(wallet_id);

-- Table: trade_executions
-- Stores trade execution history
CREATE TABLE IF NOT EXISTS trade_executions (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id VARCHAR(255) NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    setup_id VARCHAR(255),
    setup_type VARCHAR(100),
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL,
    entry_order_id BIGINT REFERENCES orders(order_id),
    exit_order_id BIGINT REFERENCES orders(order_id),
    entry_price NUMERIC(20, 8) NOT NULL,
    exit_price NUMERIC(20, 8),
    quantity NUMERIC(20, 8) NOT NULL,
    stop_loss NUMERIC(20, 8),
    take_profit NUMERIC(20, 8),
    pnl NUMERIC(20, 8),
    pnl_percent NUMERIC(10, 2),
    fees NUMERIC(20, 8) DEFAULT 0,
    opened_at TIMESTAMP NOT NULL,
    closed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indices for trade_executions
CREATE INDEX IF NOT EXISTS trade_executions_user_id_idx ON trade_executions(user_id);
CREATE INDEX IF NOT EXISTS trade_executions_wallet_id_idx ON trade_executions(wallet_id);
CREATE INDEX IF NOT EXISTS trade_executions_status_idx ON trade_executions(status);
CREATE INDEX IF NOT EXISTS trade_executions_opened_at_idx ON trade_executions(opened_at);
CREATE INDEX IF NOT EXISTS trade_executions_setup_type_idx ON trade_executions(setup_type);

-- Table: price_cache
-- Caches real-time prices for position monitoring
CREATE TABLE IF NOT EXISTS price_cache (
    symbol VARCHAR(20) PRIMARY KEY,
    price NUMERIC(20, 8) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for price_cache
CREATE INDEX IF NOT EXISTS price_cache_timestamp_idx ON price_cache(timestamp);

-- Verify tables were created
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size(quote_ident(tablename))) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('auto_trading_config', 'trade_executions', 'price_cache')
ORDER BY tablename;

-- Show indices
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('auto_trading_config', 'trade_executions', 'price_cache')
ORDER BY tablename, indexname;

-- Migration completed successfully!
-- Next steps:
-- 1. Verify tables exist
-- 2. Restart backend server
-- 3. Check logs for Position Monitor and Binance Price Stream startup
