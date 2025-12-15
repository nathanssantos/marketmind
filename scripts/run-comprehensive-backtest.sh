#!/bin/bash

# Comprehensive Backtest Runner
# Runs backtests for multiple symbols, intervals, and strategies

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SYMBOLS=("SOLUSDT" "BTCUSDT" "ETHUSDT")
INTERVALS=("1m" "5m" "15m" "30m" "1h" "4h" "1d" "1w")
START_DATE="2024-01-01"
END_DATE="2024-12-31"
CAPITAL="10000"

# All strategies from toggle popover (ML-trained strategies)
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
)

# Results directory
RESULTS_DIR="results/comprehensive-backtest-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

# Log file
LOG_FILE="$RESULTS_DIR/backtest.log"

# Create failed.csv with header
echo "Symbol,Interval,Strategy,Status" > "$RESULTS_DIR/failed.csv"

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     COMPREHENSIVE BACKTEST RUNNER                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo -e "  Symbols:    ${GREEN}${SYMBOLS[*]}${NC}"
echo -e "  Intervals:  ${GREEN}${INTERVALS[*]}${NC}"
echo -e "  Strategies: ${GREEN}${#STRATEGIES[@]} strategies${NC}"
echo -e "  Period:     ${GREEN}${START_DATE} to ${END_DATE}${NC}"
echo -e "  Capital:    ${GREEN}\$${CAPITAL}${NC}"
echo -e "  Results:    ${GREEN}${RESULTS_DIR}${NC}"
echo ""

# Calculate total runs
TOTAL_RUNS=$((${#SYMBOLS[@]} * ${#INTERVALS[@]} * ${#STRATEGIES[@]}))
CURRENT_RUN=0
SUCCESSFUL_RUNS=0
FAILED_RUNS=0

echo -e "${YELLOW}Total combinations to test: ${GREEN}${TOTAL_RUNS}${NC}"
echo ""

# Start time
START_TIME=$(date +%s)

# Run backtests
for SYMBOL in "${SYMBOLS[@]}"; do
  for INTERVAL in "${INTERVALS[@]}"; do
    for STRATEGY in "${STRATEGIES[@]}"; do
      CURRENT_RUN=$((CURRENT_RUN + 1))
      
      echo -e "${BLUE}[${CURRENT_RUN}/${TOTAL_RUNS}]${NC} Testing ${GREEN}${STRATEGY}${NC} on ${YELLOW}${SYMBOL}${NC} ${YELLOW}${INTERVAL}${NC}"
      
      # Output file (use absolute path)
      OUTPUT_FILE="$(pwd)/$RESULTS_DIR/${SYMBOL}_${INTERVAL}_${STRATEGY}.json"
      
      # Run backtest (same conditions as auto trade)
      if cd apps/backend && npx tsx src/cli/backtest-runner.ts validate \
        --strategy "$STRATEGY" \
        --symbol "$SYMBOL" \
        --interval "$INTERVAL" \
        --start "$START_DATE" \
        --end "$END_DATE" \
        --capital "$CAPITAL" \
        --optimized \
        --use-algorithmic-levels \
        --trailing-stop \
        --use-ml-filter \
        --commission 0.1 \
        --max-concurrent 5 \
        --max-exposure 75 \
        > "$OUTPUT_FILE" 2>&1; then
        
        SUCCESSFUL_RUNS=$((SUCCESSFUL_RUNS + 1))
        echo -e "${GREEN}✓${NC} Success"
        
        # Extract key metrics (if available)
        if command -v jq &> /dev/null; then
          WIN_RATE=$(jq -r '.metrics.winRate // "N/A"' "$OUTPUT_FILE" 2>/dev/null || echo "N/A")
          PROFIT_FACTOR=$(jq -r '.metrics.profitFactor // "N/A"' "$OUTPUT_FILE" 2>/dev/null || echo "N/A")
          TOTAL_PNL=$(jq -r '.metrics.totalPnlPercent // "N/A"' "$OUTPUT_FILE" 2>/dev/null || echo "N/A")
          
          if [ "$WIN_RATE" != "N/A" ]; then
            echo -e "  Win Rate: ${YELLOW}${WIN_RATE}%${NC} | PF: ${YELLOW}${PROFIT_FACTOR}${NC} | P&L: ${YELLOW}${TOTAL_PNL}%${NC}"
          fi
        fi
      else
        FAILED_RUNS=$((FAILED_RUNS + 1))
        echo -e "${RED}✗${NC} Failed"
        echo "$SYMBOL,$INTERVAL,$STRATEGY,FAILED" >> "$(pwd)/$RESULTS_DIR/failed.csv"
      fi
      
      echo ""
      
      # Progress
      PROGRESS=$((CURRENT_RUN * 100 / TOTAL_RUNS))
      echo -e "${BLUE}Progress: ${PROGRESS}% (${SUCCESSFUL_RUNS} success, ${FAILED_RUNS} failed)${NC}"
      echo "─────────────────────────────────────────────────────"
      echo ""
      
      cd ../..
    done
  done
done

# End time
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
DURATION_MIN=$((DURATION / 60))
DURATION_SEC=$((DURATION % 60))

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              BACKTEST SUMMARY                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓ Successful:${NC} $SUCCESSFUL_RUNS"
echo -e "${RED}✗ Failed:${NC}     $FAILED_RUNS"
echo -e "${YELLOW}⏱ Duration:${NC}   ${DURATION_MIN}m ${DURATION_SEC}s"
echo -e "${BLUE}📁 Results:${NC}   $RESULTS_DIR"
echo ""

# Generate summary CSV
echo "Generating summary CSV..."
SUMMARY_FILE="$RESULTS_DIR/summary.csv"
echo "Symbol,Interval,Strategy,Win Rate,Profit Factor,Total PnL %,Total Trades,Max Drawdown %" > "$SUMMARY_FILE"

if command -v jq &> /dev/null; then
  for FILE in "$RESULTS_DIR"/*.json; do
    if [ -f "$FILE" ] && [ "$(basename "$FILE")" != "summary.json" ]; then
      FILENAME=$(basename "$FILE" .json)
      IFS='_' read -ra PARTS <<< "$FILENAME"
      SYMBOL="${PARTS[0]}"
      INTERVAL="${PARTS[1]}"
      STRATEGY="${PARTS[2]}"
      
      WIN_RATE=$(jq -r '.metrics.winRate // "N/A"' "$FILE" 2>/dev/null || echo "N/A")
      PROFIT_FACTOR=$(jq -r '.metrics.profitFactor // "N/A"' "$FILE" 2>/dev/null || echo "N/A")
      TOTAL_PNL=$(jq -r '.metrics.totalPnlPercent // "N/A"' "$FILE" 2>/dev/null || echo "N/A")
      TOTAL_TRADES=$(jq -r '.metrics.totalTrades // "N/A"' "$FILE" 2>/dev/null || echo "N/A")
      MAX_DD=$(jq -r '.metrics.maxDrawdownPercent // "N/A"' "$FILE" 2>/dev/null || echo "N/A")
      
      echo "$SYMBOL,$INTERVAL,$STRATEGY,$WIN_RATE,$PROFIT_FACTOR,$TOTAL_PNL,$TOTAL_TRADES,$MAX_DD" >> "$SUMMARY_FILE"
    fi
  done
  
  echo -e "${GREEN}✓${NC} Summary CSV generated: $SUMMARY_FILE"
else
  echo -e "${YELLOW}⚠${NC} jq not installed. Skipping summary CSV generation."
fi

# Find best performers
if command -v jq &> /dev/null && [ -f "$SUMMARY_FILE" ]; then
  echo ""
  echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║           TOP 10 BEST PERFORMERS                   ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
  echo ""
  
  # Sort by Total PnL % (descending)
  tail -n +2 "$SUMMARY_FILE" | sort -t',' -k6 -rn | head -10 | while IFS=',' read -r SYMBOL INTERVAL STRATEGY WIN_RATE PF TOTAL_PNL TRADES DD; do
    echo -e "${GREEN}${STRATEGY}${NC} on ${YELLOW}${SYMBOL} ${INTERVAL}${NC}"
    echo -e "  P&L: ${GREEN}${TOTAL_PNL}%${NC} | Win Rate: ${YELLOW}${WIN_RATE}%${NC} | PF: ${YELLOW}${PF}${NC} | Trades: ${YELLOW}${TRADES}${NC}"
    echo ""
  done
fi

echo ""
echo -e "${GREEN}✓ All backtests completed!${NC}"
echo ""
