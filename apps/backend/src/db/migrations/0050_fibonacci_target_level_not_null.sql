UPDATE "auto_trading_config" SET "fibonacci_target_level_long" = '2' WHERE "fibonacci_target_level_long" IS NULL;
UPDATE "auto_trading_config" SET "fibonacci_target_level_short" = '1.272' WHERE "fibonacci_target_level_short" IS NULL;
ALTER TABLE "auto_trading_config" ALTER COLUMN "fibonacci_target_level_long" SET NOT NULL;
ALTER TABLE "auto_trading_config" ALTER COLUMN "fibonacci_target_level_short" SET NOT NULL;
