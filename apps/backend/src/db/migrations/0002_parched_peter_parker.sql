ALTER TABLE "auto_trading_config" ALTER COLUMN "use_momentum_timing_filter" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "use_adx_filter" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "use_trend_filter" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "use_btc_correlation_filter" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "use_volume_filter" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "min_risk_reward_ratio_long" SET DEFAULT '0.50';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "min_risk_reward_ratio_short" SET DEFAULT '1.00';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "max_fibonacci_entry_progress_percent" SET DATA TYPE numeric(5, 1);--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "max_fibonacci_entry_progress_percent" SET DEFAULT '127.2';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "fibonacci_target_level" SET DEFAULT '3.618';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "fibonacci_target_level_long" SET DEFAULT '3.618';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "trailing_activation_percent_long" SET DEFAULT '1.272';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "trailing_activation_percent_short" SET DEFAULT '1.272';