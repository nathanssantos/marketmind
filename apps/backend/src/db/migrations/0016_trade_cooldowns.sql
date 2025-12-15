-- Migration: Trade Cooldowns Persistence
-- Created: 2025-12-15
-- Purpose: Persist trade cooldowns to survive server restarts

CREATE TABLE IF NOT EXISTS trade_cooldowns (
  id SERIAL PRIMARY KEY,
  strategy_id VARCHAR(100) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  interval VARCHAR(10) NOT NULL,
  
  -- Cooldown info
  last_execution_id VARCHAR(50) NOT NULL,
  last_execution_at TIMESTAMP NOT NULL,
  cooldown_until TIMESTAMP NOT NULL,
  cooldown_minutes INTEGER NOT NULL,
  
  -- Metadata
  wallet_id VARCHAR(50) NOT NULL,
  reason VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Composite unique index
  UNIQUE(strategy_id, symbol, interval, wallet_id)
);

CREATE INDEX idx_cooldowns_lookup ON trade_cooldowns(strategy_id, symbol, interval, wallet_id);
CREATE INDEX idx_cooldowns_expiry ON trade_cooldowns(cooldown_until);
CREATE INDEX idx_cooldowns_wallet ON trade_cooldowns(wallet_id);

-- Auto-cleanup: Delete expired cooldowns
CREATE OR REPLACE FUNCTION cleanup_expired_cooldowns()
RETURNS void AS $$
BEGIN
  DELETE FROM trade_cooldowns WHERE cooldown_until < NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE trade_cooldowns IS 'Persistent trade cooldowns to prevent duplicate executions across restarts';
COMMENT ON FUNCTION cleanup_expired_cooldowns IS 'Remove expired cooldowns to keep table clean';
