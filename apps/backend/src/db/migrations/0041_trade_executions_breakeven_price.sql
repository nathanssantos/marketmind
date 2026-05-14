ALTER TABLE "trade_executions" ADD COLUMN IF NOT EXISTS "breakeven_price" numeric(20, 8);
