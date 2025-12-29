#!/bin/bash
LOG_FILE=$(ls -t optimization-log-*.txt 2>/dev/null | head -1)

if [ -z "$LOG_FILE" ]; then
    echo "❌ No log file found"
    exit 1
fi

while true; do
    clear
    echo "📊 BATCH OPTIMIZATION PROGRESS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    COMPLETED=$(grep -c "✅ Optimization complete for" "$LOG_FILE" 2>/dev/null || echo "0")
    FAILED=$(grep -c "❌ Optimization failed for" "$LOG_FILE" 2>/dev/null || echo "0")
    TOTAL=10
    PERCENT=$(( (COMPLETED + FAILED) * 100 / TOTAL ))
    
    echo ""
    echo "Progress: $((COMPLETED + FAILED))/$TOTAL strategies ($PERCENT%)"
    echo "✅ Completed: $COMPLETED | ❌ Failed: $FAILED"
    echo ""
    
    CURRENT=$(grep "🔧 Optimizing:" "$LOG_FILE" | tail -1 | sed 's/.*🔧 Optimizing: //')
    if [ -n "$CURRENT" ]; then
        echo "🔧 Current: $CURRENT"
        echo ""
    fi
    
    if [ "$COMPLETED" -gt 0 ]; then
        echo "✅ Completed:"
        grep "✅ Optimization complete for" "$LOG_FILE" | sed 's/.*complete for /  ✓ /'
        echo ""
    fi
    
    if grep -q "BATCH OPTIMIZATION SUMMARY" "$LOG_FILE"; then
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "✅ COMPLETE! Check: ./results/optimizations/"
        break
    fi
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📋 Latest:"
    tail -3 "$LOG_FILE" | sed 's/\[.*\] //'
    echo ""
    echo "⏳ Refreshing every 10s (Ctrl+C to exit)"
    
    sleep 10
done
