# MarketMind - Context for New Chat

## Quick Start

Copy this entire document and paste it in a new Claude Code chat to continue.

---

## Project Summary

MarketMind is an Electron-based trading application with:
- **105 trading strategies** in JSON format (backend)
- **Backtest engine** for strategy validation
- **Indicator library** in TypeScript (fully implemented)
- **Crypto data integration** with Binance Futures API and CoinGecko
- **Backend API** with Fastify + tRPC + PostgreSQL + TimescaleDB
- **Frontend** Electron + React 19 + Chakra UI

## Completed Work

### Sprint 2.5 - Setup Detection Centralization (COMPLETE ✅)

**ALL legacy frontend detector code REMOVED:**
- ❌ Deleted 12 detector files (Setup91-94, Pattern123, BullTrap, BearTrap, BreakoutRetest, Base, SetupCancellation, Service, index)
- ❌ Deleted entire `setupDetection/` directory from frontend
- ❌ Removed 3 legacy detectors from backend (Pattern123, BearTrap, MeanReversion)
- ❌ Removed obsolete `updateSetupConfig` function from setupStore

**NEW centralized architecture:**
- ✅ Created `apps/backend/src/routers/setup-detection.ts` (260 lines) - tRPC router with 5 endpoints
- ✅ Created `apps/electron/src/renderer/services/trpc.ts` - tRPC client
- ✅ Created `apps/electron/src/types/backend.d.ts` - Type declarations
- ✅ Refactored SetupTogglePopover to fetch strategies from backend via `useStrategyList` hook
- ✅ Simplified SetupConfigTab (270→90 lines) - now only global settings (minConfidence, minRiskReward)
- ✅ Rewrote setupConfig.ts (122→30 lines) - now just `{ enabledStrategies: string[], minConfidence: number, minRiskReward: number }`
- ✅ Updated setupStore.ts - removed updateSetupConfig, changed toggleAutoTrading logic

**tRPC Endpoints:**
```typescript
setupDetection.listStrategies()      // Returns all 105 strategy definitions
setupDetection.getStrategyDetails()  // Returns specific strategy metadata
setupDetection.detectSetups()        // Run detection on current klines
setupDetection.detectSetupsInRange() // Historical range detection
setupDetection.validateStrategy()    // Validate strategy JSON
```

**Test Results:**
- Frontend: 1,808 tests passing (1,781 unit + 27 browser) ✅
- Backend: 151 tests passing ✅
- **Total: 1,959 tests - 100% pass rate**
- Zero TypeScript errors ✅

**Architecture:**
- Frontend detectors: GONE (100% removed)
- Backend: Single StrategyInterpreter handles all 105 JSON strategies
- Type-safety: Full tRPC type inference from backend to frontend
- State: enabledStrategies array instead of individual setup objects

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
- **Frontend:** 1,808 tests passing (1,781 unit + 27 browser)
- **Backend:** 151 tests passing
- **Indicators:** 878+ tests passing
- **Total:** 2,837+ tests with 100% pass rate ✅
- Build passes with TypeScript strict mode
- All indicators exported from `packages/indicators/src/index.ts`

## Key Locations

```
# Backend
/apps/backend/strategies/builtin/                                           # 105 strategy JSON files
/apps/backend/src/routers/setup-detection.ts                                # NEW: tRPC setup detection endpoints
/apps/backend/src/services/setup-detection/SetupDetectionService.ts         # Refactored (427→200 lines)
/apps/backend/src/services/setup-detection/dynamic/IndicatorEngine.ts       # Indicator computation
/apps/backend/src/services/backtest/                                        # Backtest engine
/apps/backend/src/services/binance-futures-data.ts                          # Binance Futures API
/apps/backend/src/services/btc-dominance-data.ts                            # BTC Dominance API

# Frontend
/apps/electron/src/renderer/services/trpc.ts                                # NEW: tRPC client
/apps/electron/src/types/backend.d.ts                                       # NEW: Backend type declarations
/apps/electron/src/renderer/hooks/useSetupDetection.ts                      # NEW: useStrategyList hook
/apps/electron/src/renderer/components/Layout/SetupTogglePopover.tsx        # Refactored (uses backend)
/apps/electron/src/renderer/components/Settings/SetupConfigTab.tsx          # Simplified (270→90 lines)
/apps/electron/src/renderer/store/setupConfig.ts                            # Rewritten (122→30 lines)
/apps/electron/src/renderer/store/setupStore.ts                             # Refactored (removed updateSetupConfig)

# Packages
/packages/indicators/src/                                                   # Indicator implementations

# Documentation
/docs/STRATEGY_IMPLEMENTATION_PLAN.md                                       # Implementation plan
/.github/copilot-instructions.md                                            # Project guidelines
```

## Commands

```bash
# Test commands
pnpm test                                          # Run all tests (frontend + backend)
pnpm --filter @marketmind/electron test            # Frontend tests only
pnpm --filter @marketmind/backend test             # Backend tests only
pnpm --filter @marketmind/indicators test          # Indicator tests only

# Type checking
pnpm --filter @marketmind/electron type-check      # Frontend TypeScript check
pnpm --filter @marketmind/backend type-check       # Backend TypeScript check

# Development
cd apps/backend && pnpm dev                        # Start backend server (localhost:3001)
cd apps/electron && pnpm dev                       # Start frontend Electron app

# Build
pnpm --filter @marketmind/indicators build         # Build indicators package
pnpm --filter @marketmind/backend build            # Build backend
pnpm --filter @marketmind/electron build           # Build Electron app

# Backtest
pnpm --filter @marketmind/backend exec tsx src/cli/backtest-runner.ts validate \
  -s connors-rsi2-original --symbol BTCUSDT -i 1d --start 2024-01-01 --end 2024-10-01
```

## Architecture Changes

**Before Sprint 2.5:**
```
Frontend:
  - 12 detector TypeScript classes (Setup91-94, Pattern123, etc.)
  - SetupDetectionService managing all detectors
  - setupConfig with 8 individual setup objects
  
Backend:
  - 3 legacy detectors + 105 JSON strategies
```

**After Sprint 2.5:**
```
Frontend:
  - ❌ ZERO detector classes (all deleted)
  - tRPC client calls backend
  - setupConfig: { enabledStrategies: string[], minConfidence, minRiskReward }
  
Backend:
  - 105 JSON strategies handled by StrategyInterpreter
  - tRPC router with 5 endpoints
  - Type-safe API with full inference
```

## TypeScript Notes

The codebase uses strict TypeScript with `noUncheckedIndexedAccess`. When accessing array elements:
- Use non-null assertion (`array[i]!`) when index is guaranteed valid
- Use null/undefined checks (`if (val === null || val === undefined)`) for array element type narrowing

## Branch
- Current: `main` (Sprint 2.5 complete)
- All changes committed and tested

## What's Next?

Sprint 2.5 complete! Potential next tasks:
1. **Frontend Integration:** Wire up tRPC endpoints to chart detection display
2. **Real-time Detection:** Implement WebSocket streaming for live setup detection
3. **Strategy Management UI:** Add/edit/delete strategies from frontend
4. **Performance:** Add strategy caching and optimization
5. **Crypto Strategies:** Create more strategies using new crypto indicators
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
