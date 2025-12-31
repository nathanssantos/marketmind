DROP TABLE "ai_conversations" CASCADE;--> statement-breakpoint
DROP TABLE "ai_trades" CASCADE;--> statement-breakpoint
DROP TABLE "market_context_config" CASCADE;--> statement-breakpoint
DROP TABLE "ml_evaluations" CASCADE;--> statement-breakpoint
DROP TABLE "ml_feature_cache" CASCADE;--> statement-breakpoint
DROP TABLE "ml_models" CASCADE;--> statement-breakpoint
DROP TABLE "ml_predictions" CASCADE;--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "trigger_kline_index" integer;--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "trigger_kline_open_time" bigint;--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "trigger_candle_data" text;--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "trigger_indicator_values" text;