ALTER TABLE "auto_trading_config" ALTER COLUMN "use_momentum_timing_filter" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "use_trend_filter" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "use_mtf_filter" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "use_btc_correlation_filter" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "use_market_regime_filter" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "use_funding_filter" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "use_confluence_scoring" SET DEFAULT false;--> statement-breakpoint
UPDATE "auto_trading_config" SET
  use_trend_filter = true,
  use_momentum_timing_filter = false,
  use_mtf_filter = false,
  use_btc_correlation_filter = false,
  use_market_regime_filter = false,
  use_funding_filter = false,
  use_confluence_scoring = false;