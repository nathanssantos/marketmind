CREATE TABLE IF NOT EXISTS "chart_drawings" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" varchar(255) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "symbol" varchar(50) NOT NULL,
  "type" varchar(20) NOT NULL,
  "data" text NOT NULL,
  "visible" boolean DEFAULT true NOT NULL,
  "locked" boolean DEFAULT false NOT NULL,
  "z_index" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "chart_drawings_user_symbol_idx" ON "chart_drawings"("user_id", "symbol");
