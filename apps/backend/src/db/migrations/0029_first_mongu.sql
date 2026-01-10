CREATE TABLE "pair_maintenance_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"interval" text NOT NULL,
	"market_type" text NOT NULL,
	"last_gap_check" timestamp,
	"last_corruption_check" timestamp,
	"gaps_found" integer DEFAULT 0,
	"corrupted_fixed" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pair_maintenance_log_symbol_interval_market_type_unique" UNIQUE("symbol","interval","market_type")
);
--> statement-breakpoint
CREATE INDEX "idx_pair_maintenance_lookup" ON "pair_maintenance_log" USING btree ("symbol","interval","market_type");--> statement-breakpoint
CREATE INDEX "idx_last_gap_check" ON "pair_maintenance_log" USING btree ("last_gap_check");--> statement-breakpoint
CREATE INDEX "idx_last_corruption_check" ON "pair_maintenance_log" USING btree ("last_corruption_check");