ALTER TABLE "auto_trading_config" ALTER COLUMN "use_direction_filter" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "min_risk_reward_ratio_short" SET DEFAULT '1.00';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "trailing_activation_percent_long" numeric(5, 4) DEFAULT '1.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "trailing_activation_percent_short" numeric(5, 4) DEFAULT '0.886' NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "trailing_distance_percent" numeric(5, 4) DEFAULT '0.4' NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "use_adaptive_trailing" boolean DEFAULT true NOT NULL;