# Market Screener - Implementation Plan

## Overview

Standalone market screener accessible via a modal, with pre-built presets and a custom filter builder using the 60+ indicators already in `@marketmind/indicators`. Works for both Binance (crypto) and Interactive Brokers (stocks).

---

## Progress Tracker

> **This plan is a living document.** Update this section as each phase is completed.
> Mark phases as they progress: `[ ]` pending, `[~]` in progress, `[x]` done.

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Types | [x] | `packages/types/src/screener.ts` |
| 2. Constants | [x] | `apps/backend/src/constants/screener.ts` |
| 3. Indicator Evaluator | [x] | `apps/backend/src/services/screener/indicator-evaluator.ts` |
| 4. Filter Evaluator | [x] | `apps/backend/src/services/screener/filter-evaluator.ts` |
| 5. Indicator Metadata | [x] | `apps/backend/src/services/screener/indicator-metadata.ts` |
| 6. Presets | [x] | `apps/backend/src/services/screener/presets.ts` |
| 7. Screener Service | [x] | `apps/backend/src/services/screener/screener-service.ts` |
| 8. tRPC Router | [x] | `apps/backend/src/routers/screener.ts` + registered in router.ts |
| 9. Backend Tests | [x] | indicator-evaluator + filter-evaluator tests |
| 10. Screener Store | [x] | `apps/electron/src/renderer/store/screenerStore.ts` |
| 11. useScreener Hook | [x] | `apps/electron/src/renderer/hooks/useScreener.ts` |
| 12-17. Components | [x] | ScreenerModal, PresetBar, FilterBuilder, FilterRow, FilterChip, ScreenerResultsTable, SaveScreenerDialog, SavedScreenersList |
| 18. Toolbar/Layout | [x] | Toolbar button + ScreenerModal in MainLayout |
| 19. i18n | [x] | EN, PT, ES, FR translations |
| 20. Verification | [~] | Pending type-check, lint, test run |

**Last updated:** 2026-02-07
**Current branch:** feature/market-screener
**Blockers:** Drizzle query logging flooding stdout (fixed with `logger: false`)

---

## New Chat Prompt

If context is lost or a new chat session is needed, use the following prompt to resume:

```
Working on MarketMind following CLAUDE.md.

Status:
- Feature: Market Screener
- Branch: feature/market-screener
- Plan: docs/SCREENER_IMPLEMENTATION_PLAN.md (read this file for full context)

The plan has a Progress Tracker table at the top — check which phases are done
and which is next. Update the tracker as you complete phases.

Key files to read first:
- docs/SCREENER_IMPLEMENTATION_PLAN.md (this plan — has all specs + progress)
- CLAUDE.md (project conventions)
- packages/types/src/screener.ts (if Phase 1 is done)
- apps/backend/src/services/screener/ (if Phase 3+ is done)
- apps/backend/src/routers/screener.ts (if Phase 8 is done)
- apps/electron/src/renderer/components/Screener/ (if Phase 12+ is done)

Task: Continue implementation from where it was left off. Read the plan,
check the progress tracker, and pick up the next pending phase.
```

---

## Phase 1: Types (`packages/types/src/screener.ts`)

### New file: `packages/types/src/screener.ts`

Define all screener-related types:

```typescript
// Indicator IDs - union of ~30 supported indicator identifiers
type ScreenerIndicatorId =
  | 'RSI' | 'ADX' | 'EMA' | 'SMA' | 'MACD_HISTOGRAM' | 'MACD_SIGNAL'
  | 'BOLLINGER_WIDTH' | 'BOLLINGER_UPPER' | 'BOLLINGER_LOWER'
  | 'ATR' | 'ATR_PERCENT' | 'STOCHASTIC_K' | 'STOCHASTIC_D'
  | 'CCI' | 'MFI' | 'CMF' | 'OBV' | 'VWAP' | 'ROC'
  | 'WILLIAMS_R' | 'CHOPPINESS' | 'TSI' | 'SUPERTREND'
  | 'PRICE_CLOSE' | 'PRICE_CHANGE_24H' | 'PRICE_CHANGE_PERCENT_24H'
  | 'VOLUME_24H' | 'VOLUME_RATIO' | 'MARKET_CAP_RANK'
  | 'BTC_CORRELATION' | 'FUNDING_RATE'

// Operators for filter conditions
type ScreenerOperator = 'ABOVE' | 'BELOW' | 'BETWEEN' | 'CROSSES_ABOVE' | 'CROSSES_BELOW' | 'INCREASING' | 'DECREASING'

// Filter condition
interface ScreenerFilterCondition {
  id: string
  indicator: ScreenerIndicatorId
  indicatorParams?: Record<string, number>
  operator: ScreenerOperator
  value?: number
  valueMax?: number  // for BETWEEN
  compareIndicator?: ScreenerIndicatorId
  compareIndicatorParams?: Record<string, number>
  logicGroup?: string  // conditions with same group are OR-ed, groups are AND-ed
}

// Sort options
type ScreenerSortField = 'symbol' | 'price' | 'priceChange24h' | 'volume24h' | 'marketCapRank' | 'rsi' | 'adx' | 'atrPercent' | 'compositeScore' | 'volumeRatio'

// Main config
interface ScreenerConfig {
  id?: string
  name?: string
  description?: string
  assetClass: 'CRYPTO' | 'STOCKS'
  marketType: 'SPOT' | 'FUTURES'
  exchange?: 'BINANCE' | 'INTERACTIVE_BROKERS'
  interval: TimeInterval  // uses existing TimeInterval type
  filters: ScreenerFilterCondition[]
  sortBy?: ScreenerSortField
  sortDirection?: 'asc' | 'desc'
  limit?: number
  isPreset?: boolean
  presetId?: string
}

// Result row
interface ScreenerResultRow {
  symbol: string
  displayName: string
  price: number
  priceChange24h: number
  priceChangePercent24h: number
  volume24h: number
  quoteVolume24h: number
  marketCapRank: number | null
  indicators: Record<string, number | null>
  matchedFilters: number
  totalFilters: number
  compositeScore: number
}

// Response
interface ScreenerResponse {
  results: ScreenerResultRow[]
  totalSymbolsScanned: number
  totalMatched: number
  executionTimeMs: number
  cachedAt: number | null
  config: ScreenerConfig
}

// Preset
interface ScreenerPreset {
  id: string
  name: string
  description: string
  icon: string
  category: 'momentum' | 'mean_reversion' | 'volatility' | 'volume' | 'trend' | 'market_data'
  assetClassRestriction?: 'CRYPTO' | 'STOCKS'
  exchangeRestriction?: 'BINANCE' | 'INTERACTIVE_BROKERS'
  config: Omit<ScreenerConfig, 'assetClass' | 'marketType' | 'interval'>
}

// Saved screener (for user persistence)
interface SavedScreener {
  id: string
  name: string
  config: ScreenerConfig
  createdAt: string
  updatedAt: string
}

// Indicator metadata (for filter builder UI)
interface IndicatorMeta {
  id: ScreenerIndicatorId
  name: string
  category: 'oscillator' | 'trend' | 'volume' | 'volatility' | 'momentum' | 'price' | 'market_data' | 'crypto'
  defaultParams: Record<string, number>
  paramLabels?: Record<string, string>
  valueRange?: { min: number; max: number }
  requiresKlines: boolean
  assetClassRestriction?: 'CRYPTO' | 'STOCKS'
}
```

### Modify: `packages/types/src/index.ts`

Add `export * from './screener';` at the end.

---

## Phase 2: Backend Constants (`apps/backend/src/constants/screener.ts`)

### New file: `apps/backend/src/constants/screener.ts`

```typescript
export const SCREENER = {
  MAX_SYMBOLS_PER_SCAN: 200,
  DEFAULT_SCAN_LIMIT: 100,
  RESULTS_CACHE_TTL_MS: 120_000,  // 2 min
  MIN_KLINES_REQUIRED: 200,
  DEFAULT_INTERVAL: '4h' as const,
  KLINE_BATCH_SIZE: 10,
  MAX_CONCURRENT_EVALUATIONS: 20,
  RSI_OVERSOLD: 30,
  RSI_OVERBOUGHT: 70,
  VOLUME_SPIKE_MULTIPLIER: 2.0,
  BB_SQUEEZE_THRESHOLD: 0.04,
  ADX_TRENDING: 25,
  BTC_CORRELATION_LOW: 0.3,
  SAVED_SCREENER_MAX: 50,
  PREFERENCES_CATEGORY: 'screener' as const,
  LOOKBACK_BARS_FOR_CROSS: 2,
  LOOKBACK_BARS_FOR_TREND: 5,
} as const;
```

---

## Phase 3: Indicator Evaluator (`apps/backend/src/services/screener/indicator-evaluator.ts`)

### Pattern: Registry mapping `ScreenerIndicatorId` -> compute function

Each function takes `Kline[]` + optional params and returns `number | null`.

**Kline-based indicators** (delegate to `@marketmind/indicators`):
- `RSI` -> `calculateRSI(klines, period).values` -> last non-null
- `ADX` -> `calculateADX(klines, period).adx` -> last non-null
- `EMA` -> `calculateEMA(klines, period)` -> last non-null
- `SMA` -> `calculateSMA(klines, period)` -> last non-null
- `MACD_HISTOGRAM` -> `calculateMACD(klines).histogram` -> last non-null
- `MACD_SIGNAL` -> `calculateMACD(klines).signal` -> last non-null
- `BOLLINGER_WIDTH` -> `calculateBollingerBands(klines, period)` -> (upper - lower) / middle
- `BOLLINGER_UPPER/LOWER` -> from `calculateBollingerBands`
- `ATR` -> `calculateATR(klines, period)` -> last non-null
- `ATR_PERCENT` -> ATR / close * 100
- `STOCHASTIC_K/D` -> `calculateStochastic(klines, period)`
- `CCI` -> `calculateCCI(klines, period)` -> last non-null
- `MFI` -> `calculateMFI(klines, period)` -> last non-null
- `CMF` -> `calculateCMF(klines, period)` -> last non-null
- `OBV` -> `calculateOBV(klines)` -> last value
- `VWAP` -> `calculateVWAP(klines)` -> last non-null
- `ROC` -> `calculateROC(klines, period)` -> last non-null
- `WILLIAMS_R` -> `calculateWilliamsR(klines, period)` -> last non-null
- `CHOPPINESS` -> `calculateChoppiness(klines, period)` -> last non-null
- `TSI` -> `calculateTSI(klines)` -> last non-null
- `SUPERTREND` -> `calculateSupertrend(klines)` -> last value (numeric)
- `PRICE_CLOSE` -> last kline close price

**Ticker-based indicators** (use `Ticker24hr` or `TopCoin` data):
- `PRICE_CHANGE_24H` -> `ticker.priceChange`
- `PRICE_CHANGE_PERCENT_24H` -> `ticker.priceChangePercent`
- `VOLUME_24H` -> `ticker.volume`
- `VOLUME_RATIO` -> current volume / avg volume (needs klines too)
- `MARKET_CAP_RANK` -> from `TopCoin.marketCapRank`

**Special indicators** (need external data):
- `BTC_CORRELATION` -> correlation between asset and BTCUSDT returns over N bars
- `FUNDING_RATE` -> from cached funding rate data

### Key design decisions:
- `evaluateIndicator(id, klines, params?, tickerData?, extraData?) -> number | null`
- `evaluateIndicators(ids[], klines, params, tickerData, extraData) -> Record<string, number | null>` (batch)
- `getPreviousValue(id, klines, barsBack, params?) -> number | null` (for CROSSES_ABOVE/BELOW)

---

## Phase 4: Filter Evaluator (`apps/backend/src/services/screener/filter-evaluator.ts`)

Evaluates a single `ScreenerFilterCondition` against computed indicator values.

```typescript
interface FilterEvalResult {
  passed: boolean
  actualValue: number | null
}

evaluateFilter(condition, indicatorValues, previousValues?) -> FilterEvalResult
```

**Operator logic:**
- `ABOVE`: value > threshold (or value > compareIndicatorValue)
- `BELOW`: value < threshold
- `BETWEEN`: value >= min && value <= max
- `CROSSES_ABOVE`: current > threshold && previous <= threshold
- `CROSSES_BELOW`: current < threshold && previous >= threshold
- `INCREASING`: current > valueNBarsAgo
- `DECREASING`: current < valueNBarsAgo

**Logic groups:**
- Conditions with same `logicGroup` are OR-ed
- Different groups (and ungrouped conditions) are AND-ed
- `evaluateFilters(conditions[], values, prevValues?) -> { passed, matchedCount, totalCount }`

---

## Phase 5: Indicator Metadata (`apps/backend/src/services/screener/indicator-metadata.ts`)

Catalog of all available indicators for the frontend filter builder:

```typescript
const INDICATOR_CATALOG: IndicatorMeta[] = [
  { id: 'RSI', name: 'RSI', category: 'oscillator', defaultParams: { period: 14 }, valueRange: { min: 0, max: 100 }, requiresKlines: true },
  { id: 'ADX', name: 'ADX', category: 'trend', defaultParams: { period: 14 }, valueRange: { min: 0, max: 100 }, requiresKlines: true },
  { id: 'EMA', name: 'EMA', category: 'trend', defaultParams: { period: 21 }, requiresKlines: true },
  { id: 'SMA', name: 'SMA', category: 'trend', defaultParams: { period: 20 }, requiresKlines: true },
  // ... ~30 entries total
  { id: 'BTC_CORRELATION', name: 'BTC Correlation', category: 'crypto', defaultParams: { period: 30 }, valueRange: { min: -1, max: 1 }, requiresKlines: true, assetClassRestriction: 'CRYPTO' },
  { id: 'FUNDING_RATE', name: 'Funding Rate', category: 'crypto', defaultParams: {}, requiresKlines: false, assetClassRestriction: 'CRYPTO' },
]

getIndicatorCatalog(assetClass?) -> IndicatorMeta[]
```

---

## Phase 6: Presets (`apps/backend/src/services/screener/presets.ts`)

10 preset definitions:

| # | Preset | Key Filters | Sort | Restriction |
|---|--------|-------------|------|-------------|
| 1 | Top Gainers | PRICE_CHANGE_PERCENT_24H > 5, MARKET_CAP_RANK < 100 | priceChange24h desc | None |
| 2 | Top Losers | PRICE_CHANGE_PERCENT_24H < -5, MARKET_CAP_RANK < 100 | priceChange24h asc | None |
| 3 | BTC Decorrelated | BTC_CORRELATION < 0.3, PRICE_CHANGE_PERCENT_24H > 0 | compositeScore desc | CRYPTO |
| 4 | Oversold in Uptrend | RSI(14) < 30, PRICE_CLOSE > EMA(50), PRICE_CLOSE > EMA(200) | rsi asc | None |
| 5 | Overbought in Downtrend | RSI(14) > 70, PRICE_CLOSE < EMA(50), PRICE_CLOSE < EMA(200) | rsi desc | None |
| 6 | Momentum Leaders | RSI > 55, RSI < 80, ADX > 25, VOLUME_RATIO > 1.2 | adx desc | None |
| 7 | Volume Spike | VOLUME_RATIO > 2.0, MARKET_CAP_RANK < 150 | volumeRatio desc | None |
| 8 | Breakout Candidates | BOLLINGER_WIDTH < 0.04, VOLUME_RATIO > 1.0, ADX < 20 | compositeScore desc | None |
| 9 | Mean Reversion | RSI < 25 OR RSI > 75 (logicGroup), ATR_PERCENT > 2 | rsi asc | None |
| 10 | High Volatility | ATR_PERCENT > 3, VOLUME_RATIO > 1.5, ADX > 20 | atrPercent desc | None |

Each preset is a `ScreenerPreset` object with `id`, `name`, `description`, `icon`, `category`, optional restrictions, and a partial `config` (filters + sortBy + sortDirection).

---

## Phase 7: Screener Service (`apps/backend/src/services/screener/screener-service.ts`)

Main orchestrator class (singleton pattern like `MarketCapDataService`).

### `runScreener(config: ScreenerConfig)` flow:

1. **Cache check** — hash config, check `Map<string, { response, timestamp }>`, return if within TTL
2. **Get candidate symbols:**
   - Crypto: `MarketCapDataService.getTopCoinsByMarketCap(limit, marketType)` -> symbol list + TopCoin data
   - Stocks: IB symbol list (if available) or skip
3. **Get ticker data:** `Ticker24hrCache.getForSymbols(symbols, marketType)` -> Map<symbol, Ticker24hr>
4. **Pre-filter with ticker-based conditions** (cheap): price change, volume, market cap rank
   - Only conditions whose indicator `requiresKlines === false` can be pre-filtered
5. **Fetch klines on-demand** for remaining symbols:
   - Use `smartBackfillKlines(symbol, interval, MIN_KLINES_REQUIRED, marketType)` for Binance
   - Use `smartBackfillIBKlines(symbol, interval, MIN_KLINES_REQUIRED)` for IB
   - Batch with `p-limit(KLINE_BATCH_SIZE)` concurrency
   - After backfill, query DB for klines and convert with `mapDbKlinesToApi()`
6. **Compute indicators** via `IndicatorEvaluator` for each symbol
7. **Evaluate filters** via `FilterEvaluator` (with OR-group support)
8. **Build result rows** with indicator values + match counts + composite score
9. **Sort** by `sortBy` field, apply `limit`
10. **Cache** result, return `ScreenerResponse`

### Dependencies to import:
- `getMarketCapDataService()` from `../market-cap-data`
- `getTicker24hrCache()` from `../binance-exchange-info`
- `smartBackfillKlines` from `../binance-historical`
- `smartBackfillIBKlines` from `../ib-historical`
- `mapDbKlinesToApi` from `../../utils/kline-mapper`
- DB access for kline query after backfill
- `IndicatorEvaluator` and `FilterEvaluator` (local)

### Kline retrieval after backfill:
After `smartBackfillKlines` ensures data is in DB, query klines from DB:
```typescript
const dbKlines = await db.query.klines.findMany({
  where: and(
    eq(klines.symbol, symbol),
    eq(klines.interval, interval),
  ),
  orderBy: [desc(klines.openTime)],
  limit: MIN_KLINES_REQUIRED,
});
const apiKlines = mapDbKlinesToApi(dbKlines).reverse();
```

### Singleton pattern:
```typescript
let instance: ScreenerService | null = null;
export const getScreenerService = (db: DbType): ScreenerService => {
  if (!instance) instance = new ScreenerService(db);
  return instance;
};
```

---

## Phase 8: tRPC Router (`apps/backend/src/routers/screener.ts`)

### Endpoints:

```typescript
screener.run — protectedProcedure
  .input(screenerConfigSchema)  // Zod schema matching ScreenerConfig
  .query(async ({ ctx, input }) => {
    const service = getScreenerService(ctx.db);
    return service.runScreener(input);
  })

screener.runPreset — protectedProcedure
  .input(z.object({ presetId: z.string(), assetClass, marketType, interval, overrides? }))
  .query(async ({ ctx, input }) => {
    // Find preset by id, merge with overrides, run
  })

screener.getPresets — protectedProcedure
  .input(z.object({ assetClass: z.enum(['CRYPTO', 'STOCKS']).optional() }).optional())
  .query(() => {
    // Return filtered presets
  })

screener.getAvailableIndicators — protectedProcedure
  .input(z.object({ assetClass: z.enum(['CRYPTO', 'STOCKS']).optional() }).optional())
  .query(() => {
    // Return filtered indicator catalog
  })

screener.saveScreener — protectedProcedure
  .input(z.object({ name: z.string(), config: screenerConfigSchema }))
  .mutation(async ({ ctx, input }) => {
    // Store in userPreferences table with category 'screener'
    // Key: 'saved_<uuid>'
    // Value: JSON.stringify({ name, config, createdAt, updatedAt })
  })

screener.getSavedScreeners — protectedProcedure
  .query(async ({ ctx }) => {
    // Get all preferences with category 'screener'
    // Parse and return as SavedScreener[]
  })

screener.deleteScreener — protectedProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // Delete from userPreferences
  })
```

### Register in `apps/backend/src/trpc/router.ts`:
- Import `screenerRouter` from `../routers/screener`
- Add `screener: screenerRouter` to the router object

### Note on preferences category:
Need to add `'screener'` to the `categorySchema` in `preferences.ts` OR use the screener router directly with its own DB queries against the `userPreferences` table.

**Decision:** Create a standalone screener router with its own DB queries (cleaner separation, avoids modifying existing preferences schema).

---

## Phase 9: Backend Tests

### New file: `apps/backend/src/__tests__/services/screener/indicator-evaluator.test.ts`

Test each indicator evaluation function with sample kline data:
- RSI returns value 0-100
- ADX returns value 0-100
- EMA returns numeric value
- Handles empty klines gracefully (returns null)
- Handles insufficient data (returns null)
- Ticker-based indicators work with Ticker24hr data

### New file: `apps/backend/src/__tests__/services/screener/filter-evaluator.test.ts`

- ABOVE/BELOW/BETWEEN operators
- CROSSES_ABOVE/CROSSES_BELOW with previous values
- INCREASING/DECREASING with lookback
- Logic group OR-ing
- Mixed grouped and ungrouped conditions AND-ed

### New file: `apps/backend/src/__tests__/services/screener/screener-service.test.ts`

- Mock external dependencies (market cap service, ticker cache, backfill functions)
- Test cache hit/miss
- Test pre-filtering with ticker data
- Test full flow with mocked kline data
- Test preset resolution

---

## Phase 10: Screener Store (`apps/electron/src/renderer/store/screenerStore.ts`)

### Pattern: Same as `uiStore.ts` with Zustand + persist

```typescript
interface ScreenerState {
  isScreenerOpen: boolean
  activePresetId: string | null
  customFilters: ScreenerFilterCondition[]
  assetClass: 'CRYPTO' | 'STOCKS'
  marketType: 'SPOT' | 'FUTURES'
  interval: TimeInterval
  sortBy: ScreenerSortField
  sortDirection: 'asc' | 'desc'

  toggleScreener: () => void
  openScreener: () => void
  closeScreener: () => void
  setActivePresetId: (id: string | null) => void
  setCustomFilters: (filters: ScreenerFilterCondition[]) => void
  addFilter: (filter: ScreenerFilterCondition) => void
  removeFilter: (filterId: string) => void
  updateFilter: (filterId: string, updates: Partial<ScreenerFilterCondition>) => void
  clearFilters: () => void
  setAssetClass: (assetClass: 'CRYPTO' | 'STOCKS') => void
  setMarketType: (marketType: 'SPOT' | 'FUTURES') => void
  setInterval: (interval: TimeInterval) => void
  setSortBy: (field: ScreenerSortField) => void
  setSortDirection: (dir: 'asc' | 'desc') => void
}
```

Persist: `assetClass`, `marketType`, `interval`, `sortBy`, `sortDirection`, `activePresetId`.

---

## Phase 11: useScreener Hook (`apps/electron/src/renderer/hooks/useScreener.ts`)

```typescript
const useScreener = () => {
  // Read store state
  // Build ScreenerConfig from store
  // Conditionally use trpc.screener.runPreset.useQuery or trpc.screener.run.useQuery
  // trpc.screener.getPresets.useQuery
  // trpc.screener.getAvailableIndicators.useQuery
  // trpc.screener.getSavedScreeners.useQuery
  // Save/delete mutations
  // Return: results, isLoading, error, presets, indicators, savedScreeners, save, delete, refetch
}
```

Uses `trpc.<router>.<procedure>.useQuery()` pattern from `useBackendWallet.ts`.

---

## Phase 12-17: Frontend Components

### File structure:
```
apps/electron/src/renderer/components/Screener/
  index.ts                    — barrel export
  ScreenerModal.tsx           — main modal container
  PresetBar.tsx               — horizontal scrollable preset buttons
  FilterBuilder.tsx           — custom filter builder (collapsible)
  FilterRow.tsx               — single filter row in builder
  FilterChip.tsx              — active filter badge with remove
  ScreenerResultsTable.tsx    — results table
  SaveScreenerDialog.tsx      — save dialog
  SavedScreenersList.tsx      — dropdown of saved screeners
```

### ScreenerModal.tsx
- Uses Chakra UI `Dialog.Root` / `Dialog.Content` (same pattern as `SettingsDialog`)
- `maxW="1200px"`, `maxH="90vh"`
- Header: title + AssetClass toggle + MarketType toggle + Interval selector
- Body: `PresetBar` → `FilterBuilder` (collapsible) → `FilterChip` list → `ScreenerResultsTable`
- Footer: result count, execution time, Save button
- Controlled by `screenerStore.isScreenerOpen`

### PresetBar.tsx
- Horizontal scrollable `HStack` of preset buttons
- Filtered by current `assetClass` and `exchange`
- Selected preset highlighted (blue solid vs gray outline)
- Click loads preset config into store filters and triggers query

### FilterBuilder.tsx + FilterRow.tsx
- "Add Filter" button creates a new `FilterRow`
- Each `FilterRow`: Indicator select (grouped by category) → Params → Operator select → Value input(s)
- Max 10 filters
- Indicators filtered by current `assetClass`

### FilterChip.tsx
- Badge rendering: "RSI < 30", "Price > EMA(50)"
- Close button to remove filter
- "Clear All" button

### ScreenerResultsTable.tsx
- Columns: Symbol (sticky), Price, 24h% (color-coded green/red), Volume, Mkt Cap Rank, RSI, ADX, Score
- Sortable column headers (click to sort)
- Click row → call `onSymbolChange` to navigate chart to that symbol
- Loading state with Skeleton rows
- Empty state with message

### SaveScreenerDialog.tsx
- Small dialog with name input
- Calls `trpc.screener.saveScreener.useMutation()`

### SavedScreenersList.tsx
- Dropdown/popover with saved screeners list
- Load button -> applies saved config to store
- Delete button -> removes saved screener

---

## Phase 18: Toolbar & MainLayout Integration

### Toolbar.tsx changes:
- Import `LuScanLine` from `react-icons/lu`
- Import `useScreenerStore` (just `toggleScreener` and `isScreenerOpen`)
- Add screener button in the sidebar buttons `HStack` (between market sidebar and trading sidebar buttons):
```tsx
<TooltipWrapper label={t('screener.title')} showArrow>
  <IconButton
    size="2xs"
    aria-label={t('screener.title')}
    onClick={toggleScreener}
    colorPalette={isScreenerOpen ? 'blue' : 'gray'}
    variant={isScreenerOpen ? 'solid' : 'ghost'}
  >
    <LuScanLine />
  </IconButton>
</TooltipWrapper>
```

### MainLayout.tsx changes:
- Import `ScreenerModal` from `../Screener`
- Add `<ScreenerModal onSymbolChange={onSymbolChange} />` alongside `<SettingsDialog />`

---

## Phase 19: i18n

### Add `screener` namespace to all 4 translation files:

**EN keys (`apps/electron/src/renderer/locales/en/translation.json`):**
```json
"screener": {
  "title": "Market Screener",
  "description": "Scan the market for opportunities",
  "run": "Run Scan",
  "refresh": "Refresh",
  "running": "Scanning...",
  "results": "{{count}} results",
  "scanned": "Scanned {{count}} symbols in {{time}}ms",
  "noResults": "No symbols match your criteria",
  "noFilters": "Select a preset or add custom filters to start scanning",
  "maxFilters": "Maximum {{max}} filters allowed",
  "save": "Save Screener",
  "saved": "Saved Screeners",
  "savedName": "Screener Name",
  "deleteSaved": "Delete Saved Screener",
  "loadSaved": "Load",
  "clearAll": "Clear All",
  "addFilter": "Add Filter",
  "removeFilter": "Remove",
  "indicator": "Indicator",
  "operator": "Operator",
  "value": "Value",
  "period": "Period",
  "params": "Parameters",
  "presets": "Presets",
  "customFilters": "Custom Filters",
  "assetClass": "Asset Class",
  "interval": "Interval",
  "sortBy": "Sort By",
  "columns": {
    "symbol": "Symbol",
    "price": "Price",
    "change24h": "24h %",
    "volume": "Volume",
    "marketCap": "Mkt Cap Rank",
    "rsi": "RSI",
    "adx": "ADX",
    "score": "Score"
  },
  "operators": {
    "ABOVE": "Above",
    "BELOW": "Below",
    "BETWEEN": "Between",
    "CROSSES_ABOVE": "Crosses Above",
    "CROSSES_BELOW": "Crosses Below",
    "INCREASING": "Increasing",
    "DECREASING": "Decreasing"
  },
  "categories": {
    "oscillator": "Oscillators",
    "trend": "Trend",
    "volume": "Volume",
    "volatility": "Volatility",
    "momentum": "Momentum",
    "price": "Price",
    "market_data": "Market Data",
    "crypto": "Crypto"
  },
  "presetNames": {
    "top-gainers": "Top Gainers",
    "top-losers": "Top Losers",
    "btc-decorrelated": "BTC Decorrelated",
    "oversold-uptrend": "Oversold in Uptrend",
    "overbought-downtrend": "Overbought in Downtrend",
    "momentum-leaders": "Momentum Leaders",
    "volume-spike": "Volume Spike",
    "breakout-candidates": "Breakout Candidates",
    "mean-reversion": "Mean Reversion",
    "high-volatility": "High Volatility"
  },
  "presetDescriptions": {
    "top-gainers": "Top gaining assets by 24h price change",
    "top-losers": "Worst performing assets by 24h price change",
    "btc-decorrelated": "Assets with low Bitcoin correlation and positive momentum",
    "oversold-uptrend": "Oversold RSI in assets above long-term moving averages",
    "overbought-downtrend": "Overbought RSI in assets below long-term moving averages",
    "momentum-leaders": "Strong trend with volume confirmation",
    "volume-spike": "Unusual volume activity in top market cap assets",
    "breakout-candidates": "Tight Bollinger Bands squeeze with low ADX",
    "mean-reversion": "Extreme RSI readings with high volatility",
    "high-volatility": "High ATR with volume and trend confirmation"
  }
}
```

Similar structure for PT, ES, FR with translated values.

---

## Phase 20: Verification

### Automated checks:
- `pnpm --filter @marketmind/backend test` — all existing + new screener tests pass
- `pnpm --filter @marketmind/backend type-check` — no TS errors
- `pnpm --filter @marketmind/electron type-check` — no TS errors
- `pnpm --filter @marketmind/electron lint` — no new lint errors (existing 1984+ warnings OK)

### Manual tests:
1. Open screener modal via toolbar button
2. Run a preset (Top Gainers) — verify results load
3. Switch asset class to STOCKS — verify crypto-only presets hidden
4. Add custom filter (RSI < 30) — verify evaluation
5. Save a screener, reload, verify it persists
6. Click result row — verify chart navigates to that symbol
7. Test FUTURES market type toggle
8. Test interval change (1h, 4h, 1d)

---

## Implementation Order Summary

| Step | What | New files | Modified files |
|------|------|-----------|----------------|
| 1 | Types | `packages/types/src/screener.ts` | `packages/types/src/index.ts` |
| 2 | Constants | `apps/backend/src/constants/screener.ts` | — |
| 3 | Indicator Evaluator | `apps/backend/src/services/screener/indicator-evaluator.ts` | — |
| 4 | Filter Evaluator | `apps/backend/src/services/screener/filter-evaluator.ts` | — |
| 5 | Indicator Metadata | `apps/backend/src/services/screener/indicator-metadata.ts` | — |
| 6 | Presets | `apps/backend/src/services/screener/presets.ts` | — |
| 7 | Screener Service | `apps/backend/src/services/screener/screener-service.ts`, `index.ts` | — |
| 8 | tRPC Router | `apps/backend/src/routers/screener.ts` | `apps/backend/src/trpc/router.ts` |
| 9 | Backend Tests | `apps/backend/src/__tests__/services/screener/*.test.ts` | — |
| 10 | Screener Store | `apps/electron/src/renderer/store/screenerStore.ts` | — |
| 11 | useScreener Hook | `apps/electron/src/renderer/hooks/useScreener.ts` | — |
| 12-17 | Components | `apps/electron/src/renderer/components/Screener/*.tsx` | — |
| 18 | Integration | — | `Toolbar.tsx`, `MainLayout.tsx` |
| 19 | i18n | — | `en/translation.json`, `pt/...`, `es/...`, `fr/...` |
| 20 | Verify | — | — |

---

## Risk Mitigations

- **Performance**: Kline fetching is the bottleneck. `smartBackfillKlines` handles DB caching so subsequent scans are fast. Batch concurrency limited to 10.
- **Rate limits**: Binance API rate limits handled by existing backfill logic with built-in retry/throttle.
- **Type safety**: All types in `@marketmind/types`, Zod validation on tRPC inputs.
- **Backward compat**: No existing code modified except adding a new router registration and new toolbar button. Preferences use separate 'screener' category.
