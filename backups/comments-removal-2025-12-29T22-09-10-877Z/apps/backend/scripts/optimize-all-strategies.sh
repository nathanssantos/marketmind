#!/bin/bash

STRATEGIES=(
  "keltner-breakout-optimized"
  "bollinger-breakout-crypto"
  "larry-williams-9-1"
  "larry-williams-9-2"
  "larry-williams-9-3"
  "larry-williams-9-4"
  "williams-momentum"
  "tema-momentum"
  "elder-ray-crypto"
  "ppo-momentum"
  "parabolic-sar-crypto"
  "supertrend-follow"
  "percent-b-connors"
  "triple-confirmation-reversal"
  "momentum-rotation"
  "momentum-breakout-2025"
)

TIMEFRAMES=("1d" "4h" "1h")
SYMBOL="BTCUSDT"

RESULTS_DIR="results/multi-tf-optimization-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

echo "=== Multi-Timeframe Strategy Optimization ===" | tee "$RESULTS_DIR/summary.log"
echo "Symbol: $SYMBOL" | tee -a "$RESULTS_DIR/summary.log"
echo "Timeframes: ${TIMEFRAMES[*]}" | tee -a "$RESULTS_DIR/summary.log"
echo "Strategies: ${#STRATEGIES[@]}" | tee -a "$RESULTS_DIR/summary.log"
echo "" | tee -a "$RESULTS_DIR/summary.log"

for strategy in "${STRATEGIES[@]}"; do
  for tf in "${TIMEFRAMES[@]}"; do
    echo "=== Optimizing $strategy on $tf ===" | tee -a "$RESULTS_DIR/summary.log"
    
    timeout 120 pnpm exec tsx src/cli/backtest-runner.ts optimize \
      -s "$strategy" \
      --symbol "$SYMBOL" \
      -i "$tf" \
      --start 2024-01-01 \
      --end 2024-12-01 \
      --preset aggressive \
      --parallel 4 \
      --top 3 \
      --capital 10000 \
      --use-algorithmic-levels 2>&1 | grep -E "(BEST|Win Rate|Profit Factor|Total PnL|Sharpe|Trades:|Results saved)" | tee -a "$RESULTS_DIR/summary.log"
    
    echo "" | tee -a "$RESULTS_DIR/summary.log"
  done
done

echo "=== Optimization Complete ===" | tee -a "$RESULTS_DIR/summary.log"
