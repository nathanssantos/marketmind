ALTER TABLE "chart_drawings" ADD COLUMN "interval" varchar(10) DEFAULT '1h' NOT NULL;

DROP INDEX IF EXISTS "chart_drawings_user_symbol_idx";

CREATE INDEX "chart_drawings_user_symbol_interval_idx" ON "chart_drawings" USING btree ("user_id","symbol","interval");
