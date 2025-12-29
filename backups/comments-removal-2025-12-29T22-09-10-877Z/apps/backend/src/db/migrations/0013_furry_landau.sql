ALTER TABLE "klines" DROP CONSTRAINT "klines_symbol_interval_open_time_pk";--> statement-breakpoint
ALTER TABLE "klines" ADD CONSTRAINT "klines_symbol_interval_market_type_open_time_pk" PRIMARY KEY("symbol","interval","market_type","open_time");--> statement-breakpoint
ALTER TABLE "active_watchers" ADD COLUMN "market_type" varchar(10) DEFAULT 'SPOT' NOT NULL;--> statement-breakpoint
ALTER TABLE "klines" ADD COLUMN "market_type" varchar(10) DEFAULT 'SPOT' NOT NULL;--> statement-breakpoint
CREATE INDEX "active_watchers_market_type_idx" ON "active_watchers" USING btree ("market_type");