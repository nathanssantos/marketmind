#!/bin/bash
strategies=(
  "order-block-fvg"
  "liquidity-sweep"
  "divergence-rsi-macd"
  "larry-williams-9-1"
  "larry-williams-9-2"
  "larry-williams-9-3"
  "larry-williams-9-4"
  "connors-rsi2-original"
  "cumulative-rsi-r3"
  "double-seven"
  "mean-reversion-bb-rsi"
  "rsi2-mean-reversion"
  "ibs-mean-reversion"
  "donchian-breakout"
  "momentum-breakout-2025"
  "trend-pullback-2025"
)

printf "%-30s | %6s | %8s | %8s | %6s | %8s\n" "Strategy" "Trades" "Win Rate" "PnL %" "PF" "Max DD %"
printf "%.0s-" {1..80}
echo ""

for strategy in "${strategies[@]}"; do
    result=$(npm run backtest:validate -- --strategy "$strategy" --symbol BTCUSDT --interval 1h --start 2024-01-01 --end 2024-12-31 2>&1)
    
    trades=$(echo "$result" | grep "│ Total Trades" | awk '{print $(NF-1)}' | tr -d '│')
    winrate=$(echo "$result" | grep "│ Win Rate" | awk '{print $(NF-1)}' | tr -d '│')
    pnl=$(echo "$result" | grep "│ Total PnL %" | awk '{print $(NF-1)}' | tr -d '│')
    pf=$(echo "$result" | grep "│ Profit Factor" | awk '{print $(NF-1)}' | tr -d '│')
    dd=$(echo "$result" | grep "│ Max Drawdown %" | awk '{print $(NF-1)}' | tr -d '│')
    
    printf "%-30s | %6s | %8s | %8s | %6s | %8s\n" "$strategy" "$trades" "$winrate" "$pnl" "$pf" "$dd"
done
