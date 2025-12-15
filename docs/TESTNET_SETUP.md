# 🔧 Testnet Configuration Guide

## Overview
MarketMind supports Binance Testnet for safe testing of advanced features like OCO orders and exchange-based trailing stops without risking real funds.

## Quick Setup

### 1. Get Testnet API Keys
1. Visit: https://testnet.binance.vision/
2. Login with GitHub or create an account
3. Generate API Key and Secret
4. Save both securely

### 2. Configure Environment
Add to `apps/backend/.env`:

```env
# Testnet Configuration
BINANCE_TESTNET_ENABLED=true
BINANCE_TESTNET_API_KEY=your_testnet_api_key_here
BINANCE_TESTNET_SECRET=your_testnet_secret_here
```

### 3. Restart Backend
```bash
cd apps/backend
pnpm dev
```

## Features Enabled with Testnet

### ✅ OCO Orders (One-Cancels-Other)
- **Status:** Ready, disabled by default
- **File:** `apps/backend/src/services/oco-orders.ts`
- **What it does:** 
  - Places both TP and SL orders on exchange
  - When one executes, the other auto-cancels
  - Eliminates risk of missed exits
- **Enabled when:** `BINANCE_TESTNET_ENABLED=true` + API keys set
- **Logs:** Will show "OCO orders ENABLED" on startup

### ✅ Exchange Trailing Stops
- **Status:** Ready, disabled by default
- **File:** `apps/backend/src/services/exchange-trailing-stop.ts`
- **What it does:**
  - Trailing stop executed on Binance servers
  - No need for MarketMind to be running
  - Lower latency, more reliable
- **Enabled when:** `BINANCE_TESTNET_ENABLED=true` + API keys set
- **Logs:** Will show "Exchange trailing stops ENABLED" on startup

## Current State (Without Testnet)

### What Works ✅
- Paper trading (all features)
- Local trailing stops (calculated by MarketMind)
- Stop loss as MARKET orders
- Take profit as LIMIT orders
- Position monitoring
- Kelly criterion
- Volatility adjustment
- Performance tracking
- Confidence calculation

### What's Disabled ⏸️
- OCO orders (falls back to separate SL/TP)
- Exchange trailing stops (uses local trailing)

## Testing Workflow

### Phase 1: Testnet Validation (5 days)
```bash
# Enable testnet
BINANCE_TESTNET_ENABLED=true

# Run for 5 days, monitor:
# - OCO order execution
# - Trailing stop behavior
# - API error rates
# - Order fill rates
```

### Phase 2: Live Micro-Test (7 days)
```bash
# Disable testnet, use real wallet with $50-100
BINANCE_TESTNET_ENABLED=false

# Create live wallet in MarketMind
# Enable auto-trading with:
# - Max position: 5% ($2.50-5)
# - Max concurrent: 1-2 positions
# - Daily loss limit: 2% ($1-2)
```

## Switching Between Testnet and Live

### To Testnet:
```env
BINANCE_TESTNET_ENABLED=true
BINANCE_TESTNET_API_KEY=testnet_key
BINANCE_TESTNET_SECRET=testnet_secret
```

### To Live:
```env
BINANCE_TESTNET_ENABLED=false
# Use wallet management in UI for live keys
```

## Safety Features

### Pre-Trade Validation
```typescript
// Auto-trading scheduler checks:
1. Cooldown (15 min between same setup)
2. Max concurrent positions (5)
3. Max position size (10%)
4. Daily loss limit (5%)
5. Risk/reward ratio (>= 1.5)
6. Strategy performance (min 20 trades)
```

### Red Flags (Auto-Disable)
- Drawdown > 5% in 24h → Disable auto-trading
- Slippage > 0.5% → Alert and reduce size
- API errors > 5% → Switch to paper trading
- 3+ consecutive losses → Reduce position size 25%

## Monitoring

### Logs to Watch
```bash
# Backend logs
tail -f apps/backend/logs/combined.log | grep -E "(OCO|trailing|execution)"

# Check service status
grep "ENABLED\|DISABLED" apps/backend/logs/combined.log | tail -5
```

### Expected Output (Testnet Enabled)
```
[INFO] OCO orders ENABLED - using Binance Testnet
[INFO] Exchange trailing stops ENABLED - using Binance Testnet
[INFO] Auto-trading scheduler started
```

### Expected Output (Testnet Disabled)
```
[INFO] OCO orders DISABLED - enable with BINANCE_TESTNET_ENABLED=true
[INFO] Exchange trailing stops DISABLED - enable with BINANCE_TESTNET_ENABLED=true
[INFO] Using local trailing stops and separate SL/TP orders
```

## FAQ

**Q: Can I use testnet for paper trading?**
A: No, paper trading doesn't need testnet. Testnet is for validating real order execution without risk.

**Q: Will my strategies work differently on testnet?**
A: Execution is identical, but testnet has less liquidity and different prices than mainnet.

**Q: Do I need testnet before going live?**
A: Highly recommended. The action plan requires 5 days of testnet validation.

**Q: Can I switch mid-day?**
A: Yes, but restart the backend server after changing `.env`.

**Q: What if testnet API is down?**
A: MarketMind will log errors but continue with local fallbacks (separate SL/TP, local trailing).

## Next Steps

1. ✅ Setup complete (tables, services, confidence)
2. ⏳ Get testnet keys when ready
3. ⏳ Enable testnet mode
4. ⏳ Run 5-day validation
5. ⏳ Switch to live with micro-capital
6. ⏳ Scale gradually

---

**Current Status:** All infrastructure ready, waiting for testnet keys to enable OCO/trailing features.
