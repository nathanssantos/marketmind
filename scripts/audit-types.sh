#!/bin/bash

echo "🔍 MarketMind Type Duplication Audit"
echo "===================================="
echo ""
echo "Generated: $(date)"
echo ""

echo "## Common Types to Check"
echo ""

echo "### Order Types"
echo ""
echo "BinanceOrderResult:"
grep -rn "export.*BinanceOrderResult" apps packages --include="*.ts" 2>/dev/null | head -10
echo ""

echo "Order:"
grep -rn "export.*type Order = " apps packages --include="*.ts" 2>/dev/null
echo ""

echo "OrderStatus:"
grep -rn "export.*OrderStatus" apps packages --include="*.ts" 2>/dev/null | head -10
echo ""

echo "OrderSide:"
grep -rn "export.*OrderSide" apps packages --include="*.ts" 2>/dev/null | head -10
echo ""

echo "### Pattern Types"
echo ""
echo "Pattern:"
grep -rn "export.*interface Pattern" apps packages --include="*.ts" 2>/dev/null | head -10
echo ""

echo "AIPattern:"
grep -rn "export.*AIPattern" apps packages --include="*.ts" 2>/dev/null | head -10
echo ""

echo "### Setup Types"
echo ""
echo "TradingSetup:"
grep -rn "export.*TradingSetup" apps packages --include="*.ts" 2>/dev/null | head -10
echo ""

echo "SetupDetection:"
grep -rn "export.*SetupDetection" apps packages --include="*.ts" 2>/dev/null | head -10
echo ""

echo "SetupDetectionConfig:"
grep -rn "export.*SetupDetectionConfig" apps packages --include="*.ts" 2>/dev/null | head -10
echo ""

echo "## Binance Types Location"
echo ""
find apps packages -name "binance.ts" -o -name "*binance*.ts" 2>/dev/null
echo ""

echo "## Done ✅"
