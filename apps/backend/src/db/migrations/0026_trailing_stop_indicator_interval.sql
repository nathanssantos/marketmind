ALTER TABLE "auto_trading_config" ADD COLUMN "trailing_stop_indicator_interval" varchar(10) DEFAULT '30m' NOT NULL;
ALTER TABLE "symbol_trailing_stop_overrides" ADD COLUMN "indicator_interval" varchar(10);
