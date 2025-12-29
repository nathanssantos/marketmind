#!/bin/bash

STRATEGIES="keltner-breakout-optimized bollinger-breakout-crypto larry-williams-9-1 larry-williams-9-2 larry-williams-9-3 larry-williams-9-4 williams-momentum tema-momentum elder-ray-crypto ppo-momentum parabolic-sar-crypto supertrend-follow"
SYMBOLS="BTCUSDT ETHUSDT SOLUSDT XRPUSDT"
INTERVALS="15m 30m 1h 4h 1d 1w"

echo "=== MarketMind Backtests ==="
echo "Date: $(date)"
echo "Strategies: 12"
echo "Symbols: 4"
echo "Intervals: 6"
echo "Total: 288 backtests"
echo ""

RESULTS_FILE="backtest-results-$(date +%Y%m%d-%H%M%S).csv"
echo "Strategy,Symbol,Interval,WinRate,TotalPnL%,ProfitFactor,MaxDrawdown%,Trades" > "$RESULTS_FILE"

for symbol in $SYMBOLS; do
  for interval in $INTERVALS; do
    echo "=== $symbol $interval ==="
    for strategy in $STRATEGIES; do
      echo "Running: $strategy"
      result=$(timeout 120 pnpm exec tsx src/cli/backtest-runner.ts validate -s "$strategy" --symbol "$symbol" -i "$interval" --start 2024-01-01 --end 2024-12-01 --optimized 2>&1)

      winrate=$(echo "$result" | grep "Win Rate" | head -1 | awk -F'│' '{print $3}' | tr -d ' %+')
      pnl=$(echo "$result" | grep "Total PnL %" | head -1 | awk -F'│' '{print $3}' | tr -d ' %+')
      pf=$(echo "$result" | grep "Profit Factor" | head -1 | awk -F'│' '{print $3}' | tr -d ' ')
      dd=$(echo "$result" | grep "Max Drawdown %" | head -1 | awk -F'│' '{print $3}' | tr -d ' %')
      trades=$(echo "$result" | grep "Total Trades" | head -1 | awk -F'│' '{print $3}' | tr -d ' ')

      echo "$strategy,$symbol,$interval,$winrate,$pnl,$pf,$dd,$trades" >> "$RESULTS_FILE"
      echo "  WR: ${winrate}% | PnL: ${pnl}% | PF: ${pf} | DD: ${dd}% | Trades: ${trades}"
    done
    echo ""
  done
done

echo ""
echo "=== Results saved to: $RESULTS_FILE ==="
