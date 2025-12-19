-- Backfill fees for all closed trade executions
-- Formula: entryFee + exitFee where each fee is (price * quantity * 0.001)

UPDATE trade_executions
SET
  fees = (
    -- Entry fee
    (CAST(entry_price AS DECIMAL) * CAST(quantity AS DECIMAL) * 0.001) +
    -- Exit fee
    (CAST(exit_price AS DECIMAL) * CAST(quantity AS DECIMAL) * 0.001)
  ),
  updated_at = NOW()
WHERE
  status = 'closed'
  AND (fees IS NULL OR CAST(fees AS DECIMAL) = 0)
  AND entry_price IS NOT NULL
  AND exit_price IS NOT NULL
  AND quantity IS NOT NULL;

-- Verify the update
SELECT
  id,
  symbol,
  CAST(entry_price AS DECIMAL) as entry_price,
  CAST(exit_price AS DECIMAL) as exit_price,
  CAST(quantity AS DECIMAL) as quantity,
  CAST(fees AS DECIMAL) as fees,
  CAST(pnl AS DECIMAL) as pnl
FROM trade_executions
WHERE status = 'closed'
ORDER BY opened_at DESC
LIMIT 10;
