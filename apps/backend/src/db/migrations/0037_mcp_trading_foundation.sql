ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "agent_trading_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_trading_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"wallet_id" varchar(255),
	"tool" varchar(64) NOT NULL,
	"status" varchar(20) NOT NULL,
	"input_json" text,
	"result_json" text,
	"error_message" text,
	"idempotency_key" varchar(255),
	"duration_ms" integer,
	"ts" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mcp_trading_audit" ADD CONSTRAINT "mcp_trading_audit_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mcp_trading_audit" ADD CONSTRAINT "mcp_trading_audit_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mcp_trading_audit_user_ts_idx" ON "mcp_trading_audit" ("user_id","ts");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mcp_trading_audit_idempotency_idx" ON "mcp_trading_audit" ("user_id","idempotency_key");
