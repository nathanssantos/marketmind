#!/bin/bash

# Fibonacci Target Level Comparison Backtests
# Runs 4 backtests with different TP calculation modes:
# 1. Default (ATR-based)
# 2. Fibonacci 127.2%
# 3. Fibonacci 161.8%
# 4. Fibonacci 200%

set -e

cd "$(dirname "$0")/.."

RESULTS_DIR="backtest-results/fib-comparison-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

START_DATE="${START_DATE:-2024-01-11}"
END_DATE="${END_DATE:-2025-01-11}"

echo "=========================================="
echo "FIBONACCI TARGET LEVEL COMPARISON"
echo "=========================================="
echo "Period: $START_DATE to $END_DATE"
echo "Results: $RESULTS_DIR"
echo "=========================================="
echo ""

run_backtest() {
  local name=$1
  local tp_mode=$2
  local fib_target=$3
  local log_file="$RESULTS_DIR/${name}.log"

  echo "[$name] Starting backtest..."

  if [ -n "$fib_target" ]; then
    pnpm exec tsx src/cli/multi-watcher-backtest.ts \
      --tp-mode="$tp_mode" \
      --fib-target="$fib_target" \
      --start="$START_DATE" \
      --end="$END_DATE" \
      > "$log_file" 2>&1
  else
    pnpm exec tsx src/cli/multi-watcher-backtest.ts \
      --tp-mode="$tp_mode" \
      --start="$START_DATE" \
      --end="$END_DATE" \
      > "$log_file" 2>&1
  fi

  echo "[$name] Completed. Results saved to $log_file"

  grep -E "(Final Equity|Total P&L|Max Drawdown|Win Rate|Profit Factor|Total Trades)" "$log_file" || true
  echo ""
}

echo "Running 4 backtests sequentially..."
echo ""

echo "1/4 - Default (ATR-based) TP"
run_backtest "01-default" "default" ""

echo "2/4 - Fibonacci 127.2%"
run_backtest "02-fib-127" "fibonacci" "1.272"

echo "3/4 - Fibonacci 161.8%"
run_backtest "03-fib-161" "fibonacci" "1.618"

echo "4/4 - Fibonacci 200%"
run_backtest "04-fib-200" "fibonacci" "2"

echo ""
echo "=========================================="
echo "ALL BACKTESTS COMPLETED"
echo "=========================================="
echo "Results directory: $RESULTS_DIR"
echo ""
echo "Summary:"
echo "--------"

for log in "$RESULTS_DIR"/*.log; do
  name=$(basename "$log" .log)
  echo ""
  echo "=== $name ==="
  grep -E "(Final Equity|Total P&L|Max Drawdown|Win Rate|Profit Factor|Total Trades)" "$log" || echo "No metrics found"
done

echo ""
echo "=========================================="
