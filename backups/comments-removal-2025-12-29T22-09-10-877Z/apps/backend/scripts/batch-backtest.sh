#!/bin/bash

# Batch Backtest Script - Aligned with Auto-Trading Configuration
# Runs all 102 strategies against BTC, ETH, SOL, XRP on 1h, 4h, 1d, 1w, 1M
# Uses the EXACT same configuration as auto-trading

SYMBOLS="BTCUSDT ETHUSDT SOLUSDT XRPUSDT"
INTERVALS="1h 4h 1d 1w"
START_DATE="2024-01-01"
END_DATE="2024-12-19"

# Auto-trading aligned configuration:
# - maxPositionSize: 25% (from autoTradingConfig table)
# - maxConcurrentPositions: 4 (from autoTradingConfig table)
# - minConfidence: 50 (hardcoded in auto-trading-scheduler.ts)
# - commission: 0.1% (COMMISSION_PERCENT in auto-trading-scheduler.ts)
# - useAlgorithmicLevels: true (auto-trading uses strategy's calculated SL/TP)
# - NO --optimized flag (auto-trading doesn't use optimizedParams for trading)
# - NO --with-trend flag (user specified NOT to use onlyWithTrend)
# - useCooldown: true, cooldownMinutes: 15 (auto-trading uses cooldown)
# - dailyLossLimit: 5% (from autoTradingConfig table)

MAX_POSITION="25"
MAX_CONCURRENT="4"
MIN_CONFIDENCE="50"
COMMISSION="0.1"
COOLDOWN_MINUTES="15"
DAILY_LOSS_LIMIT="5"
CAPITAL="10000"

STRATEGIES=(
  "7day-momentum-crypto"
  "adx-ema-trend"
  "altcoin-season"
  "aroon-trend-crypto"
  "atr-volatility-breakout"
  "awesome-oscillator-crypto"
  "bear-trap"
  "bitcoin-macd-momentum"
  "bollinger-breakout-crypto"
  "breakout-retest"
  "bull-trap"
  "cci-optimized-daily"
  "cci-trend-rider"
  "chaikin-money-flow"
  "chande-momentum-crypto"
  "connors-rsi2-original"
  "cumulative-rsi-r3"
  "dca-grid-hybrid"
  "dema-crossover-crypto"
  "divergence-rsi-macd"
  "dmi-adx-trend"
  "donchian-adx-breakout-crypto"
  "donchian-breakout"
  "double-seven"
  "elder-ray-crypto"
  "ema-crossover"
  "ema20-trend-crypto"
  "ema5-momentum-crypto"
  "ema9-21-rsi-confirmation"
  "engulfing-pattern"
  "enhanced-trend-following"
  "fair-value-gap"
  "fibonacci-retracement"
  "funding-rate-arbitrage"
  "gap-fill-crypto"
  "golden-cross-sma"
  "grid-trading"
  "hammer-doji"
  "hull-ma-trend"
  "ibs-mean-reversion"
  "inside-bar-breakout"
  "keltner-breakout-optimized"
  "keltner-squeeze"
  "klinger-oscillator"
  "larry-williams-9-1"
  "larry-williams-9-2"
  "larry-williams-9-3"
  "larry-williams-9-4"
  "liquidation-cascade"
  "liquidity-sweep"
  "macd-divergence"
  "market-making"
  "market-structure-break"
  "marubozu-momentum"
  "mass-index-reversal"
  "mean-reversion-bb-rsi"
  "mean-reversion-extreme"
  "mfi-divergence"
  "momentum-25day-crypto"
  "momentum-breakout-2025"
  "momentum-rotation"
  "morning-star"
  "nr7-breakout"
  "obv-divergence"
  "open-interest-divergence"
  "order-block-fvg"
  "order-flow-imbalance"
  "parabolic-sar-crypto"
  "pattern-123-reversal"
  "percent-b-connors"
  "pin-inside-combo"
  "pivot-points-crypto"
  "ppo-momentum"
  "range-breakout"
  "roc-momentum-crypto"
  "rsi-divergence-trend"
  "rsi-macd-combined"
  "rsi-momentum-breakout-70"
  "rsi-oversold-bounce"
  "rsi-sma-filter"
  "rsi2-mean-reversion"
  "rsi50-momentum-crossover"
  "scalping-1m"
  "scalping-5m"
  "supertrend-follow"
  "swing-weekly"
  "tema-momentum"
  "three-bar-reversal"
  "trend-pullback-2025"
  "triple-confirmation-reversal"
  "triple-ema-confluence"
  "triple-screen"
  "tsi-momentum"
  "ultimate-oscillator-crypto"
  "volatility-contraction"
  "volume-price-breakout"
  "vortex-indicator"
  "vwap-ema-cross"
  "vwap-pullback"
  "whale-accumulation"
  "williams-momentum"
  "williams-r-reversal"
)

TOTAL_STRATEGIES=${#STRATEGIES[@]}
TOTAL_COMBINATIONS=$((TOTAL_STRATEGIES * 4 * 4))

echo "=========================================="
echo "BATCH BACKTEST - Auto-Trading Aligned"
echo "=========================================="
echo "Strategies: $TOTAL_STRATEGIES"
echo "Symbols: $SYMBOLS"
echo "Intervals: $INTERVALS"
echo "Total backtests: $TOTAL_COMBINATIONS"
echo "Date range: $START_DATE to $END_DATE"
echo ""
echo "Configuration (matching auto-trading):"
echo "  - Max Position Size: ${MAX_POSITION}%"
echo "  - Max Concurrent: $MAX_CONCURRENT"
echo "  - Min Confidence: $MIN_CONFIDENCE"
echo "  - Commission: ${COMMISSION}%"
echo "  - Cooldown: ${COOLDOWN_MINUTES} minutes"
echo "  - Daily Loss Limit: ${DAILY_LOSS_LIMIT}%"
echo "  - Using Algorithmic Levels: YES"
echo "  - Using Optimized Params: NO"
echo "  - Only With Trend: NO"
echo "=========================================="
echo ""

RESULTS_DIR="backtest-results/batch-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

SUMMARY_FILE="$RESULTS_DIR/summary.csv"
echo "strategy,symbol,interval,total_trades,win_rate,profit_factor,total_pnl_percent,max_drawdown_percent,sharpe_ratio,status" > "$SUMMARY_FILE"

COMPLETED=0
FAILED=0
SKIPPED=0

for strategy in "${STRATEGIES[@]}"; do
  for symbol in $SYMBOLS; do
    for interval in $INTERVALS; do
      COMPLETED=$((COMPLETED + 1))
      PROGRESS_PCT=$((COMPLETED * 100 / TOTAL_COMBINATIONS))

      echo "[$COMPLETED/$TOTAL_COMBINATIONS] ($PROGRESS_PCT%) Testing $strategy on $symbol $interval..."

      LOG_FILE="$RESULTS_DIR/${strategy}_${symbol}_${interval}.log"

      timeout 180 pnpm exec tsx src/cli/backtest-runner.ts validate \
        -s "$strategy" \
        --symbol "$symbol" \
        -i "$interval" \
        --start "$START_DATE" \
        --end "$END_DATE" \
        --capital "$CAPITAL" \
        --max-position "$MAX_POSITION" \
        --max-concurrent "$MAX_CONCURRENT" \
        --min-confidence "$MIN_CONFIDENCE" \
        --commission "$COMMISSION" \
        --use-algorithmic-levels \
        --use-cooldown \
        --cooldown-minutes "$COOLDOWN_MINUTES" \
        --daily-loss-limit "$DAILY_LOSS_LIMIT" \
        > "$LOG_FILE" 2>&1

      EXIT_CODE=$?

      if [ $EXIT_CODE -eq 0 ]; then
        # Parse from JSON-style log output (more reliable than table parsing)
        # Format: trades: 173, winRate: '56.07%', profitFactor: '0.51'
        TOTAL_TRADES=$(grep "^  trades:" "$LOG_FILE" | tail -1 | sed 's/.*trades: //' | sed 's/,.*//')
        WIN_RATE=$(grep "winRate:" "$LOG_FILE" | tail -1 | sed "s/.*winRate: '//" | sed "s/%'.*//" | tr -d "'")
        PROFIT_FACTOR=$(grep "profitFactor:" "$LOG_FILE" | tail -1 | sed "s/.*profitFactor: '//" | sed "s/'.*//" | tr -d "'")

        # Parse PnL from format: totalPnl: '-214.55 USDT (-2.15%)'
        TOTAL_PNL=$(grep "totalPnl:" "$LOG_FILE" | tail -1 | sed 's/.*(//' | sed 's/%).*//' | tr -d "'")

        # Parse maxDrawdown from format: maxDrawdown: '263.04 USDT (2.63%)'
        MAX_DD=$(grep "maxDrawdown:" "$LOG_FILE" | tail -1 | sed 's/.*(//' | sed 's/%).*//' | tr -d "'")

        # Parse Sharpe from table (simpler pattern)
        SHARPE=$(grep "Sharpe Ratio" "$LOG_FILE" | tail -1 | awk '{print $NF}' | tr -d '│ ')

        # Default values if parsing fails
        TOTAL_TRADES=${TOTAL_TRADES:-0}
        WIN_RATE=${WIN_RATE:-0}
        PROFIT_FACTOR=${PROFIT_FACTOR:-0}
        TOTAL_PNL=${TOTAL_PNL:-0}
        MAX_DD=${MAX_DD:-0}
        SHARPE=${SHARPE:-0}

        if [ "$TOTAL_TRADES" = "0" ] || [ -z "$TOTAL_TRADES" ]; then
          echo "$strategy,$symbol,$interval,0,0,0,0,0,0,no_trades" >> "$SUMMARY_FILE"
          echo "  ⚠ No trades generated"
          SKIPPED=$((SKIPPED + 1))
        else
          echo "$strategy,$symbol,$interval,$TOTAL_TRADES,$WIN_RATE,$PROFIT_FACTOR,$TOTAL_PNL,$MAX_DD,$SHARPE,completed" >> "$SUMMARY_FILE"
          echo "  ✓ $TOTAL_TRADES trades, WR: ${WIN_RATE}%, PF: $PROFIT_FACTOR, PnL: ${TOTAL_PNL}%"
        fi
      else
        echo "$strategy,$symbol,$interval,0,0,0,0,0,0,failed" >> "$SUMMARY_FILE"
        echo "  ✗ Failed (exit code: $EXIT_CODE)"
        FAILED=$((FAILED + 1))
      fi
    done
  done
done

echo ""
echo "=========================================="
echo "BATCH BACKTEST COMPLETE"
echo "=========================================="
echo "Total: $TOTAL_COMBINATIONS"
echo "Successful: $((COMPLETED - FAILED - SKIPPED))"
echo "No trades: $SKIPPED"
echo "Failed: $FAILED"
echo "Results: $RESULTS_DIR"
echo "Summary: $SUMMARY_FILE"
echo "=========================================="

# Generate quick analysis
echo ""
echo "TOP 10 STRATEGIES BY PROFIT FACTOR:"
tail -n +2 "$SUMMARY_FILE" | \
  awk -F',' '$10=="completed" && $3!="0" {print $6","$1","$2","$3","$7"%"}' | \
  sort -t',' -k1 -nr | \
  head -10 | \
  awk -F',' '{printf "  %s: %s %s %s (PnL: %s)\n", NR, $2, $3, $4, $5}'

echo ""
echo "TOP 10 STRATEGIES BY WIN RATE:"
tail -n +2 "$SUMMARY_FILE" | \
  awk -F',' '$10=="completed" && $4>10 {print $5","$1","$2","$3","$7"%"}' | \
  sort -t',' -k1 -nr | \
  head -10 | \
  awk -F',' '{printf "  %s: %s %s %s (PnL: %s)\n", NR, $2, $3, $4, $5}'
