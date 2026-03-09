ALTER TABLE "auto_trading_config" ADD COLUMN "max_fibonacci_entry_progress_percent_long" numeric(5, 1) NOT NULL DEFAULT '127.2';
ALTER TABLE "auto_trading_config" ADD COLUMN "max_fibonacci_entry_progress_percent_short" numeric(5, 1) NOT NULL DEFAULT '127.2';
UPDATE "auto_trading_config" SET "max_fibonacci_entry_progress_percent_long" = "max_fibonacci_entry_progress_percent", "max_fibonacci_entry_progress_percent_short" = "max_fibonacci_entry_progress_percent";
