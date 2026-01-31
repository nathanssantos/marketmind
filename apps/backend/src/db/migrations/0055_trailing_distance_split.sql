-- Migration: Split trailing distance into LONG and SHORT
-- Add new columns for separate LONG/SHORT trailing distance

ALTER TABLE "auto_trading_config" ADD COLUMN IF NOT EXISTS "trailing_distance_percent_long" numeric(5, 4) DEFAULT '0.4' NOT NULL;
ALTER TABLE "auto_trading_config" ADD COLUMN IF NOT EXISTS "trailing_distance_percent_short" numeric(5, 4) DEFAULT '0.3' NOT NULL;

-- Update default values for activation percents (optimized values)
ALTER TABLE "auto_trading_config" ALTER COLUMN "trailing_activation_percent_long" SET DEFAULT '0.9';
ALTER TABLE "auto_trading_config" ALTER COLUMN "trailing_activation_percent_short" SET DEFAULT '0.8';

-- Copy existing values to new columns for existing records (using the old single value)
UPDATE "auto_trading_config"
SET
  "trailing_distance_percent_long" = COALESCE("trailing_distance_percent", '0.4'),
  "trailing_distance_percent_short" = COALESCE("trailing_distance_percent", '0.3')
WHERE "trailing_distance_percent_long" = '0.4' AND "trailing_distance_percent_short" = '0.3';
