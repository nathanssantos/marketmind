ALTER TABLE "auto_trading_config" ADD COLUMN "opportunity_cost_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "max_holding_period_bars" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "stale_price_threshold_percent" numeric(5, 2) DEFAULT '0.5' NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "stale_trade_action" varchar(20) DEFAULT 'TIGHTEN_STOP' NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "time_based_stop_tightening_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "time_tighten_after_bars" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "time_tighten_percent_per_bar" numeric(5, 2) DEFAULT '5' NOT NULL;--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "entry_interval" varchar(10);--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "bars_in_trade" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "last_price_movement_bar" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "highest_price_since_entry" numeric(20, 8);--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "lowest_price_since_entry" numeric(20, 8);--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "opportunity_cost_alert_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "original_stop_loss" numeric(20, 8);