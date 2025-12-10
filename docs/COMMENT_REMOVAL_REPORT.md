# Comment Removal Report
Generated: 2025-12-10T21:56:41.899Z

## Summary
- Files scanned: 649
- Files with removable comments: 64
- Total removable comments: 654

## Files with Removable Comments

### apps/backend/optimize-all-strategies.ts

17 removable comments found:

- Line 82 (inline): `// Get all active strategies`
- Line 105 (inline): `// Get current baseline performance`
- Line 110 (inline): `// Read strategy file to get parameter definitions`
- Line 115 (inline): `// Build parameter grid for optimization`
- Line 120 (inline): `// Adaptive grid: fewer values per param when many params exist`
- Line 121 (inline): `// Target: max ~10,000 combinations (4^5=1024, 3^7=2187, 2^10=1024)`
- Line 131 (inline): `// Generate values across the range`
- Line 147 (inline): `// Calculate total combinations`
- Line 175 (inline): `// Save full output`
- Line 178 (inline): `// Extract optimized metrics`
- Line 184 (inline): `// Check if improved: PnL must be better AND must have trades`
- Line 190 (inline): `// Extract optimized parameters from output`
- Line 191 (inline): `// The optimization result will be in the results directory`
- Line 204 (inline): `// Update strategy file with new optimized params`
- Line 260 (inline): `// Save results`
- Line 266 (inline): `// Display summary`
- Line 276 (inline): `// Show improved strategies`

### apps/backend/src/cli/backtest-runner.ts

10 removable comments found:

- Line 21 (inline): `// Validate command`
- Line 48 (inline): `// Optimize command`
- Line 83 (inline): `// Compare command`
- Line 93 (inline): `// Export command`
- Line 104 (inline): `// Walk-forward command`
- Line 128 (inline): `// Monte Carlo command`
- Line 150 (inline): `// Sensitivity command`
- Line 172 (inline): `// Benchmark command`
- Line 183 (inline): `// Error handling`
- Line 195 (inline): `// Show help if no command provided`

### apps/backend/src/cli/commands/compare.ts

16 removable comments found:

- Line 16 (inline): `// Validate inputs`
- Line 25 (inline): `// Validate all file paths exist`
- Line 34 (inline): `// Load all results`
- Line 52 (inline): `// Compare results`
- Line 55 (inline): `// Display comparison table`
- Line 58 (inline): `// Find best performer`
- Line 77 (inline): `// Determine if we have validation or optimization results`
- Line 82 (inline): `// Display validation comparison table`
- Line 119 (inline): `// Display optimization comparison table`
- Line 156 (inline): `// Mixed types - display both`
- Line 194 (inline): `// Best by PnL`
- Line 200 (inline): `// Best by Win Rate`
- Line 206 (inline): `// Best by Profit Factor`
- Line 212 (inline): `// Best by Sharpe`
- Line 223 (inline): `// Best by best PnL`
- Line 229 (inline): `// Best by average PnL`

### apps/backend/src/cli/commands/export.ts

6 removable comments found:

- Line 17 (inline): `// Validate inputs`
- Line 33 (inline): `// Load result`
- Line 39 (inline): `// Determine output filename`
- Line 44 (inline): `// Auto-generate output filename`
- Line 53 (inline): `// Export based on type`
- Line 68 (inline): `// Display preview`

### apps/backend/src/cli/commands/montecarlo.ts

20 removable comments found:

- Line 40 (inline): `// Validate inputs`
- Line 52 (inline): `// Validate Monte Carlo specific options`
- Line 61 (inline): `// Validate optional parameters`
- Line 75 (inline): `// Create backtest config`
- Line 93 (inline): `// Fetch historical data`
- Line 109 (inline): `// Run initial backtest`
- Line 130 (inline): `// Run Monte Carlo simulation`
- Line 154 (inline): `// Display results`
- Line 157 (inline): `// Save results`
- Line 238 (inline): `// Display original backtest results`
- Line 249 (inline): `// Display Monte Carlo statistics`
- Line 274 (inline): `// Display confidence intervals`
- Line 294 (inline): `// Display probabilities`
- Line 315 (inline): `// Display best/worst/median cases`
- Line 337 (inline): `// Interpretation`
- Line 350 (inline): `// Probability of profit`
- Line 360 (inline): `// Return consistency`
- Line 372 (inline): `// Drawdown risk`
- Line 382 (inline): `// Worst case analysis`
- Line 397 (inline): `// Final recommendation`

### apps/backend/src/cli/commands/optimize.ts

26 removable comments found:

- Line 90 (inline): `// Validate all inputs`
- Line 96 (inline): `// Validate that we have either preset or params`
- Line 101 (inline): `// Only validate param grid if params are provided`
- Line 127 (inline): `// Validate position sizing method`
- Line 133 (inline): `// Validate Kelly fraction`
- Line 138 (inline): `// Validate risk/reward ratio`
- Line 143 (inline): `// Validate optional parameters`
- Line 149 (inline): `// Parse parameter grid from --param flags`
- Line 152 (inline): `// Apply preset if specified`
- Line 162 (inline): `// Parse custom parameters (override preset values)`
- Line 169 (inline): `// Validate grid`
- Line 174 (inline): `// Display header`
- Line 188 (inline): `// Parse position management options`
- Line 192 (inline): `// Create base config`
- Line 214 (inline): `// Add minConfidence to base config if specified`
- Line 219 (inline): `// Fetch historical data once (reuse for all backtests)`
- Line 235 (inline): `// Create progress bar`
- Line 245 (inline): `// Run optimization`
- Line 271 (inline): `// Filter results if criteria specified`
- Line 293 (inline): `// Display top N results`
- Line 301 (inline): `// Display statistics`
- Line 313 (inline): `// Display interpretation`
- Line 319 (inline): `// Save results`
- Line 362 (inline): `// Display parameters`
- Line 369 (inline): `// Display key metrics`
- Line 379 (inline): `// Recommendation`

### apps/backend/src/cli/commands/sensitivity.ts

23 removable comments found:

- Line 49 (inline): `// Validate inputs`
- Line 62 (inline): `// Validate metric`
- Line 69 (inline): `// Parse parameter ranges from --param flags`
- Line 101 (inline): `// Display configuration`
- Line 118 (inline): `// Fetch historical data`
- Line 134 (inline): `// Create base config`
- Line 149 (inline): `// Create backtest runner`
- Line 155 (inline): `// Run sensitivity analysis`
- Line 180 (inline): `// Display results`
- Line 183 (inline): `// Save results`
- Line 222 (inline): `// Display parameter analyses`
- Line 230 (inline): `// Display overall assessment`
- Line 243 (inline): `// Best vs Worst`
- Line 263 (inline): `// Interpretation`
- Line 287 (inline): `// Check for over-optimization`
- Line 295 (inline): `// Find optimal plateau`
- Line 301 (inline): `// Show detailed results if verbose`
- Line 337 (inline): `// Analyze robustness score`
- Line 349 (inline): `// Analyze individual parameters`
- Line 368 (inline): `// Display insights`
- Line 377 (inline): `// Display warnings`
- Line 386 (inline): `// Display recommendations`
- Line 395 (inline): `// Final verdict`

### apps/backend/src/cli/commands/validate.ts

22 removable comments found:

- Line 43 (inline): `// Initialize logger`
- Line 47 (inline): `// Validate all inputs`
- Line 74 (inline): `// Validate position sizing method`
- Line 80 (inline): `// Validate Kelly fraction`
- Line 85 (inline): `// Validate risk/reward ratio`
- Line 90 (inline): `// Display header`
- Line 100 (inline): `// Parse position management options`
- Line 104 (inline): `// Parse configuration`
- Line 128 (inline): `// Create backtest engine`
- Line 131 (inline): `// Run backtest with spinner`
- Line 138 (inline): `// Run the backtest`
- Line 143 (inline): `// Display results`
- Line 150 (inline): `// Display summary`
- Line 162 (inline): `// Interpretation`
- Line 166 (inline): `// Save result`
- Line 211 (inline): `// Analyze win rate`
- Line 222 (inline): `// Analyze profit factor`
- Line 233 (inline): `// Analyze Sharpe ratio`
- Line 242 (inline): `// Analyze drawdown`
- Line 253 (inline): `// Analyze trade count`
- Line 260 (inline): `// Display interpretation`
- Line 280 (inline): `// Overall recommendation`

### apps/backend/src/cli/commands/walkforward.ts

28 removable comments found:

- Line 44 (inline): `// Validate all inputs`
- Line 58 (inline): `// Validate walk-forward config`
- Line 69 (inline): `// Validate optional parameters`
- Line 75 (inline): `// Parse parameter ranges from --param flags`
- Line 98 (inline): `// Display header`
- Line 113 (inline): `// Create base config`
- Line 127 (inline): `// Add minConfidence to base config if specified`
- Line 132 (inline): `// Create walk-forward config`
- Line 140 (inline): `// Fetch historical data`
- Line 156 (inline): `// Create windows`
- Line 172 (inline): `// Display window information`
- Line 188 (inline): `// Run walk-forward analysis`
- Line 195 (inline): `// Create progress bar`
- Line 205 (inline): `// Run optimization for each window`
- Line 233 (inline): `// Calculate aggregated metrics`
- Line 238 (inline): `// Display results`
- Line 241 (inline): `// Save results`
- Line 321 (inline): `// Display per-window results`
- Line 332 (inline): `// In-sample (training)`
- Line 339 (inline): `// Out-of-sample (testing)`
- Line 351 (inline): `// Display aggregated metrics`
- Line 368 (inline): `// Robustness assessment`
- Line 383 (inline): `// Interpretation and recommendation`
- Line 400 (inline): `// Degradation analysis`
- Line 409 (inline): `// Win rate analysis`
- Line 418 (inline): `// Profit factor analysis`
- Line 427 (inline): `// Trade count analysis`
- Line 439 (inline): `// Final recommendation`

### apps/backend/src/cli/utils/logger.ts

3 removable comments found:

- Line 235 (inline): `// Highlight best`
- Line 292 (inline): `// Helper methods`
- Line 305 (inline): `// Export a default instance`

### apps/backend/src/cli/utils/validators.ts

8 removable comments found:

- Line 54 (inline): `// Check format`
- Line 65 (inline): `// Parse dates`
- Line 70 (inline): `// Check if dates are valid`
- Line 79 (inline): `// Check range`
- Line 88 (inline): `// Check minimum period (at least 7 days for meaningful backtest)`
- Line 94 (inline): `// Warn if period is very long`
- Line 200 (inline): `// Skip validation if either is undefined (strategy will calculate)`
- Line 246 (inline): `// Validate all values are numeric`

### apps/backend/src/routers/backtest.ts

6 removable comments found:

- Line 12 (inline): `// In-memory storage for backtest results (could be moved to DB later)`
- Line 40 (inline): `// Set initial status`
- Line 51 (inline): `// Create backtest config`
- Line 71 (inline): `// Run backtest using BacktestEngine`
- Line 75 (inline): `// Store completed result`
- Line 100 (inline): `// Store failed result`

### apps/backend/src/routers/kline.ts

4 removable comments found:

- Line 77 (inline): `// If database is empty, fetch directly from Binance API`
- Line 91 (inline): `// Debug: Log first kline to verify data`
- Line 96 (inline): `// API already returns objects with correct keys, just add metadata`
- Line 166 (inline): `// Real-time streaming endpoints`

### apps/backend/src/services/backtesting/BacktestEngine.ts

74 removable comments found:

- Line 110 (inline): `// 1. Fetch historical klines (or use provided ones)`
- Line 111 (inline): `// IMPORTANT: We need extra historical data for EMA200 calculation`
- Line 112 (inline): `// Without this, EMA200 will be null for the first ~200 bars, causing`
- Line 113 (inline): `// the trend filter (onlyWithTrend) to be bypassed!`
- Line 124 (inline): `// Calculate warmup start date based on interval`
- Line 138 (inline): `// Count how many warmup bars we got`
- Line 154 (inline): `// 2. Setup detection configuration`
- Line 159 (inline): `// Legacy strategy IDs`
- Line 164 (inline): `// Import default configs from individual files`
- Line 169 (inline): `// Create setup config with defaults + relaxed settings for backtesting`
- Line 203 (inline): `// Load dynamic strategies if requested`
- Line 224 (inline): `// CRITICAL: Apply strategy's optimizedParams as defaults (fallback when CLI doesn't provide)`
- Line 225 (inline): `// PRIORITY: CLI parameters > Strategy optimizedParams > System defaults`
- Line 226 (inline): `// This allows CLI to override when needed, but uses optimized values when not specified`
- Line 232 (inline): `// When useOptimizedSettings is true, use strategy's optimized values`
- Line 233 (inline): `// When false (default), use safe defaults for fixed-fractional`
- Line 238 (inline): `// CRITICAL: When --optimized flag is set, use strategy's maxPositionSize`
- Line 239 (inline): `// Otherwise, use safe default (10%) for fixed-fractional to prevent over-leveraging`
- Line 254 (inline): `// For SL/TP: only use config values if explicitly provided AND setup doesn't calculate them`
- Line 255 (inline): `// Setup-calculated values (from ATR, etc.) always take priority in BacktestEngine execution`
- Line 262 (inline): `// 3. Detect setups`
- Line 265 (inline): `// Calculate warmup period based on indicators used in strategies`
- Line 294 (inline): `// Filter setups that are before the user's requested startDate`
- Line 295 (inline): `// (warmup data is only for indicator calculation, not for trading)`
- Line 303 (inline): `// Filter by minimum confidence if specified`
- Line 310 (inline): `// 4. Simulate trading`
- Line 330 (inline): `// Calculate EMA200 for trend detection (always calculate - used per-strategy)`
- Line 334 (inline): `// Sort setups by openTime`
- Line 339 (inline): `// Track open positions to manage multiple concurrent trades`
- Line 344 (inline): `// Debug counters`
- Line 354 (inline): `// Clean up closed positions`
- Line 359 (inline): `// Check if we've reached max concurrent positions`
- Line 375 (inline): `// Filter by trend if enabled FOR THIS SPECIFIC STRATEGY`
- Line 400 (inline): `// Calculate SL/TP first (needed for position sizing)`
- Line 401 (inline): `// CRITICAL PRIORITY LOGIC:`
- Line 402 (inline): `// 1. ALWAYS use setup's calculated values if available (strategy-specific ATR/indicator-based)`
- Line 403 (inline): `// 2. Only fall back to fixed config percentages if setup doesn't provide values`
- Line 404 (inline): `// 3. This ensures dynamic strategies (larry-williams, momentum-breakout) use their own calculations`
- Line 421 (inline): `// Log SL/TP source for first trade (debug - always show)`
- Line 430 (inline): `// Calculate position size using intelligent position sizing`
- Line 436 (inline): `// Original behavior: fixed % of equity`
- Line 440 (inline): `// Calculate real trade statistics for Kelly Criterion`
- Line 448 (inline): `// Use PositionSizer for intelligent sizing`
- Line 466 (inline): `// Log sizing decision in verbose mode`
- Line 472 (inline): `// Check total exposure limit`
- Line 481 (inline): `// Ensure position value meets minimum`
- Line 488 (inline): `// Filter by minimum expected profit after fees`
- Line 508 (inline): `// Find exit`
- Line 657 (inline): `// If no exit found, close at end of period`
- Line 665 (inline): `// Apply slippage for stop loss exits (market orders)`
- Line 666 (inline): `// Take profit is assumed to be limit order (no slippage)`
- Line 670 (inline): `// Slippage is unfavorable: LONG exits lower, SHORT exits higher`
- Line 676 (inline): `// Calculate PnL`
- Line 683 (inline): `// Calculate commission correctly: entry fee + exit fee (based on actual prices)`
- Line 691 (inline): `// Update equity`
- Line 694 (inline): `// Track drawdown`
- Line 705 (inline): `// Record trade`
- Line 729 (inline): `// Track this position for concurrent position management`
- Line 737 (inline): `// Update equity curve`
- Line 748 (inline): `// 5. Calculate metrics`
- Line 749 (inline): `// Use gross PnL (before fees) for win/loss classification`
- Line 750 (inline): `// This reflects actual trade quality - fees are a separate concern`
- Line 754 (inline): `// Net PnL (after fees) - for equity calculations`
- Line 758 (inline): `// Gross PnL (before fees) - for trade quality metrics`
- Line 766 (inline): `// Calculate trade durations`
- Line 802 (inline): `// Gross metrics (before fees) - reflects trade quality`
- Line 824 (inline): `// 6. Calculate Sharpe Ratio`
- Line 891 (inline): `// Check indicators defined in the strategy`
- Line 896 (inline): `// Extract period from various parameter names`
- Line 900 (inline): `// Handle parameter references (e.g., "$smaTrend")`
- Line 911 (inline): `// Check parameters for trend filters (like EMA 200)`
- Line 925 (inline): `// Check filters for trend periods`
- Line 933 (inline): `// If strategy uses onlyWithTrend, we need EMA200 to be valid`
- Line 939 (inline): `// Add extra buffer for indicator calculations (some need 2x the period)`

### apps/backend/src/services/backtesting/BacktestOptimizer.ts

10 removable comments found:

- Line 39 (inline): `// Validate parameter grid`
- Line 42 (inline): `// Generate all parameter combinations`
- Line 53 (inline): `// Parallel execution`
- Line 77 (inline): `// Filter out failed backtests`
- Line 81 (inline): `// Sequential execution`
- Line 100 (inline): `// Sort by the specified metric (descending for most metrics)`
- Line 168 (inline): `// Metrics where lower is better`
- Line 177 (inline): `// Handle null/undefined values`
- Line 182 (inline): `// For higher-is-better metrics: bValue - aValue (descending)`
- Line 183 (inline): `// For lower-is-better metrics: aValue - bValue (ascending)`

### apps/backend/src/services/backtesting/ParameterGenerator.ts

4 removable comments found:

- Line 39 (inline): `// Generate cartesian product`
- Line 42 (inline): `// Map back to objects with parameter names`
- Line 68 (inline): `// Round to avoid floating point precision issues`
- Line 159 (inline): `// Warn if too many combinations`

### apps/backend/src/services/backtesting/PositionSizer.ts

26 removable comments found:

- Line 14 (inline): `// Risk-Based parameters`
- Line 17 (inline): `// Kelly Criterion parameters`
- Line 23 (inline): `// Volatility-Based parameters`
- Line 27 (inline): `// Fixed Fractional`
- Line 30 (inline): `// Global constraints`
- Line 95 (inline): `// Apply constraints`
- Line 98 (inline): `// Calculate actual values`
- Line 102 (inline): `// Calculate risk amount`
- Line 130 (inline): `// Fallback to fixed % if no valid stop`
- Line 141 (inline): `// Position value needed to risk exactly riskPercent`
- Line 173 (inline): `// Kelly formula`
- Line 176 (inline): `// Apply Kelly fraction for safety (typically 0.25 to 0.5)`
- Line 179 (inline): `// Ensure positive and reasonable`
- Line 209 (inline): `// Inverse relationship: higher volatility = smaller position`
- Line 210 (inline): `// Target: If ATR is 2%, position = 50%`
- Line 211 (inline): `// If ATR is 4%, position = 25%`
- Line 212 (inline): `// If ATR is 1%, position = 100%`
- Line 233 (inline): `// Start with quarter-Kelly (conservative default)`
- Line 236 (inline): `// Adjust based on win rate confidence`
- Line 241 (inline): `// Adjust based on profit factor`
- Line 248 (inline): `// Adjust based on drawdown risk`
- Line 255 (inline): `// Constrain to reasonable range`
- Line 268 (inline): `// Need sufficient sample size for Kelly`
- Line 273 (inline): `// Kelly works best with consistent edge`
- Line 278 (inline): `// Risk-based is safest with defined stops`
- Line 283 (inline): `// Default to fixed fractional`

### apps/backend/src/services/backtesting/ResultManager.ts

12 removable comments found:

- Line 159 (inline): `// CSV header`
- Line 162 (inline): `// CSV rows`
- Line 181 (inline): `// Add summary row`
- Line 190 (inline): `// Calculate final equity`
- Line 201 (inline): `// CSV header`
- Line 204 (inline): `// Add parameter columns`
- Line 211 (inline): `// Add metric columns`
- Line 214 (inline): `// CSV rows`
- Line 229 (inline): `// Add statistics`
- Line 253 (inline): `// Ensure directory exists`
- Line 286 (inline): `// Ensure directory exists`
- Line 319 (inline): `// Ensure directory exists`

### apps/backend/src/services/backtesting/WalkForwardOptimizer.ts

2 removable comments found:

- Line 176 (inline): `// Override dates to use training window`
- Line 217 (inline): `// Override dates to use testing window`

### apps/backend/src/services/backtesting/__tests__/BacktestEngine.test.ts

30 removable comments found:

- Line 9 (inline): `// Mock the Binance API`
- Line 49 (inline): `// Check result structure`
- Line 68 (inline): `// Check metrics structure (core metrics)`
- Line 79 (inline): `// Check metric types`
- Line 84 (inline): `// Check metric ranges`
- Line 110 (inline): `// Profit factor = gross profit / gross loss`
- Line 114 (inline): `// All wins = infinite profit factor (should be capped)`
- Line 127 (inline): `// Need minimum trades for Sharpe`
- Line 156 (inline): `// Should complete without error`
- Line 161 (inline): `// Note: Trade generation depends on setup detection which may or may not`
- Line 162 (inline): `// find valid setups depending on the generated klines`
- Line 174 (inline): `// Final equity should be initial capital + total PnL`
- Line 177 (inline): `// Check equity curve final value`
- Line 194 (inline): `// Every trade should have commission applied`
- Line 199 (inline): `// Commission should be approximately 0.1% of position size (entry + exit)`
- Line 218 (inline): `// Should complete without error when max position size is specified`
- Line 221 (inline): `// Note: Actual position size validation would require knowledge of`
- Line 222 (inline): `// the BacktestEngine's internal position sizing logic`
- Line 251 (inline): `// Note: Trades are based on setups that pass minConfidence`
- Line 252 (inline): `// The config is applied during setup detection`
- Line 264 (inline): `// Should complete without error`
- Line 276 (inline): `// Should complete without error`
- Line 283 (inline): `// Engine requires minimum 50 klines`
- Line 293 (inline): `// Use ranging market with strict filters`
- Line 308 (inline): `// Downtrend with LONG-only strategy`
- Line 320 (inline): `// Profit factor should be low (more losses than wins)`
- Line 375 (inline): `// Equity curve should have at least as many points as trades`
- Line 398 (inline): `// First run`
- Line 403 (inline): `// Second run with same klines`
- Line 408 (inline): `// Both should be fast since klines are pre-fetched`

### apps/backend/src/services/binance-historical.ts

6 removable comments found:

- Line 124 (inline): `// Use Binance REST API directly to get full kline data including taker buy volumes`
- Line 139 (inline): `// Binance kline array format:`
- Line 140 (inline): `// [0] Open time, [1] Open, [2] High, [3] Low, [4] Close, [5] Volume,`
- Line 141 (inline): `// [6] Close time, [7] Quote asset volume, [8] Number of trades,`
- Line 142 (inline): `// [9] Taker buy base asset volume, [10] Taker buy quote asset volume, [11] Ignore`
- Line 160 (inline): `// logger.debug({ fetched: klinesData.length, total: allKlines.length }, 'Fetched klines batch');`

### apps/backend/src/services/binance-kline-stream.ts

13 removable comments found:

- Line 52 (inline): `// WebsocketClient types don't properly expose error event handler`
- Line 125 (inline): `// WebsocketClient doesn't have unsubscribeSpotKline method`
- Line 126 (inline): `// Use closeWsConnection or other method to unsubscribe`
- Line 152 (inline): `// Kline/Candlestick event`
- Line 185 (inline): `// Emit to connected WebSocket clients`
- Line 191 (inline): `// logger.debug({`
- Line 192 (inline): `//   symbol: update.symbol,`
- Line 193 (inline): `//   interval: update.interval,`
- Line 194 (inline): `//   close: update.close,`
- Line 195 (inline): `//   isClosed: update.isClosed,`
- Line 196 (inline): `// }, 'Kline update processed');`
- Line 212 (inline): `// Reset client count to 1 for each unique subscription`
- Line 214 (inline): `// Restore original client count`

### apps/backend/src/services/binance-price-stream.ts

1 removable comments found:

- Line 38 (inline): `// WebsocketClient types don't properly expose error event handler`

### apps/backend/src/services/setup-detection/BearTrapDetector.ts

1 removable comments found:

- Line 12 (inline): `// Re-export for consumers`

### apps/backend/src/services/setup-detection/MeanReversionDetector.ts

16 removable comments found:

- Line 8 (inline): `// Re-export for consumers`
- Line 39 (inline): `// Calculate Bollinger Bands`
- Line 51 (inline): `// Calculate RSI`
- Line 58 (inline): `// Check volume confirmation`
- Line 68 (inline): `// Check for LONG setup (oversold)`
- Line 73 (inline): `// Check for SHORT setup (overbought)`
- Line 91 (inline): `// Stop loss: Below lower band with 1.5x band width for breathing room`
- Line 95 (inline): `// Take profit: Middle band (mean)`
- Line 98 (inline): `// Calculate confidence`
- Line 101 (inline): `// Check minimum criteria`
- Line 141 (inline): `// Stop loss: Above upper band with 1.5x band width for breathing room`
- Line 145 (inline): `// Take profit: Middle band (mean)`
- Line 148 (inline): `// Calculate confidence`
- Line 151 (inline): `// Check minimum criteria`
- Line 198 (inline): `// Distance from band (more extreme = higher confidence)`
- Line 205 (inline): `// RSI extremes`

### apps/backend/src/services/setup-detection/Pattern123Detector.ts

1 removable comments found:

- Line 12 (inline): `// Re-export for consumers`

### apps/backend/src/services/setup-detection/SetupDetectionService.ts

12 removable comments found:

- Line 19 (inline): `// Legacy detector configs`
- Line 24 (inline): `// Global settings`
- Line 30 (inline): `// Dynamic strategy settings`
- Line 49 (inline): `// Dynamic strategy support`
- Line 75 (inline): `// Initialize legacy detectors`
- Line 82 (inline): `// Initialize dynamic strategies from config`
- Line 87 (inline): `// Initialize strategy loader if directory is specified`
- Line 221 (inline): `// Run legacy detectors if enabled`
- Line 291 (inline): `// Run dynamic strategy interpreters`
- Line 342 (inline): `// Legacy detectors`
- Line 361 (inline): `// Run legacy detectors`
- Line 368 (inline): `// Run dynamic interpreters`

### apps/backend/src/services/setup-detection/dynamic/ConditionEvaluator.ts

7 removable comments found:

- Line 77 (inline): `// Handle crossover/crossunder specially`
- Line 82 (inline): `// Resolve values at current index`
- Line 110 (inline): `// Get series for left and right`
- Line 137 (inline): `// Left crosses above right`
- Line 140 (inline): `// Left crosses below right`
- Line 174 (inline): `// Handle numeric strings (e.g., "30" should be treated as number 30)`
- Line 246 (inline): `// Handle numeric strings (e.g., "30" should be treated as number 30)`

### apps/backend/src/services/setup-detection/dynamic/ExitCalculator.ts

12 removable comments found:

- Line 53 (inline): `// For riskReward type, we need the stop loss distance`
- Line 66 (inline): `// For indicator type, get the target value directly`
- Line 72 (inline): `// Fall back to fallback or default`
- Line 111 (inline): `// Try fallback`
- Line 115 (inline): `// Default to 2% if no target found`
- Line 120 (inline): `// This is handled specially in calculateTakeProfit`
- Line 121 (inline): `// For stop loss or when SL is not provided, default to 2%`
- Line 190 (inline): `// Try to resolve as indicator reference`
- Line 210 (inline): `// Default confidence calculation`
- Line 216 (inline): `// Apply bonuses`
- Line 225 (inline): `// Apply max cap`
- Line 293 (inline): `// Bonus for volume confirmation`

### apps/backend/src/services/setup-detection/dynamic/IndicatorEngine.ts

10 removable comments found:

- Line 118 (inline): `// Add built-in price/volume series`
- Line 130 (inline): `// Compute volume SMA for confidence bonuses (calculate SMA of volume, not close)`
- Line 1009 (inline): `// Handle volume.sma20 and volume.current FIRST (before checking price references)`
- Line 1017 (inline): `// Handle price references (including raw volume when no subKey)`
- Line 1030 (inline): `// Check if values is an array (simple indicator) or object (compound indicator)`
- Line 1035 (inline): `// Compound indicator with sub-keys`
- Line 1041 (inline): `// If no sub-key provided, try to get a default value`
- Line 1042 (inline): `// For RSI-like indicators, return the main value`
- Line 1061 (inline): `// Handle price references`
- Line 1089 (inline): `// Apply offset if needed (shift series by offset positions)`

### apps/backend/src/services/setup-detection/dynamic/StrategyInterpreter.ts

18 removable comments found:

- Line 65 (inline): `// Compute all indicators`
- Line 72 (inline): `// Create evaluation context`
- Line 80 (inline): `// Check entry conditions`
- Line 87 (inline): `// Calculate entry, exit levels`
- Line 107 (inline): `// Calculate confidence`
- Line 113 (inline): `// Calculate risk-reward`
- Line 121 (inline): `// Check minimum requirements (skip riskReward check for indicator-based exit strategies)`
- Line 128 (inline): `// Check strategy filters`
- Line 133 (inline): `// Calculate indicator confluence`
- Line 139 (inline): `// Check volume confirmation`
- Line 145 (inline): `// Create the setup`
- Line 177 (inline): `// Check long conditions first`
- Line 185 (inline): `// Check short conditions`
- Line 228 (inline): `// Check each indicator for alignment`
- Line 232 (inline): `// Simple heuristic: indicator has a valid value`
- Line 239 (inline): `// Compound indicator - check any sub-value`
- Line 251 (inline): `// Normalize to 0-2 range (matching existing system)`
- Line 322 (inline): `// Clear indicator cache when parameters change`

### apps/backend/src/services/setup-detection/dynamic/StrategyLoader.ts

8 removable comments found:

- Line 116 (inline): `// Validate the strategy`
- Line 127 (inline): `// Store in cache`
- Line 178 (inline): `// Required fields`
- Line 187 (inline): `// ID format`
- Line 196 (inline): `// Version format`
- Line 205 (inline): `// Validate indicators`
- Line 214 (inline): `// Validate entry conditions`
- Line 219 (inline): `// Validate exit config`

### apps/backend/validate-strategies.ts

10 removable comments found:

- Line 50 (inline): `// Create results directory`
- Line 61 (inline): `// Get list of active strategies`
- Line 80 (inline): `// Validate each strategy`
- Line 95 (inline): `// Save full output`
- Line 98 (inline): `// Extract metrics`
- Line 136 (inline): `// Save JSON results`
- Line 142 (inline): `// Display summary table`
- Line 145 (inline): `// Generate markdown report`
- Line 170 (inline): `// Top performers table`
- Line 205 (inline): `// Summary stats`

### apps/electron/eslint.config.js

3 removable comments found:

- Line 48 (inline): `// TypeScript specific rules`
- Line 78 (inline): `// React specific rules`
- Line 90 (inline): `// General rules`

### apps/electron/src/renderer/App.tsx

35 removable comments found:

- Line 159 (inline): `// usePatternDetectionWorker();`
- Line 160 (inline): `// useAutoPatternDetection(viewport);`
- Line 161 (inline): `// const { detectPatterns } = useManualPatternDetection(addPatterns);`
- Line 162 (inline): `// useSimulatorLayout();`
- Line 163 (inline): `// usePriceUpdates();`
- Line 164 (inline): `// useOrderNotifications();`
- Line 240 (inline): `// const handleDetectPatterns = useCallback((): void => {`
- Line 241 (inline): `//   if (viewportRef.current) {`
- Line 242 (inline): `//     void detectPatterns(viewportRef.current);`
- Line 243 (inline): `//   }`
- Line 244 (inline): `// }, [detectPatterns]);`
- Line 531 (inline): `// const setResponseProcessor = useAIStore(state => state.setResponseProcessor);`
- Line 532 (inline): `// const enableAIPatterns = useAIStore(state => state.enableAIPatterns);`
- Line 544 (inline): `// useEffect(() => {`
- Line 545 (inline): `//   if (enableAIPatterns && processAIResponseRef.current) {`
- Line 546 (inline): `//     const stableProcessor = async (response: string) => {`
- Line 547 (inline): `//       if (processAIResponseRef.current) {`
- Line 548 (inline): `//         return processAIResponseRef.current(response);`
- Line 549 (inline): `//       }`
- Line 550 (inline): `//       return response;`
- Line 551 (inline): `//     };`
- Line 552 (inline): `//     setResponseProcessor(stableProcessor);`
- Line 553 (inline): `//   } else {`
- Line 554 (inline): `//     setResponseProcessor(null);`
- Line 555 (inline): `//   }`
- Line 556 (inline): `//   return () => setResponseProcessor(null);`
- Line 557 (inline): `// }, [enableAIPatterns]);`
- Line 599 (inline): `// const aiTrading = useAITrading({`
- Line 600 (inline): `//   symbol,`
- Line 601 (inline): `//   timeframe,`
- Line 602 (inline): `//   chartType,`
- Line 603 (inline): `//   klines: displayKlines,`
- Line 604 (inline): `//   getCurrentPrice,`
- Line 605 (inline): `// });`
- Line 607 (inline): `// const { startTrading, stopTrading } = aiTrading;`

### apps/electron/src/renderer/components/Chart/ChartCanvas.tsx

2 removable comments found:

- Line 128 (inline): `// Backend wallet for auto-trading`
- Line 1086 (inline): `// Check if auto-trading is enabled (simulator OR backend mode)`

### apps/electron/src/renderer/components/Chart/core/BacktestChart.tsx

1 removable comments found:

- Line 80 (inline): `// Trade visualization removed - not needed for backtest chart`

### apps/electron/src/renderer/components/Chart/core/FullChart.tsx

2 removable comments found:

- Line 108 (inline): `// Trade visualization for SL/TP lines`
- Line 134 (inline): `// Update hovered kline based on mouse position`

### apps/electron/src/renderer/components/Chart/utils/performanceBenchmark.ts

11 removable comments found:

- Line 31 (inline): `// Measure initial memory if available`
- Line 38 (inline): `// Execute all operations`
- Line 51 (inline): `// Calculate results`
- Line 148 (inline): `// Simulate single canvas full redraw`
- Line 154 (inline): `// Grid`
- Line 163 (inline): `// Klines`
- Line 169 (inline): `// Indicators`
- Line 177 (inline): `// Orders`
- Line 184 (inline): `// Crosshair`
- Line 193 (inline): `// Simulate multi-layer (only crosshair updates)`
- Line 199 (inline): `// Only redraw interaction layer`

### apps/electron/src/renderer/components/Trading/BacktestConfig.tsx

10 removable comments found:

- Line 16 (inline): `// Optimized settings from backtesting (Jan-Dec 2024)`
- Line 17 (inline): `// Pattern 123: PnL +642.91%, PF 5.91, Sharpe 2.84, Max DD 5.50%`
- Line 18 (inline): `// These are the EXACT parameters used during optimization`
- Line 38 (inline): `// Calculate last month's date range`
- Line 52 (inline): `// Use optimized settings by default`
- Line 61 (inline): `// These are overridden when useOptimizedSettings is true`
- Line 71 (inline): `// Get effective values (use optimized if enabled)`
- Line 79 (inline): `// Get enabled setups from setup config`
- Line 89 (inline): `// Build config with only the fields the backend actually uses`
- Line 108 (inline): `// Run backtest on backend (handles kline fetching internally)`

### apps/electron/src/renderer/components/Trading/BacktestingPanel.tsx

1 removable comments found:

- Line 29 (inline): `// Create default market service if not provided`

### apps/electron/src/renderer/components/Trading/OrderTicket.tsx

1 removable comments found:

- Line 67 (inline): `// Calculate default quantity as 10% of wallet balance divided by current price`

### apps/electron/src/renderer/components/Trading/index.ts

3 removable comments found:

- Line 1 (inline): `// Export all Trading components`
- Line 11 (inline): `// Auto-Trading & Analytics components`
- Line 16 (inline): `// Backtesting components`

### apps/electron/src/renderer/components/ui/progress.tsx

1 removable comments found:

- Line 12 (inline): `// Props vazias pois ProgressBar é apenas visual`

### apps/electron/src/renderer/hooks/useBackendKlines.ts

7 removable comments found:

- Line 48 (inline): `// Real-time streaming`
- Line 64 (inline): `// Hook for real-time kline streaming via WebSocket`
- Line 88 (inline): `// Keep callback ref updated`
- Line 110 (inline): `// Subscribe to backend stream service (tRPC endpoint)`
- Line 116 (inline): `// Subscribe to WebSocket room to receive updates`
- Line 119 (inline): `// Listen to WebSocket updates`
- Line 125 (inline): `// Unsubscribe from WebSocket room`

### apps/electron/src/renderer/hooks/useBacktesting.ts

12 removable comments found:

- Line 12 (inline): `// Track if we should fetch backtests (lazy loading)`
- Line 15 (inline): `// Query: List all backtest results - only fetch when explicitly requested`
- Line 21 (inline): `// Mutation: Run backtest`
- Line 28 (inline): `// Mutation: Delete backtest`
- Line 35 (inline): `// Function: Run a new backtest`
- Line 43 (inline): `// Function: Get a specific backtest result`
- Line 57 (inline): `// Function: Delete a backtest`
- Line 65 (inline): `// Function: Load backtest history (lazy loading to avoid fetching on modal open)`
- Line 71 (inline): `// Data`
- Line 74 (inline): `// Loading states`
- Line 79 (inline): `// Functions`
- Line 85 (inline): `// Errors`

### apps/electron/src/renderer/services/setupDetection/BearTrapDetector.ts

2 removable comments found:

- Line 8 (inline): `// Re-export for consumers`
- Line 12 (inline): `// Internal calculation constants`

### apps/electron/src/renderer/services/setupDetection/BreakoutRetestDetector.ts

2 removable comments found:

- Line 7 (inline): `// Local type definition (removed from @marketmind/types as strategy was not profitable)`
- Line 23 (inline): `// Internal calculation constants`

### apps/electron/src/renderer/services/setupDetection/BullTrapDetector.ts

2 removable comments found:

- Line 7 (inline): `// Local type definition (removed from @marketmind/types as strategy was not profitable)`
- Line 23 (inline): `// Internal calculation constants`

### apps/electron/src/renderer/services/setupDetection/Pattern123Detector.ts

2 removable comments found:

- Line 10 (inline): `// Re-export for consumers`
- Line 14 (inline): `// Internal constant`

### apps/electron/src/renderer/services/setupDetection/Setup91Detector.ts

2 removable comments found:

- Line 12 (inline): `// Local type definition (removed from @marketmind/types as strategy was not profitable)`
- Line 32 (inline): `// Internal calculation constants`

### apps/electron/src/renderer/services/setupDetection/Setup92Detector.ts

2 removable comments found:

- Line 12 (inline): `// Local type definition (removed from @marketmind/types as strategy was not profitable)`
- Line 32 (inline): `// Internal calculation constants`

### apps/electron/src/renderer/services/setupDetection/Setup93Detector.ts

2 removable comments found:

- Line 12 (inline): `// Local type definition (removed from @marketmind/types as strategy was not profitable)`
- Line 32 (inline): `// Internal calculation constants`

### apps/electron/src/renderer/services/setupDetection/Setup94Detector.ts

2 removable comments found:

- Line 12 (inline): `// Local type definition (removed from @marketmind/types as strategy was not profitable)`
- Line 32 (inline): `// Internal calculation constants`

### apps/electron/src/renderer/store/setupStore.ts

2 removable comments found:

- Line 229 (inline): `// Se tentando ativar mas nenhum setup está habilitado, não faz nada`
- Line 413 (inline): `// Use mergeSetupConfigs to apply new optimized defaults while preserving user's enabled states`

### apps/electron/src/tests/vitest.d.ts

2 removable comments found:

- Line 1 (inline): `/// <reference types="vitest" />`
- Line 2 (inline): `/// <reference types="@testing-library/jest-dom" />`

### apps/electron/src/vite-env.d.ts

1 removable comments found:

- Line 1 (inline): `/// <reference types="vite/client" />`

### packages/indicators/src/bollingerBands.test.ts

1 removable comments found:

- Line 45 (inline): `// Create klines with constant price (no volatility)`

### packages/indicators/src/bollingerBands.ts

3 removable comments found:

- Line 28 (inline): `// Calculate SMA (middle band)`
- Line 32 (inline): `// Calculate standard deviation`
- Line 37 (inline): `// Calculate bands`

### packages/indicators/src/rsi.test.ts

3 removable comments found:

- Line 28 (inline): `// After period, should have high RSI values (upward trend)`
- Line 39 (inline): `// Downward trend should have low RSI values`
- Line 79 (inline): `// Should have RSI values around 50 for mixed movements`

### packages/indicators/src/stochastic.test.ts

4 removable comments found:

- Line 34 (inline): `// First values should be null (not enough data)`
- Line 99 (inline): `// When close equals high, %K should be 100`
- Line 105 (inline): `// Create klines where close is at the lowest point of the range`
- Line 113 (inline): `// When close is consistently at low, %K should be 0`

### packages/types/src/backtesting.ts

8 removable comments found:

- Line 24 (inline): `// Position Sizing`
- Line 29 (inline): `// Strategy-specific parameters (for optimization)`
- Line 30 (inline): `// These override default detector config values (e.g., pivotLookback, volumeMultiplier, emaPeriod)`
- Line 33 (inline): `// Risk Management (Kelly Criterion)`
- Line 37 (inline): `// Trailing Stop`
- Line 44 (inline): `// Partial Exits`
- Line 49 (inline): `// Position Management`
- Line 86 (inline): `// Gross metrics (before fees) - reflects trade quality`

### packages/types/src/setupConfig.ts

21 removable comments found:

- Line 15 (inline): `// =============================================================================`
- Line 16 (inline): `// Base Configuration Interface`
- Line 17 (inline): `// =============================================================================`
- Line 25 (inline): `// =============================================================================`
- Line 26 (inline): `// Pattern 123 - Reversal Pattern (Best performer from backtesting)`
- Line 27 (inline): `// PnL: +7.06%, Profit Factor: 1.63, Sharpe: 5.00, Max DD: 2.83%`
- Line 28 (inline): `// =============================================================================`
- Line 53 (inline): `// =============================================================================`
- Line 54 (inline): `// Bear Trap - Counter-trend reversal (LONG)`
- Line 55 (inline): `// PnL: +3.53%, Profit Factor: 1.22, Sharpe: 2.61, Max DD: 3.17%`
- Line 56 (inline): `// =============================================================================`
- Line 84 (inline): `// =============================================================================`
- Line 85 (inline): `// Mean Reversion - Bollinger Bands + RSI`
- Line 86 (inline): `// PnL: +1.34%, Profit Factor: 1.39, Sharpe: 2.03, Max DD: 1.40%`
- Line 87 (inline): `// =============================================================================`
- Line 121 (inline): `// =============================================================================`
- Line 122 (inline): `// Aggregated Setup Detection Configuration`
- Line 123 (inline): `// =============================================================================`
- Line 137 (inline): `// =============================================================================`
- Line 138 (inline): `// Strategy Keys (for iteration and validation)`
- Line 139 (inline): `// =============================================================================`

### packages/types/src/strategyDefinition.ts

42 removable comments found:

- Line 10 (inline): `// =============================================================================`
- Line 11 (inline): `// Indicator Types`
- Line 12 (inline): `// =============================================================================`
- Line 102 (inline): `// =============================================================================`
- Line 103 (inline): `// Parameter Types`
- Line 104 (inline): `// =============================================================================`
- Line 117 (inline): `// =============================================================================`
- Line 118 (inline): `// Condition Types`
- Line 119 (inline): `// =============================================================================`
- Line 173 (inline): `// =============================================================================`
- Line 174 (inline): `// Exit Level Types`
- Line 175 (inline): `// =============================================================================`
- Line 219 (inline): `// =============================================================================`
- Line 220 (inline): `// Confidence Calculation Types`
- Line 221 (inline): `// =============================================================================`
- Line 241 (inline): `// =============================================================================`
- Line 242 (inline): `// Filter Types`
- Line 243 (inline): `// =============================================================================`
- Line 274 (inline): `// =============================================================================`
- Line 275 (inline): `// Strategy Status Types`
- Line 276 (inline): `// =============================================================================`
- Line 315 (inline): `// =============================================================================`
- Line 316 (inline): `// Optimized Backtest Parameters`
- Line 317 (inline): `// =============================================================================`
- Line 338 (inline): `// =============================================================================`
- Line 339 (inline): `// Main Strategy Definition`
- Line 340 (inline): `// =============================================================================`
- Line 372 (inline): `// Metadata`
- Line 380 (inline): `// Status (for filtering unprofitable strategies)`
- Line 385 (inline): `// Optimized backtest parameters (used when "Use Optimized Settings" is enabled)`
- Line 388 (inline): `// Configuration`
- Line 392 (inline): `// Trading logic`
- Line 396 (inline): `// Quality gates`
- Line 401 (inline): `// =============================================================================`
- Line 402 (inline): `// Runtime Types`
- Line 403 (inline): `// =============================================================================`
- Line 445 (inline): `// =============================================================================`
- Line 446 (inline): `// Validation Types`
- Line 447 (inline): `// =============================================================================`
- Line 467 (inline): `// =============================================================================`
- Line 468 (inline): `// Type Guards`
- Line 469 (inline): `// =============================================================================`

