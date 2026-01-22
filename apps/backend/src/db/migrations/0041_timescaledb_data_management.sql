-- TimescaleDB Data Management Migration
-- Continuous Aggregates, Indexes, Retention, and Compression Policies

-- 1. Create hypertable for klines if not already exists
SELECT create_hypertable('klines', by_range('open_time'), if_not_exists => TRUE);--> statement-breakpoint

-- 2. Set chunk time interval to 7 days
SELECT set_chunk_time_interval('klines', INTERVAL '7 days');--> statement-breakpoint

-- 3. Create performance index for klines queries
CREATE INDEX IF NOT EXISTS idx_klines_symbol_interval_time
ON klines (symbol, interval, market_type, open_time DESC);--> statement-breakpoint

-- 4. Create continuous aggregate for hourly klines from 1m data
CREATE MATERIALIZED VIEW IF NOT EXISTS klines_1h
WITH (timescaledb.continuous) AS
SELECT
  symbol,
  market_type,
  time_bucket('1 hour', open_time) AS open_time,
  first(open, open_time) AS open,
  max(high) AS high,
  min(low) AS low,
  last(close, open_time) AS close,
  sum(volume) AS volume,
  sum(quote_volume) AS quote_volume,
  sum(trades) AS trades
FROM klines
WHERE interval = '1m'
GROUP BY symbol, market_type, time_bucket('1 hour', open_time)
WITH NO DATA;--> statement-breakpoint

-- 6. Create continuous aggregate for 4-hour klines from 1m data
CREATE MATERIALIZED VIEW IF NOT EXISTS klines_4h
WITH (timescaledb.continuous) AS
SELECT
  symbol,
  market_type,
  time_bucket('4 hours', open_time) AS open_time,
  first(open, open_time) AS open,
  max(high) AS high,
  min(low) AS low,
  last(close, open_time) AS close,
  sum(volume) AS volume,
  sum(quote_volume) AS quote_volume,
  sum(trades) AS trades
FROM klines
WHERE interval = '1m'
GROUP BY symbol, market_type, time_bucket('4 hours', open_time)
WITH NO DATA;--> statement-breakpoint

-- 7. Create continuous aggregate for daily klines from 1m data
CREATE MATERIALIZED VIEW IF NOT EXISTS klines_1d
WITH (timescaledb.continuous) AS
SELECT
  symbol,
  market_type,
  time_bucket('1 day', open_time) AS open_time,
  first(open, open_time) AS open,
  max(high) AS high,
  min(low) AS low,
  last(close, open_time) AS close,
  sum(volume) AS volume,
  sum(quote_volume) AS quote_volume,
  sum(trades) AS trades
FROM klines
WHERE interval = '1m'
GROUP BY symbol, market_type, time_bucket('1 day', open_time)
WITH NO DATA;--> statement-breakpoint

-- 8. Add refresh policies for continuous aggregates (refresh every hour)
SELECT add_continuous_aggregate_policy('klines_1h',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);--> statement-breakpoint

SELECT add_continuous_aggregate_policy('klines_4h',
  start_offset => INTERVAL '12 hours',
  end_offset => INTERVAL '4 hours',
  schedule_interval => INTERVAL '4 hours',
  if_not_exists => TRUE
);--> statement-breakpoint

SELECT add_continuous_aggregate_policy('klines_1d',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);--> statement-breakpoint

-- 9. Enable compression on klines table
ALTER TABLE klines SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'symbol, interval, market_type'
);--> statement-breakpoint

-- 10. Add compression policy (compress data older than 30 days)
SELECT add_compression_policy('klines', INTERVAL '30 days', if_not_exists => TRUE);--> statement-breakpoint

-- 11. Add retention policy (remove data older than 2 years for 1m interval)
SELECT add_retention_policy('klines', INTERVAL '2 years', if_not_exists => TRUE);--> statement-breakpoint

-- 12. Create index on orders for archiving queries
CREATE INDEX IF NOT EXISTS idx_orders_status_created
ON orders (status, created_at)
WHERE status IN ('FILLED', 'CANCELED');--> statement-breakpoint

-- 13. Create orders archive table
CREATE TABLE IF NOT EXISTS orders_archive (LIKE orders INCLUDING ALL);--> statement-breakpoint

-- 14. Create index on positions for open positions query
CREATE INDEX IF NOT EXISTS idx_positions_open
ON positions (wallet_id, symbol)
WHERE status = 'open';--> statement-breakpoint

-- 15. Create daily PnL materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_pnl AS
SELECT
  wallet_id,
  user_id,
  date_trunc('day', closed_at) AS trade_date,
  COUNT(*) AS total_trades,
  SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) AS winning_trades,
  SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) AS losing_trades,
  SUM(pnl) AS total_pnl,
  AVG(pnl_percent) AS avg_pnl_percent
FROM trade_executions
WHERE status = 'closed' AND closed_at IS NOT NULL
GROUP BY wallet_id, user_id, date_trunc('day', closed_at);--> statement-breakpoint

-- 16. Create index on daily_pnl materialized view
CREATE INDEX IF NOT EXISTS idx_daily_pnl_wallet_date
ON daily_pnl (wallet_id, trade_date DESC);--> statement-breakpoint

-- 17. Create index on trade_executions for closed trades
CREATE INDEX IF NOT EXISTS idx_trade_executions_closed
ON trade_executions (wallet_id, closed_at DESC)
WHERE status = 'closed';
