CREATE TABLE IF NOT EXISTS "checklist_score_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "profile_id" varchar(255) NOT NULL,
  "symbol" varchar(32) NOT NULL,
  "interval" varchar(10) NOT NULL,
  "market_type" varchar(10) DEFAULT 'FUTURES' NOT NULL,
  "score_long" numeric(5, 2) NOT NULL,
  "score_short" numeric(5, 2) NOT NULL,
  "recorded_at" timestamp DEFAULT now() NOT NULL,
  "source" varchar(20) DEFAULT 'live' NOT NULL,
  CONSTRAINT "checklist_score_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "checklist_score_history_profile_id_trading_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "trading_profiles"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "checklist_score_history_scope_idx"
  ON "checklist_score_history" ("profile_id", "symbol", "interval", "market_type", "recorded_at");

CREATE UNIQUE INDEX IF NOT EXISTS "checklist_score_history_unique_idx"
  ON "checklist_score_history" ("profile_id", "symbol", "interval", "market_type", "recorded_at");
