-- Apply optimized defaults from optimization plan (2026-01-31)
-- Based on: Entry Levels & R:R Optimization, Trend Filters Comparison, Monte Carlo Validation

-- Update min risk reward ratio to 0.75 (from 1.0)
ALTER TABLE "auto_trading_config" ALTER COLUMN "min_risk_reward_ratio_long" SET DEFAULT '0.75';
ALTER TABLE "auto_trading_config" ALTER COLUMN "min_risk_reward_ratio_short" SET DEFAULT '0.75';

-- Enable momentum timing filter by default (best trade-off: -6% P&L but -17% drawdown)
ALTER TABLE "auto_trading_config" ALTER COLUMN "use_momentum_timing_filter" SET DEFAULT true;

-- Update existing records with optimized values
UPDATE "auto_trading_config" SET
  min_risk_reward_ratio_long = '0.75',
  min_risk_reward_ratio_short = '0.75',
  use_momentum_timing_filter = true,
  use_trend_filter = false,
  use_adx_filter = false,
  use_btc_correlation_filter = true,
  use_volume_filter = true,
  fibonacci_target_level = '2',
  fibonacci_target_level_long = '2',
  fibonacci_target_level_short = '1.272',
  trailing_activation_percent_long = '0.9',
  trailing_activation_percent_short = '0.8',
  trailing_distance_percent_long = '0.4',
  trailing_distance_percent_short = '0.3'
WHERE min_risk_reward_ratio_long = '1.00' OR min_risk_reward_ratio_short = '1.00';
