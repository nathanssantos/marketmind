ALTER TABLE "auto_trading_config"
ADD COLUMN "max_global_exposure_percent" NUMERIC(5, 2) DEFAULT '100.00' NOT NULL;
