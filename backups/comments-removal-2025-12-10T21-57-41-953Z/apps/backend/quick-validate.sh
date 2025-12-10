#!/bin/bash

# MarketMind - Quick Strategy Validation
# Tests all active strategies and shows results

set -e

# Setup results directory
RESULTS_DIR="results/bulk-validation-$(date +%Y-%m-%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

echo "=========================================="
echo "QUICK STRATEGY VALIDATION"
echo "=========================================="
echo "Results directory: $RESULTS_DIR"
echo ""

# Get list of active strategies
STRATEGIES=$(grep -l '"status": "active"' strategies/builtin/*.json | xargs -n1 basename | sed 's/.json$//')
TOTAL=$(echo "$STRATEGIES" | wc -l | tr -d ' ')

echo "Found $TOTAL active strategies"
echo ""
printf "%-35s | %7s | %10s | %10s | %8s\n" "Strategy" "Trades" "Win Rate" "PnL %" "PF"
printf "%.0s-" {1..80}
echo ""

COUNTER=0
SUCCESS_COUNT=0
FAILED_COUNT=0

# Create results array for JSON
echo "[" > "$RESULTS_DIR/all-results.json"

for strategy in $STRATEGIES; do
  COUNTER=$((COUNTER + 1))
  
  OUTPUT_FILE="$RESULTS_DIR/${strategy}.txt"
  
  # Run backtest and capture full output
  OUTPUT=$(pnpm exec tsx src/cli/backtest-runner.ts validate \
    -s "$strategy" \
    --symbol BTCUSDT \
    -i 1d \
    --start 2024-01-01 \
    --end 2024-12-01 \
    --optimized \
    2>&1 | tee "$OUTPUT_FILE")
  
  # Extract metrics from output
  if echo "$OUTPUT" | grep -q "BACKTEST RESULTS"; then
    TRADES=$(echo "$OUTPUT" | grep "│ Total Trades" | awk '{print $4}' || echo "0")
    WIN_RATE=$(echo "$OUTPUT" | grep "│ Win Rate" | awk '{print $4}' | sed 's/[+%]//g' || echo "0")
    PNL=$(echo "$OUTPUT" | grep "│ Total PnL %" | awk '{print $5}' | sed 's/[+%]//g' || echo "0")
    PF=$(echo "$OUTPUT" | grep "│ Profit Factor" | awk '{print $4}' || echo "0")
    MAX_DD=$(echo "$OUTPUT" | grep "│ Max Drawdown %" | awk '{print $5}' | sed 's/[-+%]//g' || echo "0")
    SHARPE=$(echo "$OUTPUT" | grep "│ Sharpe Ratio" | awk '{print $4}' || echo "0")
    
    printf "%-35s | %7s | %10s | %10s | %8s\n" "$strategy" "$TRADES" "$WIN_RATE%" "$PNL%" "$PF"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    
    # Add to JSON (with comma if not first)
    [ $SUCCESS_COUNT -gt 1 ] && echo "," >> "$RESULTS_DIR/all-results.json"
    cat >> "$RESULTS_DIR/all-results.json" << EOF
  {
    "strategy": "$strategy",
    "totalTrades": $TRADES,
    "winRate": $WIN_RATE,
    "totalPnlPercent": $PNL,
    "profitFactor": $PF,
    "maxDrawdownPercent": $MAX_DD,
    "sharpeRatio": $SHARPE,
    "status": "success"
  }
EOF
  else
    printf "%-35s | %7s | %10s | %10s | %8s\n" "$strategy" "FAILED" "-" "-" "-"
    FAILED_COUNT=$((FAILED_COUNT + 1))
    
    # Add failed entry to JSON
    [ $((SUCCESS_COUNT + FAILED_COUNT)) -gt 1 ] && echo "," >> "$RESULTS_DIR/all-results.json"
    cat >> "$RESULTS_DIR/all-results.json" << EOF
  {
    "strategy": "$strategy",
    "status": "failed"
  }
EOF
  fi
done

echo "]" >> "$RESULTS_DIR/all-results.json"

echo ""
printf "%.0s-" {1..80}
echo ""
echo "Summary: $SUCCESS_COUNT success, $FAILED_COUNT failed (Total: $TOTAL)"
echo ""

# Generate summary report
SUMMARY_FILE="$RESULTS_DIR/SUMMARY.md"
cat > "$SUMMARY_FILE" << EOF
# Strategy Validation Summary

**Generated:** $(date)
**Total Strategies:** $TOTAL
**Success:** $SUCCESS_COUNT
**Failed:** $FAILED_COUNT

## Top Performers (by PnL %)

| Rank | Strategy | Trades | Win Rate | PnL % | Profit Factor | Max DD % |
|------|----------|--------|----------|-------|---------------|----------|
EOF

# Sort by PnL and show top 15
grep -E '"strategy"|"totalTrades"|"winRate"|"totalPnlPercent"|"profitFactor"|"maxDrawdownPercent"' "$RESULTS_DIR/all-results.json" | \
  paste -d' ' - - - - - - | \
  grep -v '"status"' | \
  sed 's/.*"strategy": "\(.*\)".*"totalTrades": \(.*\),.*"winRate": \(.*\),.*"totalPnlPercent": \(.*\),.*"profitFactor": \(.*\),.*"maxDrawdownPercent": \(.*\),.*/\4|\1|\2|\3|\5|\6/' | \
  sort -t'|' -k1 -rn | \
  head -15 | \
  nl -w1 -s'|' | \
  awk -F'|' '{printf "| %s | %s | %s | %s%% | %s%% | %s | %s%% |\n", $1, $2, $3, $4, $5, $6, $7}' >> "$SUMMARY_FILE"

cat >> "$SUMMARY_FILE" << EOF

## Statistics

- **Best PnL:** $(grep '"totalPnlPercent"' "$RESULTS_DIR/all-results.json" | grep -o '[0-9.-]*' | sort -rn | head -1)%
- **Average Win Rate:** $(grep '"winRate"' "$RESULTS_DIR/all-results.json" | grep -o '[0-9.-]*' | awk '{sum+=$1; count++} END {if(count>0) printf "%.2f", sum/count; else print "0"}')%
- **Strategies with >10 trades:** $(grep '"totalTrades"' "$RESULTS_DIR/all-results.json" | grep -o '[0-9]*' | awk '$1 > 10 {count++} END {print count+0}')

## Failed Strategies

EOF

grep -B1 '"status": "failed"' "$RESULTS_DIR/all-results.json" | grep '"strategy"' | sed 's/.*"strategy": "\(.*\)".*/- \1/' >> "$SUMMARY_FILE"

echo ""
echo "✅ Results saved to:"
echo "   - Individual outputs: $RESULTS_DIR/*.txt"
echo "   - JSON data: $RESULTS_DIR/all-results.json"
echo "   - Summary report: $SUMMARY_FILE"
echo ""
echo "View summary:"
echo "   cat $SUMMARY_FILE"
echo ""
