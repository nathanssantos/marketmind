ALTER TABLE "active_watchers" ADD COLUMN "is_manual" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "use_dynamic_symbol_selection" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "dynamic_symbol_limit" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "dynamic_symbol_rotation_interval" varchar(10) DEFAULT '4h' NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "dynamic_symbol_excluded" text;--> statement-breakpoint
CREATE INDEX "active_watchers_is_manual_idx" ON "active_watchers" USING btree ("is_manual");