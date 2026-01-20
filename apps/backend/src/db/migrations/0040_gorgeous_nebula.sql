ALTER TABLE "auto_trading_config" ALTER COLUMN "tp_calculation_mode" SET DEFAULT 'fibonacci';--> statement-breakpoint
ALTER TABLE "auto_trading_config" ALTER COLUMN "fibonacci_target_level" SET DEFAULT '2';--> statement-breakpoint
ALTER TABLE "wallets" ADD COLUMN "total_deposits" numeric(20, 8) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "wallets" ADD COLUMN "total_withdrawals" numeric(20, 8) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "wallets" ADD COLUMN "last_transfer_sync_at" timestamp;