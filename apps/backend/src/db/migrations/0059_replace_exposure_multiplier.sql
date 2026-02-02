-- Migration: Replace exposure_multiplier with position_size_percent
-- The new approach uses a fixed percentage of capital per position (default 10%)
-- instead of a multiplier that divided capital by watcher count

-- Add the new column
ALTER TABLE "auto_trading_config" ADD COLUMN "position_size_percent" NUMERIC(5, 2) DEFAULT '10.00' NOT NULL;

-- Drop the old column
ALTER TABLE "auto_trading_config" DROP COLUMN "exposure_multiplier";
