ALTER TABLE "trade_executions" ALTER COLUMN "entry_order_type" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "trade_executions" ALTER COLUMN "entry_order_type" SET DEFAULT 'MARKET';