ALTER TABLE "trading_profiles"
  ADD COLUMN IF NOT EXISTS "checklist_conditions" text DEFAULT '[]' NOT NULL;
