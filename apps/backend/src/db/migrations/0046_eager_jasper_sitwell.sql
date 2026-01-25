ALTER TABLE "auto_trading_config" ADD COLUMN "use_direction_filter" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "enable_long_in_bear_market" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "enable_short_in_bull_market" boolean DEFAULT false NOT NULL;