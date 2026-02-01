-- Add max_fibonacci_entry_progress_percent column for Entry Level slider
-- Default 100% = allow breakout entries with trailing stop protection

ALTER TABLE "auto_trading_config" ADD COLUMN "max_fibonacci_entry_progress_percent" integer DEFAULT 100 NOT NULL;
