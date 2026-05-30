#!/bin/bash

# Performance Monitoring Script - MarketMind
# Usage: ./scripts/perf/monitor-performance.sh [duration_seconds]

DURATION=${1:-300}  # Default: 5 minutes
INTERVAL=5
mkdir -p logs
LOG_FILE="logs/performance-monitor-$(date +%Y%m%d-%H%M%S).log"

echo "🔍 Monitoring MarketMind Performance"
echo "Duration: ${DURATION}s (${INTERVAL}s per iteration)"
echo "Log: ${LOG_FILE}"
echo ""

# Function to capture metrics
capture_metrics() {
    local timestamp=$(date +"%Y-%m-%d %H:%M:%S")

    echo "=== $timestamp ===" | tee -a "$LOG_FILE"

    # 1. MarketMind processes
    echo "### Processes ###" | tee -a "$LOG_FILE"
    ps aux | grep -E "marketmind|electron|node.*backend" | grep -v grep | \
        awk '{printf "%-40s CPU: %6s MEM: %6s\n", substr($11" "$12,1,40), $3"%", $4"%"}' | \
        tee -a "$LOG_FILE"

    # 2. Totals
    echo "" | tee -a "$LOG_FILE"
    echo "### Totals ###" | tee -a "$LOG_FILE"
    ps aux | grep -E "marketmind|electron|node.*backend" | grep -v grep | \
        awk '{cpu+=$3; mem+=$4} END {printf "Total CPU: %.1f%%\nTotal MEM: %.1f%%\n", cpu, mem}' | \
        tee -a "$LOG_FILE"

    # 3. PostgreSQL connections
    echo "" | tee -a "$LOG_FILE"
    echo "### PostgreSQL Connections ###" | tee -a "$LOG_FILE"
    psql marketmind -c "SELECT state, COUNT(*) as count FROM pg_stat_activity WHERE datname = 'marketmind' GROUP BY state;" 2>/dev/null | \
        tee -a "$LOG_FILE"

    # 4. Active watchers
    echo "" | tee -a "$LOG_FILE"
    echo "### Active Watchers ###" | tee -a "$LOG_FILE"
    psql marketmind -c "SELECT COUNT(*) as total_watchers FROM active_watchers;" 2>/dev/null | \
        tee -a "$LOG_FILE"

    # 5. Open positions
    echo "" | tee -a "$LOG_FILE"
    echo "### Open Positions ###" | tee -a "$LOG_FILE"
    psql marketmind -c "SELECT COUNT(*) as open_positions FROM trade_executions WHERE status = 'open';" 2>/dev/null | \
        tee -a "$LOG_FILE"

    # 6. Price cache size
    echo "" | tee -a "$LOG_FILE"
    echo "### Price Cache ###" | tee -a "$LOG_FILE"
    psql marketmind -c "SELECT COUNT(*) as cached_prices, pg_size_pretty(pg_total_relation_size('price_cache')) as table_size FROM price_cache;" 2>/dev/null | \
        tee -a "$LOG_FILE"

    echo "" | tee -a "$LOG_FILE"
    echo "---" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
}

# Monitoring loop
elapsed=0
while [ $elapsed -lt $DURATION ]; do
    capture_metrics
    sleep $INTERVAL
    elapsed=$((elapsed + INTERVAL))
done

echo "✅ Monitoring complete!"
echo "Log saved to: $LOG_FILE"
echo ""

# Generate summary
echo "📊 Monitoring Summary" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Average CPU
echo "Average CPU:" | tee -a "$LOG_FILE"
grep "Total CPU:" "$LOG_FILE" | awk '{sum+=$3; count++} END {printf "  %.1f%%\n", sum/count}' | tee -a "$LOG_FILE"

# Average memory
echo "Average Memory:" | tee -a "$LOG_FILE"
grep "Total MEM:" "$LOG_FILE" | awk '{sum+=$3; count++} END {printf "  %.1f%%\n", sum/count}' | tee -a "$LOG_FILE"

# Average DB connections
echo "Average DB Connections:" | tee -a "$LOG_FILE"
grep -A 5 "PostgreSQL Connections" "$LOG_FILE" | grep "idle" | awk '{sum+=$3; count++} END {printf "  %.0f idle\n", sum/count}' | tee -a "$LOG_FILE"

echo ""
echo "For full analysis, see: $LOG_FILE"
