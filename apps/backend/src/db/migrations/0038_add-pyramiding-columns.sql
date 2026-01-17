ALTER TABLE "auto_trading_config" ADD COLUMN "pyramiding_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "pyramiding_mode" varchar(20) DEFAULT 'static' NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "max_pyramid_entries" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "pyramid_profit_threshold" numeric(5, 4) DEFAULT '0.01' NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "pyramid_scale_factor" numeric(4, 2) DEFAULT '0.80' NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "pyramid_min_distance" numeric(5, 4) DEFAULT '0.005' NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "pyramid_use_atr" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "pyramid_use_adx" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "pyramid_use_rsi" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "pyramid_adx_threshold" integer DEFAULT 25 NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "pyramid_rsi_lower_bound" integer DEFAULT 40 NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "pyramid_rsi_upper_bound" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "pyramid_fibo_levels" text DEFAULT '["1", "1.272", "1.618"]';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "leverage_aware_pyramid" boolean DEFAULT true NOT NULL;