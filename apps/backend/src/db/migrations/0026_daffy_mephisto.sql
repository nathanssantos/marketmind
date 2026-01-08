ALTER TABLE "auto_trading_config" ALTER COLUMN "use_stochastic_filter" SET DEFAULT true;--> statement-breakpoint
UPDATE "auto_trading_config" SET "use_stochastic_filter" = true;