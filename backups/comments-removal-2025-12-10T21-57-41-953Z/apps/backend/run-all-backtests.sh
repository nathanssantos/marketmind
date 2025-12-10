#!/bin/bash

echo "Strategy,Trades,Win Rate,PnL %,Profit Factor,Max DD %,Sharpe"
echo "======================================================================="

for strategy in $(ls strategies/builtin/*.json | xargs -n1 basename | sed 's/.json$//'); do
    result=$(npm run backtest:validate -- --strategy "$strategy" --symbol BTCUSDT --interval 1h --start 2024-01-01 --end 2024-12-31 2>&1)
    
    trades=$(echo "$result" | grep "Total Trades" | awk '{print $NF}')
    winrate=$(echo "$result" | grep "Win Rate" | awk '{print $NF}')
    pnl=$(echo "$result" | grep "Total PnL %" | awk '{print $NF}')
    pf=$(echo "$result" | grep "Profit Factor" | awk '{print $NF}')
    dd=$(echo "$result" | grep "Max Drawdown %" | awk '{print $NF}')
    sharpe=$(echo "$result" | grep "Sharpe Ratio" | awk '{print $NF}')
    
    echo "$strategy,$trades,$winrate,$pnl,$pf,$dd,$sharpe"
done
