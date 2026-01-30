ALTER TABLE "auto_trading_config" ALTER COLUMN "trailing_distance_percent" SET DEFAULT '0.3';--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "trailing_activated_at" timestamp;--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "highest_price_since_trailing_activation" numeric(20, 8);--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "lowest_price_since_trailing_activation" numeric(20, 8);