CREATE TABLE realized_pnl_events (
  id SERIAL PRIMARY KEY,
  wallet_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  execution_id VARCHAR(255) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  event_type VARCHAR(20) NOT NULL,
  pnl NUMERIC(20, 8) NOT NULL,
  fees NUMERIC(20, 8) DEFAULT '0',
  quantity NUMERIC(20, 8) NOT NULL,
  price NUMERIC(20, 8) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX realized_pnl_events_wallet_date_idx ON realized_pnl_events (wallet_id, created_at);
