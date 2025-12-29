-- Add close_time column (nullable first to allow migration with existing data)
ALTER TABLE "klines" ADD COLUMN "close_time" timestamp;

-- Update existing rows: calculate closeTime based on openTime + interval duration
-- For simplicity, we'll set closeTime = openTime + interval - 1ms for existing rows
-- This will be corrected when data is re-fetched from Binance
UPDATE "klines" SET "close_time" = "open_time" + INTERVAL '1 hour' - INTERVAL '1 millisecond' WHERE "interval" = '1h' AND "close_time" IS NULL;
UPDATE "klines" SET "close_time" = "open_time" + INTERVAL '4 hours' - INTERVAL '1 millisecond' WHERE "interval" = '4h' AND "close_time" IS NULL;
UPDATE "klines" SET "close_time" = "open_time" + INTERVAL '1 day' - INTERVAL '1 millisecond' WHERE "interval" = '1d' AND "close_time" IS NULL;
UPDATE "klines" SET "close_time" = "open_time" + INTERVAL '1 week' - INTERVAL '1 millisecond' WHERE "interval" = '1w' AND "close_time" IS NULL;
UPDATE "klines" SET "close_time" = "open_time" + INTERVAL '5 minutes' - INTERVAL '1 millisecond' WHERE "interval" = '5m' AND "close_time" IS NULL;
UPDATE "klines" SET "close_time" = "open_time" + INTERVAL '15 minutes' - INTERVAL '1 millisecond' WHERE "interval" = '15m' AND "close_time" IS NULL;
UPDATE "klines" SET "close_time" = "open_time" + INTERVAL '30 minutes' - INTERVAL '1 millisecond' WHERE "interval" = '30m' AND "close_time" IS NULL;
UPDATE "klines" SET "close_time" = "open_time" + INTERVAL '1 minute' - INTERVAL '1 millisecond' WHERE "interval" = '1m' AND "close_time" IS NULL;
UPDATE "klines" SET "close_time" = "open_time" + INTERVAL '3 minutes' - INTERVAL '1 millisecond' WHERE "interval" = '3m' AND "close_time" IS NULL;
UPDATE "klines" SET "close_time" = "open_time" + INTERVAL '2 hours' - INTERVAL '1 millisecond' WHERE "interval" = '2h' AND "close_time" IS NULL;
UPDATE "klines" SET "close_time" = "open_time" + INTERVAL '6 hours' - INTERVAL '1 millisecond' WHERE "interval" = '6h' AND "close_time" IS NULL;
UPDATE "klines" SET "close_time" = "open_time" + INTERVAL '8 hours' - INTERVAL '1 millisecond' WHERE "interval" = '8h' AND "close_time" IS NULL;
UPDATE "klines" SET "close_time" = "open_time" + INTERVAL '12 hours' - INTERVAL '1 millisecond' WHERE "interval" = '12h' AND "close_time" IS NULL;
UPDATE "klines" SET "close_time" = "open_time" + INTERVAL '3 days' - INTERVAL '1 millisecond' WHERE "interval" = '3d' AND "close_time" IS NULL;
UPDATE "klines" SET "close_time" = "open_time" + INTERVAL '30 days' - INTERVAL '1 millisecond' WHERE "interval" = '1M' AND "close_time" IS NULL;

-- Set NOT NULL constraint after populating data
ALTER TABLE "klines" ALTER COLUMN "close_time" SET NOT NULL;