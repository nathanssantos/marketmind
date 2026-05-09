-- v1.5: widen the income_events dedup key to include income_type.
--
-- Binance emits multiple income events with the SAME tranId for a single
-- futures trade — typically one REALIZED_PNL plus one COMMISSION (and
-- optionally a FUNDING_FEE / INSURANCE_CLEAR). The original
-- `(wallet_id, binance_tran_id)` unique index dropped the second-to-arrive
-- event for each tranId, silently under-counting fees and skewing the
-- analytics calendar.
--
-- Incident 2026-05-09: today's COMMISSION sum in DB was -$213.72 vs
-- -$451.14 on Binance because 215 commission rows had been clobbered by
-- earlier-arriving REALIZED_PNL rows with the same tranId.

DROP INDEX IF EXISTS "income_events_wallet_tran_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "income_events_wallet_tran_type_idx"
  ON "income_events" ("wallet_id", "binance_tran_id", "income_type");
