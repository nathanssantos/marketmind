CREATE TABLE IF NOT EXISTS "symbol_trailing_stop_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_id" varchar(255) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"use_individual_config" boolean DEFAULT false NOT NULL,
	"trailing_stop_enabled" boolean,
	"trailing_activation_percent_long" numeric(5, 4),
	"trailing_activation_percent_short" numeric(5, 4),
	"trailing_distance_percent_long" numeric(5, 4),
	"trailing_distance_percent_short" numeric(5, 4),
	"use_adaptive_trailing" boolean,
	"use_profit_lock_distance" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "symbol_trailing_stop_overrides" ADD CONSTRAINT "symbol_trailing_stop_overrides_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "symbol_ts_override_wallet_symbol_idx" ON "symbol_trailing_stop_overrides" USING btree ("wallet_id","symbol");
