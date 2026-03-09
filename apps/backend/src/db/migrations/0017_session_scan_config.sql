ALTER TABLE "auto_trading_config" ADD COLUMN "session_scan_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "auto_trading_config" ADD COLUMN "session_scan_markets" text DEFAULT '[]' NOT NULL;
