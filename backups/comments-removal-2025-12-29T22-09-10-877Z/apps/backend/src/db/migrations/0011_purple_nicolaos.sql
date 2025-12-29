ALTER TABLE "orders" ADD COLUMN "market_type" varchar(10) DEFAULT 'SPOT';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "reduce_only" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "market_type" varchar(10) DEFAULT 'SPOT';--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "leverage" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "margin_type" varchar(10);--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "liquidation_price" numeric(20, 8);--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "accumulated_funding" numeric(20, 8) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "entry_order_type" varchar(10) DEFAULT 'MARKET';--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "limit_entry_price" numeric(20, 8);--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "expires_at" timestamp;