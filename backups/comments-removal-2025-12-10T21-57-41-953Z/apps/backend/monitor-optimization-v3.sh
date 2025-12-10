#!/bin/bash

LOG_FILE="/tmp/optimization-all-v3.txt"

watch_optimization() {
  while true; do
    clear
    echo "Press Ctrl+C to stop monitoring (optimization continues in background)"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║         OPTIMIZATION PROGRESS MONITOR V3                       ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    
    if [ -f "$LOG_FILE" ]; then
      processed=$(grep -c "^\[.*\] Optimizing:" "$LOG_FILE" || echo "0")
      improved=$(grep -c "✓ Improved by" "$LOG_FILE" || echo "0")
      no_improvement=$(grep -c "→ No improvement" "$LOG_FILE" || echo "0")
      failed=$(grep -c "✗ Optimization failed" "$LOG_FILE" || echo "0")
      zero_trades_rejected=$(grep -c "0 trades)" "$LOG_FILE" | awk '{print int($1/2)}' || echo "0")
      
      echo "Progress: $processed/105 strategies processed"
      echo "Improved: $improved"
      echo "No Improvement: $no_improvement"
      echo "Failed: $failed"
      echo "Zero-trade results rejected: $zero_trades_rejected"
      echo ""
      echo "────────────────────────────────────────────────────────────────"
      echo ""
      echo "Recent activity (last 20 lines):"
      echo ""
      tail -20 "$LOG_FILE"
    else
      echo "Waiting for log file to be created..."
    fi
    
    echo ""
    echo "────────────────────────────────────────────────────────────────"
    sleep 3
  done
}

watch_optimization
