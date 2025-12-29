CREATE TABLE IF NOT EXISTS "active_watchers" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"wallet_id" varchar(255) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"interval" varchar(5) NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "active_watchers" ADD CONSTRAINT "active_watchers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_watchers" ADD CONSTRAINT "active_watchers_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "active_watchers_wallet_id_idx" ON "active_watchers" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "active_watchers_user_id_idx" ON "active_watchers" USING btree ("user_id");
