#!/bin/bash
# MarketMind Testnet Activation Script
# Run this after adding testnet keys to .env

set -e

echo "🔧 MarketMind Testnet Activation"
echo "=================================="
echo ""

# Check if .env exists
if [ ! -f "apps/backend/.env" ]; then
    echo "❌ Error: apps/backend/.env not found"
    echo "   Create it from .env.example first"
    exit 1
fi

# Check for required variables
source apps/backend/.env

if [ -z "$BINANCE_TESTNET_API_KEY" ] || [ -z "$BINANCE_TESTNET_SECRET" ]; then
    echo "⚠️  Warning: Testnet keys not found in .env"
    echo ""
    echo "To enable testnet features, add to apps/backend/.env:"
    echo ""
    echo "BINANCE_TESTNET_ENABLED=true"
    echo "BINANCE_TESTNET_API_KEY=your_key_here"
    echo "BINANCE_TESTNET_SECRET=your_secret_here"
    echo ""
    echo "Get keys at: https://testnet.binance.vision/"
    echo ""
    exit 1
fi

if [ "$BINANCE_TESTNET_ENABLED" != "true" ]; then
    echo "⚠️  BINANCE_TESTNET_ENABLED is not set to 'true'"
    echo "   Set it in apps/backend/.env to enable testnet features"
    exit 1
fi

echo "✅ Testnet configuration found"
echo ""
echo "📊 Checking database migrations..."

# Check if tables exist
psql "$DATABASE_URL" -c "\dt strategy_performance" > /dev/null 2>&1 && echo "  ✅ strategy_performance table exists" || echo "  ⚠️  strategy_performance table missing"
psql "$DATABASE_URL" -c "\dt trade_cooldowns" > /dev/null 2>&1 && echo "  ✅ trade_cooldowns table exists" || echo "  ⚠️  trade_cooldowns table missing"

echo ""
echo "🚀 Starting backend with testnet enabled..."
echo ""

cd apps/backend
pnpm dev

# The server will log:
# [INFO] OCO orders ENABLED - using Binance Testnet
# [INFO] Exchange trailing stops ENABLED - using Binance Testnet
