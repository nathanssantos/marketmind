ALTER TABLE "auto_trading_config" ADD COLUMN "trailing_stop_mode" varchar(10) DEFAULT 'local';--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "trailing_stop_algo_id" bigint;--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "trailing_stop_mode" varchar(10);