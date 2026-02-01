-- Indicator History Table Migration
-- Stores historical values for ADX, Altcoin Season, and other market indicators
-- Uses TimescaleDB for efficient time-series storage

-- 1. Create indicator_history table
CREATE TABLE IF NOT EXISTS indicator_history (
  id SERIAL,
  indicator_type VARCHAR(50) NOT NULL,
  value NUMERIC(20, 8) NOT NULL,
  metadata TEXT,
  recorded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, recorded_at)
);--> statement-breakpoint

-- 2. Convert to hypertable for time-series optimization
SELECT create_hypertable('indicator_history', by_range('recorded_at'), if_not_exists => TRUE);--> statement-breakpoint

-- 3. Set chunk time interval to 1 day (small table, daily granularity)
SELECT set_chunk_time_interval('indicator_history', INTERVAL '1 day');--> statement-breakpoint

-- 4. Create index for efficient queries by indicator type and time
CREATE INDEX IF NOT EXISTS indicator_history_type_time_idx
ON indicator_history (indicator_type, recorded_at DESC);--> statement-breakpoint

-- 5. Create index for time-based queries
CREATE INDEX IF NOT EXISTS indicator_history_recorded_at_idx
ON indicator_history (recorded_at DESC);--> statement-breakpoint

-- 6. Enable compression
ALTER TABLE indicator_history SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'indicator_type'
);--> statement-breakpoint

-- 7. Add compression policy (compress data older than 7 days)
SELECT add_compression_policy('indicator_history', INTERVAL '7 days', if_not_exists => TRUE);--> statement-breakpoint

-- 8. Add retention policy (keep 90 days of data)
SELECT add_retention_policy('indicator_history', INTERVAL '90 days', if_not_exists => TRUE);
