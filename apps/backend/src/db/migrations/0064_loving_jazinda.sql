ALTER TABLE "active_watchers" ALTER COLUMN "market_type" SET DEFAULT 'FUTURES';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "fibonacci_target_level_long" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "fibonacci_target_level_short" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "klines" ALTER COLUMN "market_type" SET DEFAULT 'FUTURES';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "market_type" SET DEFAULT 'FUTURES';--> statement-breakpoint
ALTER TABLE "positions" ALTER COLUMN "market_type" SET DEFAULT 'FUTURES';--> statement-breakpoint
ALTER TABLE "trade_executions" ALTER COLUMN "market_type" SET DEFAULT 'FUTURES';--> statement-breakpoint
ALTER TABLE "wallets" ALTER COLUMN "market_type" SET DEFAULT 'FUTURES';--> statement-breakpoint
ALTER TABLE "active_watchers" ADD COLUMN "exchange" varchar(20) DEFAULT 'BINANCE';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "use_stochastic_recovery_filter" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "direction_mode" varchar(15) DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "max_global_exposure_percent" numeric(5, 2) DEFAULT '100.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "fibonacci_swing_range" varchar(10) DEFAULT 'nearest' NOT NULL;