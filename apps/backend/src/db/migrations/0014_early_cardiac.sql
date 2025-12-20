ALTER TABLE "auto_trading_config" ADD COLUMN "leverage" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "margin_type" varchar(10) DEFAULT 'ISOLATED';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "position_mode" varchar(10) DEFAULT 'ONE_WAY';--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "market_type" varchar(10) DEFAULT 'SPOT';--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "leverage" integer DEFAULT 1;--> statement-breakpoint
CREATE INDEX "trade_executions_market_type_idx" ON "trade_executions" USING btree ("market_type");