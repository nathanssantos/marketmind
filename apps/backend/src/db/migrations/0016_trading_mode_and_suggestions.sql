ALTER TABLE "auto_trading_config" ADD COLUMN "trading_mode" varchar(20) DEFAULT 'auto' NOT NULL;

CREATE TABLE IF NOT EXISTS "signal_suggestions" (
  "id" varchar(255) PRIMARY KEY NOT NULL,
  "user_id" varchar(255) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "wallet_id" varchar(255) NOT NULL REFERENCES "wallets"("id") ON DELETE CASCADE,
  "watcher_id" varchar(255),
  "symbol" varchar(20) NOT NULL,
  "interval" varchar(5) NOT NULL,
  "side" varchar(10) NOT NULL,
  "setup_type" varchar(100) NOT NULL,
  "strategy_id" varchar(100),
  "entry_price" numeric(20, 8) NOT NULL,
  "stop_loss" numeric(20, 8),
  "take_profit" numeric(20, 8),
  "risk_reward_ratio" numeric(6, 2),
  "confidence" integer,
  "fibonacci_projection" text,
  "trigger_kline_open_time" bigint,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "position_size_percent" numeric(5, 2),
  "trade_execution_id" varchar(255) REFERENCES "trade_executions"("id") ON DELETE SET NULL,
  "expires_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "signal_suggestions_user_id_idx" ON "signal_suggestions" ("user_id");
CREATE INDEX IF NOT EXISTS "signal_suggestions_wallet_id_idx" ON "signal_suggestions" ("wallet_id");
CREATE INDEX IF NOT EXISTS "signal_suggestions_status_idx" ON "signal_suggestions" ("status");
