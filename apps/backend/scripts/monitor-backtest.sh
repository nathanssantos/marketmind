#!/bin/bash

LOG_FILE="/tmp/backtest-output.log"
PID=63252

echo "=== Backtest Monitor ==="
echo "Checking every 60 seconds..."
echo ""

while true; do
    # Check if process is still running
    if ! ps -p $PID > /dev/null 2>&1; then
        echo ""
        echo "=========================================="
        echo "BACKTEST COMPLETED!"
        echo "=========================================="
        echo ""
        echo "Final output:"
        tail -100 $LOG_FILE
        break
    fi

    # Get process stats
    CPU_TIME=$(ps -o time= -p $PID 2>/dev/null)
    MEM=$(ps -o rss= -p $PID 2>/dev/null | awk '{printf "%.0f MB", $1/1024}')
    LINES=$(wc -l < $LOG_FILE)
    LAST_LINE=$(tail -1 $LOG_FILE)

    echo "[$(date '+%H:%M:%S')] CPU: $CPU_TIME | Mem: $MEM | Lines: $LINES"
    echo "  Last: ${LAST_LINE:0:80}"
    echo ""

    sleep 60
done
