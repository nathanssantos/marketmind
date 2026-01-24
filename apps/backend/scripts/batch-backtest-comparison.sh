#!/bin/bash

# Batch Backtest Comparison Script
# Runs multiple backtest configurations and generates a comparison report

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

OUTPUT_DIR="/tmp/backtest-comparison-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$OUTPUT_DIR"

echo "=========================================="
echo "Batch Backtest Comparison"
echo "Output directory: $OUTPUT_DIR"
echo "=========================================="

# Define test configurations
# Format: "name|rr-long|rr-short|fib-long|fib-short|entry-limit"
CONFIGS=(
  # Baseline (current defaults)
  "baseline|1.0|0.8|2|1.272|78.6"

  # Entry Limit variations
  "entry-38|1.0|0.8|2|1.272|38.2"
  "entry-50|1.0|0.8|2|1.272|50"
  "entry-62|1.0|0.8|2|1.272|61.8"

  # R:R variations
  "rr-strict|1.5|1.2|2|1.272|78.6"
  "rr-permissive|0.5|0.5|2|1.272|78.6"
  "rr-short-low|1.0|0.5|2|1.272|78.6"

  # Fibonacci target variations
  "fib-conservative|1.0|0.8|1.618|1|78.6"
  "fib-aggressive|1.0|0.8|2.618|1.618|78.6"

  # Combined optimizations
  "scalper|0.5|0.5|1.618|1|50"
  "swing|1.5|1.0|2.618|1.618|38.2"
  "balanced|0.8|0.6|1.618|1.272|61.8"
)

# Summary file
SUMMARY_FILE="$OUTPUT_DIR/comparison_summary.txt"

echo "Configuration,Trades,WinRate,PnL%,ProfitFactor,MaxDD%,Sharpe,BestTF" > "$OUTPUT_DIR/results.csv"

run_backtest() {
  local name=$1
  local rr_long=$2
  local rr_short=$3
  local fib_long=$4
  local fib_short=$5
  local entry_limit=$6

  local log_file="$OUTPUT_DIR/${name}.log"

  echo ""
  echo "----------------------------------------"
  echo "Running: $name"
  echo "  R:R LONG=$rr_long, SHORT=$rr_short"
  echo "  Fib LONG=$fib_long, SHORT=$fib_short"
  echo "  Entry Limit=$entry_limit%"
  echo "----------------------------------------"

  npx tsx scripts/run-multi-timeframe-backtest.ts \
    --rr-long "$rr_long" \
    --rr-short "$rr_short" \
    --fib-long "$fib_long" \
    --fib-short "$fib_short" \
    --entry-limit "$entry_limit" \
    2>&1 | tee "$log_file"

  # Extract summary from log (last lines with results)
  echo "" >> "$SUMMARY_FILE"
  echo "=== $name ===" >> "$SUMMARY_FILE"
  echo "R:R LONG=$rr_long, SHORT=$rr_short | Fib LONG=$fib_long, SHORT=$fib_short | Entry=$entry_limit%" >> "$SUMMARY_FILE"
  tail -50 "$log_file" | grep -E "(Interval|Best PnL|Average PnL|Profitable)" >> "$SUMMARY_FILE"
}

echo "Starting batch backtest at $(date)"
echo "" > "$SUMMARY_FILE"
echo "BATCH BACKTEST COMPARISON REPORT" >> "$SUMMARY_FILE"
echo "Generated: $(date)" >> "$SUMMARY_FILE"
echo "Symbol: BTCUSDT | Market: FUTURES | Period: 3 years" >> "$SUMMARY_FILE"

for config in "${CONFIGS[@]}"; do
  IFS='|' read -r name rr_long rr_short fib_long fib_short entry_limit <<< "$config"
  run_backtest "$name" "$rr_long" "$rr_short" "$fib_long" "$fib_short" "$entry_limit"
done

echo ""
echo "=========================================="
echo "Batch completed at $(date)"
echo "Results saved to: $OUTPUT_DIR"
echo "Summary: $SUMMARY_FILE"
echo "=========================================="

# Print summary
echo ""
echo "FINAL SUMMARY:"
echo "=========================================="
cat "$SUMMARY_FILE"
