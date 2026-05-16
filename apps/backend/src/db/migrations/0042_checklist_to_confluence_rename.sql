-- v1.22.10 — rename the "checklist" feature to "confluence" across the schema.
--
-- The previous naming ("checklist") was a placeholder during prototyping;
-- the feature is, in industry terms, a multi-condition confluence panel
-- (TrendSpider / TC2000 use the same term). The auto-trading filter side
-- of the codebase already used `useConfluenceScoring` / `confluenceMinScore`
-- for a related-but-distinct aggregation; this migration unifies the
-- naming under "confluence" everywhere.
--
-- Renames (data-preserving — no DROP, no data loss):
--   trading_profiles.checklist_conditions     → confluence_conditions
--   checklist_score_history (table + indices) → confluence_score_history
--   panel id 'checklist' inside user_layouts.data JSON → 'confluence'
--
-- The user_layouts JSON update is a string REPLACE on the serialised
-- payload (data column is text). The pattern `"kind":"checklist"` is
-- specific enough that it won't false-positive against any other value;
-- the same string is what the frontend writes via JSON.stringify of the
-- panel kind union (see apps/electron/src/shared/types/layout.ts).

ALTER TABLE "trading_profiles"
  RENAME COLUMN "checklist_conditions" TO "confluence_conditions";

ALTER TABLE "checklist_score_history" RENAME TO "confluence_score_history";

ALTER INDEX "checklist_score_history_scope_idx"
  RENAME TO "confluence_score_history_scope_idx";
ALTER INDEX "checklist_score_history_unique_idx"
  RENAME TO "confluence_score_history_unique_idx";

-- FK constraints are auto-renamed by Postgres on ALTER TABLE ... RENAME TO,
-- but the constraint NAMES still embed "checklist_*". Rename them too so
-- pg_dump / future diffs stay legible.
ALTER TABLE "confluence_score_history"
  RENAME CONSTRAINT "checklist_score_history_user_id_users_id_fk"
  TO "confluence_score_history_user_id_users_id_fk";
ALTER TABLE "confluence_score_history"
  RENAME CONSTRAINT "checklist_score_history_profile_id_trading_profiles_id_fk"
  TO "confluence_score_history_profile_id_trading_profiles_id_fk";

UPDATE "user_layouts"
  SET "data" = REPLACE("data", '"kind":"checklist"', '"kind":"confluence"')
  WHERE "data" LIKE '%"kind":"checklist"%';

UPDATE "user_layouts_history"
  SET "data" = REPLACE("data", '"kind":"checklist"', '"kind":"confluence"')
  WHERE "data" LIKE '%"kind":"checklist"%';
