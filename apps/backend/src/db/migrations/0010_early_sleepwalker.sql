CREATE TABLE "strategy_performance" (
	"id" serial PRIMARY KEY NOT NULL,
	"strategy_id" varchar(100) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"interval" varchar(10) NOT NULL,
	"total_trades" integer DEFAULT 0 NOT NULL,
	"winning_trades" integer DEFAULT 0 NOT NULL,
	"losing_trades" integer DEFAULT 0 NOT NULL,
	"breakeven_trades" integer DEFAULT 0 NOT NULL,
	"win_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"total_pnl" numeric(20, 8) DEFAULT '0' NOT NULL,
	"total_pnl_percent" numeric(10, 4) DEFAULT '0' NOT NULL,
	"avg_win" numeric(10, 4) DEFAULT '0' NOT NULL,
	"avg_loss" numeric(10, 4) DEFAULT '0' NOT NULL,
	"avg_rr" numeric(10, 4) DEFAULT '0' NOT NULL,
	"max_drawdown" numeric(10, 4) DEFAULT '0' NOT NULL,
	"max_consecutive_losses" integer DEFAULT 0 NOT NULL,
	"current_consecutive_losses" integer DEFAULT 0 NOT NULL,
	"avg_slippage_percent" numeric(10, 4) DEFAULT '0' NOT NULL,
	"avg_execution_time_ms" integer DEFAULT 0 NOT NULL,
	"last_trade_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "strategy_performance_strategy_id_symbol_interval_unique" UNIQUE("strategy_id","symbol","interval")
);
--> statement-breakpoint
CREATE TABLE "trade_cooldowns" (
	"id" serial PRIMARY KEY NOT NULL,
	"strategy_id" varchar(100) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"interval" varchar(10) NOT NULL,
	"last_execution_id" varchar(50) NOT NULL,
	"last_execution_at" timestamp NOT NULL,
	"cooldown_until" timestamp NOT NULL,
	"cooldown_minutes" integer NOT NULL,
	"wallet_id" varchar(50) NOT NULL,
	"reason" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trade_cooldowns_strategy_id_symbol_interval_wallet_id_unique" UNIQUE("strategy_id","symbol","interval","wallet_id")
);
--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "exit_source" varchar(50);--> statement-breakpoint
ALTER TABLE "trade_executions" ADD COLUMN "exit_reason" varchar(50);--> statement-breakpoint
CREATE INDEX "strategy_performance_lookup_idx" ON "strategy_performance" USING btree ("strategy_id","symbol","interval");--> statement-breakpoint
CREATE INDEX "strategy_performance_updated_idx" ON "strategy_performance" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "strategy_performance_win_rate_idx" ON "strategy_performance" USING btree ("win_rate");--> statement-breakpoint
CREATE INDEX "trade_cooldowns_lookup_idx" ON "trade_cooldowns" USING btree ("strategy_id","symbol","interval","wallet_id");--> statement-breakpoint
CREATE INDEX "trade_cooldowns_expiry_idx" ON "trade_cooldowns" USING btree ("cooldown_until");--> statement-breakpoint
CREATE INDEX "trade_cooldowns_wallet_idx" ON "trade_cooldowns" USING btree ("wallet_id");