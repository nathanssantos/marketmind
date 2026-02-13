ALTER TABLE "auto_trading_config"
  ADD COLUMN "trailing_activation_mode_long" varchar(10) DEFAULT 'auto' NOT NULL;
ALTER TABLE "auto_trading_config"
  ADD COLUMN "trailing_activation_mode_short" varchar(10) DEFAULT 'auto' NOT NULL;

ALTER TABLE "symbol_trailing_stop_overrides"
  ADD COLUMN "trailing_activation_mode_long" varchar(10);
ALTER TABLE "symbol_trailing_stop_overrides"
  ADD COLUMN "trailing_activation_mode_short" varchar(10);
ALTER TABLE "symbol_trailing_stop_overrides"
  ADD COLUMN "manual_trailing_activated_long" boolean DEFAULT false;
ALTER TABLE "symbol_trailing_stop_overrides"
  ADD COLUMN "manual_trailing_activated_short" boolean DEFAULT false;
