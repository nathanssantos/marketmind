CREATE TABLE IF NOT EXISTS "user_indicators" (
  "id" varchar(255) PRIMARY KEY,
  "user_id" varchar(255) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "catalog_type" varchar(64) NOT NULL,
  "label" varchar(120) NOT NULL,
  "params" text NOT NULL,
  "is_custom" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "user_indicators_user_id_idx" ON "user_indicators" ("user_id");
