# PLAN-04: Backend Caching & Query Optimization

## Context
The backend has several hot paths that hit disk or database unnecessarily. The strategy loader reads 105 JSON files from disk on every request. Custom symbol queries use N+1 patterns. Portfolio pricing makes sequential per-asset API calls. Missing compound indexes slow down analytics queries. These all contribute to higher response times and CPU usage.

## Branch
`perf/backend-caching`

---

## 1. Strategy loader singleton cache

### File: `apps/backend/src/services/setup-detection/dynamic/StrategyLoader.ts`

### Current behavior
- `loadAll()` at line 44 calls `this.strategies.clear()` every time
- Then reads every `.json` file from disk, parses JSON, validates
- Called from 6 endpoints in `setup-detection.ts` + `signal-processor.ts` on every watcher cycle

### Solution: In-memory cache with directory-level invalidation

```typescript
export class StrategyLoader {
  private strategies: Map<string, StrategyFile> = new Map();
  private strategyPaths: string[];
  private watchHandlers: fs.FSWatcher[] = [];
  private cachedDefinitions: StrategyDefinition[] | null = null;
  private cacheTimestamp = 0;
  private dirMtimeCache = new Map<string, number>();

  async loadAll(options: StrategyLoadOptions = {}): Promise<StrategyDefinition[]> {
    // Full reload — clears cache
    this.cachedDefinitions = null;
    this.strategies.clear();
    // ... existing logic ...
    this.cachedDefinitions = definitions;
    this.cacheTimestamp = Date.now();
    return definitions;
  }

  async loadAllCached(options: StrategyLoadOptions = {}): Promise<StrategyDefinition[]> {
    if (this.cachedDefinitions && !this.hasDirectoryChanged()) {
      return this.filterDefinitions(this.cachedDefinitions, options);
    }
    return this.loadAll(options);
  }

  private hasDirectoryChanged(): boolean {
    for (const basePath of this.strategyPaths) {
      try {
        const stat = fs.statSync(basePath);
        const cached = this.dirMtimeCache.get(basePath);
        if (!cached || stat.mtimeMs !== cached) {
          this.dirMtimeCache.set(basePath, stat.mtimeMs);
          return true;
        }
      } catch {
        return true;
      }
    }
    return false;
  }

  private filterDefinitions(defs: StrategyDefinition[], options: StrategyLoadOptions): StrategyDefinition[] {
    return defs.filter(d => this.shouldIncludeStrategy(d, options));
  }
}
```

### Usage updates

**File: `apps/backend/src/services/auto-trading/signal-processor.ts`**
Line 262: Change `this.strategyLoader.loadAll(...)` to `this.strategyLoader.loadAllCached(...)`

**File: `apps/backend/src/routers/setup-detection.ts`**
All 6 endpoints: Change `strategyLoader.loadAll(...)` to `strategyLoader.loadAllCached(...)` for read-only endpoints (`listStrategies`, `getStrategyDetails`, `detectSetups`, etc.)

Keep `loadAll()` (full reload) only for admin/reload endpoints if they exist.

---

## 2. Custom symbol N+1 query fix

### File: `apps/backend/src/routers/custom-symbol.ts`

### Current (lines 50-70):
```typescript
const symbols = await db.query.customSymbols.findMany({
  where: eq(customSymbols.isActive, true),
});

return Promise.all(
  symbols.map(async (cs) => {
    const components = await db.query.customSymbolComponents.findMany({
      where: and(
        eq(customSymbolComponents.customSymbolId, cs.id),
        eq(customSymbolComponents.isActive, true),
      ),
    });
    return { ...cs, components };
  })
);
```

### Solution: Use Drizzle relations query

First, verify relations are defined in schema. If not, add:

**File: `apps/backend/src/db/schema.ts`**
```typescript
export const customSymbolsRelations = relations(customSymbols, ({ many }) => ({
  components: many(customSymbolComponents),
}));

export const customSymbolComponentsRelations = relations(customSymbolComponents, ({ one }) => ({
  customSymbol: one(customSymbols, {
    fields: [customSymbolComponents.customSymbolId],
    references: [customSymbols.id],
  }),
}));
```

Then replace the N+1 query:
```typescript
const symbols = await db.query.customSymbols.findMany({
  where: eq(customSymbols.isActive, true),
  with: {
    components: {
      where: eq(customSymbolComponents.isActive, true),
    },
  },
});
return symbols;
```

This generates a single SQL query with JOIN instead of N+1 queries.

---

## 3. Portfolio asset pricing batch API

### File: `apps/backend/src/routers/wallet.ts`

### Current (lines 569-612):
Sequential per-asset price lookups — each asset calls `get24hrChangeStatistics(symbol)` individually. For a portfolio with 20 assets, this makes 20+ sequential Binance API calls.

### Solution: Batch price fetch

```typescript
// Fetch all ticker prices in one call
const allTickers = await client.getSymbolPriceTicker();
const tickerMap = new Map<string, number>();
for (const ticker of Array.isArray(allTickers) ? allTickers : [allTickers]) {
  tickerMap.set(ticker.symbol, parseFloat(ticker.price));
}

// Then for each asset, look up from map instead of API call
const resolvePrice = (asset: string): number | null => {
  const usdtPrice = tickerMap.get(`${asset}USDT`);
  if (usdtPrice) return usdtPrice;

  const btcPrice = tickerMap.get(`${asset}BTC`);
  const btcUsdt = tickerMap.get('BTCUSDT');
  if (btcPrice && btcUsdt) return btcPrice * btcUsdt;

  return null;
};
```

### Impact
- 1 API call instead of 20+
- `getSymbolPriceTicker()` returns all ~2000 symbols in ~100ms
- Portfolio load time: from 5-10s to <500ms

### Caveat
- `getSymbolPriceTicker()` returns price only (no 24h change data)
- If 24h change is needed in the portfolio view, use `get24hrTicker()` (also supports batch/all mode)
- Check which fields the frontend actually uses from the portfolio endpoint

---

## 4. Add compound database indexes

### File: `apps/backend/src/db/schema.ts`

### Missing indexes for hot query patterns

```typescript
// In tradeExecutions table definition, add:
export const tradeExecutionsWalletStatusIdx = index('trade_executions_wallet_status_idx')
  .on(tradeExecutions.walletId, tradeExecutions.status);

export const tradeExecutionsWalletClosedIdx = index('trade_executions_wallet_closed_idx')
  .on(tradeExecutions.walletId, tradeExecutions.status, tradeExecutions.closedAt);

// In customSymbolComponents table definition, add:
export const customSymbolComponentsActiveIdx = index('custom_symbol_components_active_idx')
  .on(customSymbolComponents.customSymbolId, customSymbolComponents.isActive);
```

### Migration
```bash
cd apps/backend
pnpm db:generate  # Generates migration file
pnpm db:migrate   # Applies migration
```

### Which queries benefit
- `tradeExecutions_wallet_status_idx`: Used by `handleOrderUpdate` (user stream), `getTradeExecutions` (router), `getPositions` (router)
- `tradeExecutions_wallet_closed_idx`: Used by `analytics.getPerformance`, `analytics.getEquityCurve`
- `custom_symbol_components_active_idx`: Used by custom symbol list (after N+1 fix, the JOIN benefits from this index)

---

## 5. Kline mapper deduplication

### File: `apps/backend/src/services/auto-trading-scheduler.ts`

### Current (lines ~260-274, ~298-312):
Duplicated kline mapping logic:
```typescript
const mappedKlines: Kline[] = btcKlines.reverse().map((k) => ({
  symbol: k.symbol,
  interval: k.interval as Interval,
  openTime: k.openTime.getTime(),
  // ... 6 more fields
}));
```

### Solution:
Import and use the existing `mapDbKlinesToApi` from `apps/backend/src/utils/kline-mapper.ts`:

```typescript
import { mapDbKlinesToApi } from '../utils/kline-mapper';

// Replace duplicated mapping:
const mappedKlines = mapDbKlinesToApi(btcKlines.reverse());
```

Apply to all locations in `auto-trading-scheduler.ts` that manually map DB klines.

---

## Verification

```bash
# Backend tests
pnpm --filter @marketmind/backend test

# Type check
pnpm --filter @marketmind/backend type-check

# Generate and apply migration
cd apps/backend && pnpm db:generate && pnpm db:migrate

# Manual verification:
# 1. Start backend, load strategies list — should be fast on 2nd call
# 2. Load portfolio with 10+ assets — should complete in <500ms
# 3. Check custom symbols list — verify single query in DB logs
# 4. Run EXPLAIN ANALYZE on trade_executions queries to verify index usage
```

## Files Modified
- `apps/backend/src/services/setup-detection/dynamic/StrategyLoader.ts` (cache)
- `apps/backend/src/services/auto-trading/signal-processor.ts` (use cached loader)
- `apps/backend/src/routers/setup-detection.ts` (use cached loader)
- `apps/backend/src/routers/custom-symbol.ts` (N+1 fix)
- `apps/backend/src/routers/wallet.ts` (batch pricing)
- `apps/backend/src/db/schema.ts` (indexes + relations)
- `apps/backend/src/services/auto-trading-scheduler.ts` (kline mapper dedup)
