ALTER TABLE "trade_executions" ADD COLUMN "entry_fee" numeric(20, 8);--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "exit_fee" numeric(20, 8);--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "commission_asset" varchar(20);