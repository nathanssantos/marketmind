ALTER TABLE "auto_trading_config" ALTER COLUMN "use_btc_correlation_filter" SET DEFAULT true;--> statement-breakpoint
UPDATE "auto_trading_config" SET use_btc_correlation_filter = true;