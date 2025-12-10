# MarketMind - Context for New Chat

## Quick Start

Copy this entire document and paste it in a new Claude Code chat to continue.

---

## Project Summary

MarketMind is an Electron-based trading application with:
- **105 trading strategies** in JSON format
- **Backtest engine** for strategy validation
- **Indicator library** in TypeScript (fully implemented)
- **Crypto data integration** with Binance Futures API and CoinGecko

## Completed Work

### All 41 Technical Indicators Implemented (7 Sprints Complete)

**Sprint 1 - Trend Indicators:**
- ROC (Rate of Change)
- DEMA (Double EMA)
- TEMA (Triple EMA)
- WMA (Weighted MA)
- HMA (Hull MA)
- CMO (Chande Momentum Oscillator)

**Sprint 2 - Oscillators:**
- AO (Awesome Oscillator)
- PPO (Percentage Price Oscillator)
- TSI (True Strength Index)
- Ultimate Oscillator

**Sprint 3 - Trend & Volatility:**
- Aroon (Up/Down/Oscillator)
- DMI (+DI/-DI)
- Vortex (VI+/VI-)
- Parabolic SAR
- Mass Index

**Sprint 4 - Volume:**
- CMF (Chaikin Money Flow)
- Klinger Volume Oscillator
- Elder Ray (Bull/Bear Power)
- Delta Volume

**Sprint 5 - Structure:**
- Swing Points (High/Low detection)
- FVG (Fair Value Gap)
- Candle Patterns (15 patterns: doji, hammer, engulfing, morning/evening star, etc.)
- Gap Detection
- Fibonacci (Retracement/Extension)

**Sprint 6 - Support/Resistance:**
- Floor Trader Pivot Points (Standard, Fibonacci, Woodie, Camarilla, Demark)
- Liquidity Levels (zones, sweeps detection, clustering)

**Sprint 7 - Crypto-Specific:**
- Funding Rate (calculations, signals, MA, annualization, cost)
- Open Interest (divergence detection, OI ratio, trends)
- Liquidations (cascade detection, delta, cumulative, heatmap)
- BTC Dominance (altcoin season detection, trends, phases)
- Relative Strength vs BTC (outperformance analysis, comparisons)

### Binance Futures API Integration (Complete)

**Created Services:**
1. `apps/backend/src/services/binance-futures-data.ts` - Binance Futures data:
   - `getFundingRate()` - Historical funding rate
   - `getCurrentFundingRate()` - Real-time funding rate
   - `getOpenInterest()` - Historical open interest
   - `getCurrentOpenInterest()` - Real-time open interest
   - `getLiquidations()` - Aggregated liquidation data
   - `getLongShortRatio()` - Global long/short account ratio
   - `getTopTraderLongShortRatio()` - Top trader positions
   - `getTakerBuySellVolume()` - Taker buy/sell volume
   - Built-in caching with 60s TTL

2. `apps/backend/src/services/btc-dominance-data.ts` - BTC Dominance:
   - Primary: **CoinGecko API** (FREE, no API key required)
   - Fallback: CoinMarketCap API (optional, needs API key)
   - `getBTCDominance()` - Returns btcDominance, ethDominance, totalMarketCap
   - `getBTCDominanceResult()` - Returns analysis with trend
   - Cache: 2 minutes TTL

3. `apps/backend/src/services/setup-detection/dynamic/IndicatorEngine.ts` - Updated:
   - New async method `computeIndicatorsWithCryptoData()` for strategies using crypto indicators
   - Crypto data caching (60s TTL)
   - Integration with all crypto indicator functions

### Crypto Indicators Available in IndicatorEngine:

| Indicator | Data Source | Output Fields |
|-----------|-------------|---------------|
| fundingRate | Binance Futures | current, signal (1=long, -1=short, 0=none) |
| openInterest | Binance Futures | current, trend (1=up, -1=down, 0=stable), divergence |
| liquidations | Binance Futures | delta, cascade (1/0), dominantSide (1=long, -1=short, 0=balanced) |
| relativeStrength | Calculated | ratio, outperforming (1/0), strength (2/1/0/-1) |
| btcDominance | CoinGecko | current |

### Test Results
- **878+ tests passing** (89+ test files)
- Build passes with TypeScript strict mode
- All indicators exported from `packages/indicators/src/index.ts`

## Key Locations

```
/apps/backend/strategies/builtin/                              # 105 strategy JSON files
/packages/indicators/src/                                       # Indicator implementations
/apps/backend/src/services/backtest/                            # Backtest engine
/apps/backend/src/services/binance-futures-data.ts              # Binance Futures API
/apps/backend/src/services/btc-dominance-data.ts                # BTC Dominance API
/apps/backend/src/services/setup-detection/dynamic/IndicatorEngine.ts  # Indicator computation
/docs/STRATEGY_IMPLEMENTATION_PLAN.md                           # Implementation plan
```

## Commands

```bash
# Run indicator tests
pnpm --filter @marketmind/indicators test -- --run

# Build indicators package
pnpm --filter @marketmind/indicators build

# Type check backend
pnpm --filter @marketmind/backend exec tsc --noEmit

# Run all tests
pnpm test

# Validate a strategy
pnpm --filter @marketmind/backend exec tsx src/cli/backtest-runner.ts validate \
  -s connors-rsi2-original --symbol BTCUSDT -i 1d --start 2024-01-01 --end 2024-10-01
```

## TypeScript Notes

The codebase uses strict TypeScript with `noUncheckedIndexedAccess`. When accessing array elements:
- Use non-null assertion (`array[i]!`) when index is guaranteed valid
- Use null/undefined checks (`if (val === null || val === undefined)`) for array element type narrowing

## Branch
- Current: `feature/setup-optimization`
- Main branch: `main`

## What's Next?

All indicator implementation sprints + Binance/CoinGecko integration complete! Potential next tasks:
1. Add crypto-based trading strategies using new crypto indicators
2. Integrate indicators into frontend chart visualization
3. Add real-time crypto data streaming (WebSocket)
4. Optimize backtesting with crypto indicators
5. Add indicator documentation/tooltips in the UI
6. Create indicator presets/configurations

---

## Request Template

```
Working on MarketMind following CLAUDE.md instructions.

Status:
- Completed: All 41 technical indicators (Sprints 1-7)
- Completed: Binance Futures API integration (funding rate, OI, liquidations)
- Completed: BTC Dominance via CoinGecko (free, no API key)
- Completed: IndicatorEngine crypto indicator support
- Tests: 878+ passing
- Build: Passing
- Branch: feature/setup-optimization

Reference docs:
- /docs/NEXT_CHAT_CONTEXT.md
- /CLAUDE.md

Task: [describe your next task here]
```

---

## Additional Context Files

Read these files first:
1. `/Users/nathan/Documents/dev/marketmind/CLAUDE.md` - Project conventions
2. `/packages/indicators/src/index.ts` - All indicator exports
3. `/apps/backend/src/services/binance-futures-data.ts` - Binance Futures service
4. `/apps/backend/src/services/btc-dominance-data.ts` - BTC Dominance service
5. `/apps/backend/src/services/setup-detection/dynamic/IndicatorEngine.ts` - Indicator engine
6. `/docs/STRATEGY_IMPLEMENTATION_PLAN.md` - Implementation plan reference
