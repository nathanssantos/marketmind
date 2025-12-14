CREATE TABLE "market_context_config" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"wallet_id" varchar(255) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"shadow_mode" boolean DEFAULT true NOT NULL,
	"fear_greed_enabled" boolean DEFAULT true NOT NULL,
	"fear_greed_threshold_low" integer DEFAULT 20 NOT NULL,
	"fear_greed_threshold_high" integer DEFAULT 80 NOT NULL,
	"fear_greed_action" varchar(20) DEFAULT 'reduce_size' NOT NULL,
	"fear_greed_size_reduction" integer DEFAULT 50 NOT NULL,
	"funding_rate_enabled" boolean DEFAULT true NOT NULL,
	"funding_rate_threshold" numeric(10, 4) DEFAULT '0.05' NOT NULL,
	"funding_rate_action" varchar(20) DEFAULT 'penalize' NOT NULL,
	"funding_rate_penalty" integer DEFAULT 20 NOT NULL,
	"btc_dominance_enabled" boolean DEFAULT false NOT NULL,
	"btc_dominance_change_threshold" numeric(10, 2) DEFAULT '1.0' NOT NULL,
	"btc_dominance_action" varchar(20) DEFAULT 'reduce_size' NOT NULL,
	"btc_dominance_size_reduction" integer DEFAULT 25 NOT NULL,
	"open_interest_enabled" boolean DEFAULT false NOT NULL,
	"open_interest_change_threshold" numeric(10, 2) DEFAULT '10' NOT NULL,
	"open_interest_action" varchar(20) DEFAULT 'warn_only' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "market_context_config" ADD CONSTRAINT "market_context_config_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_context_config" ADD CONSTRAINT "market_context_config_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "market_context_config_wallet_id_idx" ON "market_context_config" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "market_context_config_user_id_idx" ON "market_context_config" USING btree ("user_id");