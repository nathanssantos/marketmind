-- Migration: Strategy Performance Tracking
-- Created: 2025-12-15
-- Purpose: Track detailed performance metrics per strategy/symbol/interval

CREATE TABLE IF NOT EXISTS strategy_performance (
  id SERIAL PRIMARY KEY,
  strategy_id VARCHAR(100) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  interval VARCHAR(10) NOT NULL,
  
  -- Trade counts
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  breakeven_trades INTEGER DEFAULT 0,
  
  -- Performance metrics
  win_rate DECIMAL(5,2) DEFAULT 0,
  total_pnl DECIMAL(20,8) DEFAULT 0,
  total_pnl_percent DECIMAL(10,4) DEFAULT 0,
  avg_win DECIMAL(10,4) DEFAULT 0,
  avg_loss DECIMAL(10,4) DEFAULT 0,
  avg_rr DECIMAL(10,4) DEFAULT 0,
  
  -- Risk metrics
  max_drawdown DECIMAL(10,4) DEFAULT 0,
  max_consecutive_losses INTEGER DEFAULT 0,
  current_consecutive_losses INTEGER DEFAULT 0,
  
  -- Execution metrics
  avg_slippage_percent DECIMAL(10,4) DEFAULT 0,
  avg_execution_time_ms INTEGER DEFAULT 0,
  
  -- Last update
  last_trade_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Composite unique index
  UNIQUE(strategy_id, symbol, interval)
);

CREATE INDEX idx_strategy_performance_lookup ON strategy_performance(strategy_id, symbol, interval);
CREATE INDEX idx_strategy_performance_updated ON strategy_performance(updated_at DESC);
CREATE INDEX idx_strategy_performance_win_rate ON strategy_performance(win_rate DESC);

COMMENT ON TABLE strategy_performance IS 'Real-time performance tracking per strategy/symbol/interval combination';
COMMENT ON COLUMN strategy_performance.avg_rr IS 'Average risk:reward ratio (avgWin/avgLoss)';
COMMENT ON COLUMN strategy_performance.avg_slippage_percent IS 'Average slippage between expected and executed price';
