CREATE TABLE IF NOT EXISTS "user_patterns" (
  "id" varchar(255) PRIMARY KEY NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "pattern_id" varchar(64) NOT NULL,
  "label" varchar(120) NOT NULL,
  "definition" text NOT NULL,
  "is_custom" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "user_patterns_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "user_patterns_user_id_idx" ON "user_patterns" ("user_id");
