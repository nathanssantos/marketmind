ALTER TABLE "orders" ADD COLUMN "stop_loss_intent" numeric(20, 8);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "take_profit_intent" numeric(20, 8);