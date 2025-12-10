#!/bin/bash

# MarketMind - Bulk Strategy Validation
# Validates all active strategies and saves results

set -e

RESULTS_DIR="results/bulk-validation-$(date +%Y-%m-%d)"
mkdir -p "$RESULTS_DIR"

echo "=========================================="
echo "BULK STRATEGY VALIDATION"
echo "=========================================="
echo "Results directory: $RESULTS_DIR"
echo ""

# Get list of all active strategies
STRATEGIES=$(grep -l '"status": "active"' strategies/builtin/*.json | xargs -n1 basename | sed 's/.json$//')
TOTAL=$(echo "$STRATEGIES" | wc -l | tr -d ' ')

echo "Found $TOTAL active strategies"
echo ""

COUNTER=0
SUCCESS_COUNT=0
FAILED_COUNT=0

for strategy in $STRATEGIES; do
  COUNTER=$((COUNTER + 1))
  echo "[$COUNTER/$TOTAL] Testing: $strategy"
  
  OUTPUT_FILE="$RESULTS_DIR/${strategy}_BTCUSDT_1d_2024.json"
  
  # Run backtest and redirect stderr to avoid warnings
  pnpm exec tsx src/cli/backtest-runner.ts validate \
    -s "$strategy" \
    --symbol BTCUSDT \
    -i 1d \
    --start 2024-01-01 \
    --end 2024-12-01 \
    --optimized \
    --output "$OUTPUT_FILE" \
    > /dev/null 2>&1
  
  # Check if output file was created successfully
  if [ -f "$OUTPUT_FILE" ] && grep -q '"totalTrades"' "$OUTPUT_FILE" 2>/dev/null; then
    echo "  ✓ SUCCESS"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    
    # Extract key metrics
    TRADES=$(grep -o '"totalTrades":[^,]*' "$OUTPUT_FILE" 2>/dev/null | head -1 | cut -d':' -f2 || echo "0")
    PNL=$(grep -o '"totalPnlPercent":[^,}]*' "$OUTPUT_FILE" 2>/dev/null | head -1 | cut -d':' -f2 || echo "0")
    WIN_RATE=$(grep -o '"winRate":[^,}]*' "$OUTPUT_FILE" 2>/dev/null | head -1 | cut -d':' -f2 || echo "0")
    
    echo "    Trades: $TRADES | PnL: $PNL% | Win Rate: $WIN_RATE%"
  else
    echo "  ✗ FAILED"
    FAILED_COUNT=$((FAILED_COUNT + 1))
  fi
  
  echo ""
done

echo "=========================================="
echo "VALIDATION COMPLETE"
echo "=========================================="
echo "Total: $TOTAL"
echo "Success: $SUCCESS_COUNT"
echo "Failed: $FAILED_COUNT"
echo ""
echo "Results saved to: $RESULTS_DIR"
echo ""

# Generate summary report
SUMMARY_FILE="$RESULTS_DIR/summary.txt"
echo "STRATEGY VALIDATION SUMMARY" > "$SUMMARY_FILE"
echo "Generated: $(date)" >> "$SUMMARY_FILE"
echo "=========================================" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

echo "Top 10 Strategies by PnL:" >> "$SUMMARY_FILE"
echo "Rank | Strategy | Trades | PnL % | Win Rate %" >> "$SUMMARY_FILE"
echo "-----+----------+--------+-------+-----------" >> "$SUMMARY_FILE"

# Sort by PnL and show top 10
find "$RESULTS_DIR" -name "*.json" -type f | while read file; do
  strategy=$(basename "$file" | cut -d'_' -f1)
  trades=$(grep -o '"totalTrades":[^,]*' "$file" 2>/dev/null | head -1 | cut -d':' -f2 || echo "0")
  pnl=$(grep -o '"totalPnlPercent":[^,}]*' "$file" 2>/dev/null | head -1 | cut -d':' -f2 || echo "0")
  winrate=$(grep -o '"winRate":[^,}]*' "$file" 2>/dev/null | head -1 | cut -d':' -f2 || echo "0")
  
  echo "$pnl|$strategy|$trades|$winrate"
done | sort -t'|' -k1 -rn | head -10 | nl -w1 -s'    ' | awk -F'|' '{printf "%4s | %-30s | %6s | %8s%% | %8s%%\n", $1, $2, $3, $4, $5}' >> "$SUMMARY_FILE"

echo "" >> "$SUMMARY_FILE"
echo "Summary saved to: $SUMMARY_FILE"
cat "$SUMMARY_FILE"
