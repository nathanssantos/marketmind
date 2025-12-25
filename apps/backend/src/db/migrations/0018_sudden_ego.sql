ALTER TABLE "trade_executions" ADD COLUMN "liquidation_price" numeric(20, 8);--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "accumulated_funding" numeric(20, 8) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "position_side" varchar(10) DEFAULT 'BOTH';