#!/bin/bash
# Volume Filter Optimization Script
# Run this script to optimize volume filter parameters for BTCUSDT 1h

cd /Users/nathan/Documents/dev/marketmind/apps/backend

echo "Starting Volume Filter Optimization..."
echo "Symbol: BTCUSDT, Interval: 1h, Period: 2025-01-26 to 2026-01-26"
echo ""

LOG_LEVEL=silent PINO_LOG_LEVEL=silent pnpm tsx src/cli/optimize-volume-filter.ts \
  --symbol=BTCUSDT \
  --interval=1h \
  --start=2025-01-26 \
  --end=2026-01-26

echo ""
echo "Optimization complete!"
