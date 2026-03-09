ALTER TABLE "auto_trading_config"
  ADD COLUMN "initial_stop_mode" varchar(20) NOT NULL DEFAULT 'fibo_target';
