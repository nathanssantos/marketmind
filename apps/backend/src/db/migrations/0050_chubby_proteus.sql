ALTER TABLE "auto_trading_config" ADD COLUMN "use_choppiness_filter" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "choppiness_threshold_high" numeric(5, 2) DEFAULT '61.80';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "choppiness_threshold_low" numeric(5, 2) DEFAULT '38.20';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "choppiness_period" integer DEFAULT 14;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "use_session_filter" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "session_start_utc" integer DEFAULT 13;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "session_end_utc" integer DEFAULT 16;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "use_bollinger_squeeze_filter" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "bollinger_squeeze_threshold" numeric(5, 3) DEFAULT '0.100';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "bollinger_squeeze_period" integer DEFAULT 20;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "bollinger_squeeze_std_dev" numeric(4, 2) DEFAULT '2.00';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "use_vwap_filter" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "use_super_trend_filter" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "super_trend_period" integer DEFAULT 10;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "super_trend_multiplier" numeric(4, 2) DEFAULT '3.00';