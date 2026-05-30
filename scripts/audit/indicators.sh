#!/bin/bash

echo "📈 MarketMind Indicator Duplication Audit"
echo "========================================="
echo ""
echo "Generated: $(date)"
echo ""

echo "## Indicator Files"
echo ""

echo "### Frontend (apps/electron)"
echo ""
find apps/electron/src/renderer/utils/indicators -type f -name "*.ts" ! -name "*.test.ts" 2>/dev/null
echo ""

echo "### Shared Package (packages/indicators)"
echo ""
find packages/indicators/src -type f -name "*.ts" ! -name "*.test.ts" ! -name "index.ts" 2>/dev/null
echo ""

echo "## Potentially Duplicated Indicators"
echo ""

indicators=("macd" "ema" "sma" "rsi" "bollinger" "atr" "stochastic" "vwap" "volume")

for indicator in "${indicators[@]}"; do
  echo "### $indicator"
  echo "Frontend:"
  find apps/electron/src/renderer -name "*${indicator}*" -type f 2>/dev/null | grep -v test | grep -v node_modules
  echo "Package:"
  find packages/indicators/src -name "*${indicator}*" -type f 2>/dev/null | grep -v test
  echo ""
done

echo "## calculateMACD Implementations"
echo ""
grep -rn "export.*calculateMACD" apps packages --include="*.ts" 2>/dev/null
echo ""

echo "## calculateEMA Implementations"
echo ""
grep -rn "export.*calculateEMA" apps packages --include="*.ts" 2>/dev/null
echo ""

echo "## calculateRSI Implementations"
echo ""
grep -rn "export.*calculateRSI" apps packages --include="*.ts" 2>/dev/null
echo ""

echo "## Backend Indicator Usage"
echo ""
echo "IndicatorEngine.ts imports:"
grep -n "^import" apps/backend/src/services/setup-detection/dynamic/IndicatorEngine.ts 2>/dev/null | head -20
echo ""

echo "## Done ✅"
