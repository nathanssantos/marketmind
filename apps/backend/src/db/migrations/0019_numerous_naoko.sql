ALTER TABLE "auto_trading_config" ADD COLUMN "max_drawdown_percent" numeric(5, 2) DEFAULT '15';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "margin_top_up_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "margin_top_up_threshold" numeric(5, 2) DEFAULT '30';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "margin_top_up_percent" numeric(5, 2) DEFAULT '10';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "margin_top_up_max_count" integer DEFAULT 3;--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "margin_top_up_count" integer DEFAULT 0;