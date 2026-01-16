ALTER TABLE "trade_executions" ADD COLUMN "stop_loss_algo_id" bigint;--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "take_profit_algo_id" bigint;--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "stop_loss_is_algo" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "take_profit_is_algo" boolean DEFAULT false;