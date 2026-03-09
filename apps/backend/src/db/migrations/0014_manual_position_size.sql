ALTER TABLE "auto_trading_config"
  ADD COLUMN "manual_position_size_percent" numeric(5, 2) NOT NULL DEFAULT '2.50';
