#!/bin/bash
# Monitor optimization progress

LOG_FILE="/tmp/optimization-all-v2.txt"

while true; do
    clear
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║         OPTIMIZATION PROGRESS MONITOR                          ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Count progress
    if [ -f "$LOG_FILE" ]; then
        TOTAL=$(grep -c "Optimizing:" "$LOG_FILE" || echo "0")
        IMPROVED=$(grep -c "✓ Improved" "$LOG_FILE" || echo "0")
        NO_IMPROVEMENT=$(grep -c "→ No improvement" "$LOG_FILE" || echo "0")
        FAILED=$(grep -c "✗ Optimization failed" "$LOG_FILE" || echo "0")
        
        echo "Progress: $TOTAL/105 strategies processed"
        echo "Improved: $IMPROVED"
        echo "No Improvement: $NO_IMPROVEMENT"
        echo "Failed: $FAILED"
        echo ""
        echo "────────────────────────────────────────────────────────────────"
        echo ""
        echo "Recent activity (last 15 lines):"
        echo ""
        tail -15 "$LOG_FILE"
    else
        echo "Waiting for log file..."
    fi
    
    echo ""
    echo "────────────────────────────────────────────────────────────────"
    echo "Press Ctrl+C to stop monitoring (optimization continues in background)"
    
    sleep 5
done
