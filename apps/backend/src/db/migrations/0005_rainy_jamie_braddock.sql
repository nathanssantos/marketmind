ALTER TABLE "auto_trading_config" ALTER COLUMN "use_choppiness_filter" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "use_vwap_filter" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "min_risk_reward_ratio_long" SET DEFAULT '1.00';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "fibonacci_target_level" SET DEFAULT '1.272';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "fibonacci_target_level_long" SET DEFAULT '1.272';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "trailing_activation_percent_long" SET DEFAULT '0.9';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "trailing_distance_percent_long" SET DEFAULT '0.6';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "trailing_distance_percent_short" SET DEFAULT '0.15';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "use_profit_lock_distance" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "trailing_stop_offset_percent" SET DEFAULT '0.002';--> statement-breakpoint
UPDATE "auto_trading_config" SET
  "use_choppiness_filter" = true,
  "use_vwap_filter" = true,
  "min_risk_reward_ratio_long" = '1.00',
  "fibonacci_target_level" = '1.272',
  "fibonacci_target_level_long" = '1.272',
  "trailing_activation_percent_long" = '0.9',
  "trailing_distance_percent_long" = '0.6',
  "trailing_distance_percent_short" = '0.15',
  "use_profit_lock_distance" = true,
  "trailing_stop_offset_percent" = '0.002';