ALTER TABLE "auto_trading_config" ALTER COLUMN "use_stochastic_filter" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "use_adx_filter" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "use_trend_filter" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "use_mtf_filter" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "use_btc_correlation_filter" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "use_market_regime_filter" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "use_volume_filter" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "use_funding_filter" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "use_confluence_scoring" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_trading_config" ADD COLUMN "confluence_min_score" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
UPDATE "auto_trading_config" SET "use_stochastic_filter" = false, "use_adx_filter" = false, "use_trend_filter" = false;