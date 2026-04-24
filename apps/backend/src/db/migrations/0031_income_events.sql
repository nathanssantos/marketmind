CREATE TABLE IF NOT EXISTS income_events (
  id SERIAL PRIMARY KEY,
  wallet_id VARCHAR(255) NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  binance_tran_id BIGINT NOT NULL,
  income_type VARCHAR(30) NOT NULL,
  amount NUMERIC(20, 8) NOT NULL,
  asset VARCHAR(10) NOT NULL,
  symbol VARCHAR(20),
  execution_id VARCHAR(255),
  info VARCHAR(120),
  trade_id VARCHAR(120),
  source VARCHAR(10) NOT NULL DEFAULT 'binance',
  income_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS income_events_wallet_tran_idx
  ON income_events (wallet_id, binance_tran_id);

CREATE INDEX IF NOT EXISTS income_events_wallet_time_idx
  ON income_events (wallet_id, income_time);

CREATE INDEX IF NOT EXISTS income_events_wallet_type_time_idx
  ON income_events (wallet_id, income_type, income_time);

CREATE INDEX IF NOT EXISTS income_events_execution_idx
  ON income_events (execution_id);
