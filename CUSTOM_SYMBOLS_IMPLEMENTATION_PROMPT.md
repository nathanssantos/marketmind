# Custom Symbols (Indices) — Full Implementation Prompt

## Project: MarketMind
**Repo:** `/Users/nathan/Documents/dev/marketmind`
**Current branch:** `develop`
**Create a new branch:** `feature/custom-symbols`

---

## What To Build

A **Custom Symbols** system that allows creating composite "index" symbols (like stock market indices) from weighted baskets of real trading pairs. Custom symbols are first-class citizens in the app — they work exactly like BTCUSDT in every part of the system: chart, indicators, backtesting, screener, setup detection, strategy filters.

The first index to seed at startup is **POLITIFI** (Political Token Index) — a basket of Binance-listed PolitiFi tokens, automatically weighted by capped market cap.

---

## Requirements

1. Custom symbols stored in DB, served through existing kline pipeline (no chart changes needed)
2. Real-time price: computed from weighted component prices, emitted to WebSocket just like any real symbol
3. Historical klines: computed from component klines and stored in `klines` table with `symbol = 'POLITIFI'`
4. **Weights calculated dynamically** from CoinGecko market cap API — no hardcoded numbers
5. Weighting methods: `EQUAL | MARKET_CAP | CAPPED_MARKET_CAP | SQRT_MARKET_CAP | MANUAL`
6. Full CRUD via modal: **create, edit, delete** custom symbols
7. Symbol selector: "Custom Symbols" group
8. Toolbar button: next to Analytics (LuChartBar icon), opens the Custom Symbols modal
9. POLITIFI seeded at service startup (idempotent) using live market cap data for weights
10. Backtesting with POLITIFI works via integration in `kline-fetcher.ts`
11. All user-facing strings internationalized (en/es/fr/pt)

---

## Research: PolitiFi Token Universe

**Category:** PolitiFi (Political Finance) — category on CoinGecko, CoinMarketCap, Gate.com

**Confirmed Binance SPOT pairs for POLITIFI seed (all USDT):**

| Binance Pair    | Token Name               | CoinGecko ID                   | Market Cap (approx) | Notes                          |
|-----------------|--------------------------|--------------------------------|---------------------|--------------------------------|
| WLFIUSDT        | World Liberty Financial  | world-liberty-financial        | ~$3.1B              | Trump DeFi project, listed on Binance SPOT Sep 2025 |
| TRUMPUSDT       | Official Trump           | official-trump                 | ~$3.4B peak         | Solana-based, Binance SPOT     |
| MELANIAUSDT     | Official Melania Meme    | official-melania-meme          | ~$550M peak         | Binance perpetual confirmed; check if SPOT exists, else use FUTURES |
| PEOPLEUSDT      | ConstitutionDAO          | constitutiondao                | ~$353M              | Binance SPOT confirmed         |
| PNUTUSDT        | Peanut the Squirrel      | peanut-the-squirrel            | ~$209M              | Binance SPOT confirmed; in PolitiFi category on CoinGecko |

**Note on MELANIA:** Binance launched MELANIAUSDT Perpetual Contract with 25x leverage. Check if SPOT pair also exists. If not: use `marketType: 'FUTURES'` for that component.

**Initial POLITIFI composition** (weights will be computed dynamically from market cap at startup, NOT hardcoded — these are just the components to register):
- WLFIUSDT, TRUMPUSDT, MELANIAUSDT, PEOPLEUSDT, PNUTUSDT
- Method: `CAPPED_MARKET_CAP` with 40% cap per constituent

---

## Architecture: Key Insight

**Store synthetic klines in the existing `klines` table with `symbol = 'POLITIFI'`.**

This means: chart rendering, indicators, backtesting, screener, setup detection, strategy filters — ALL work automatically with zero changes to those systems.

**Index formula:**
```
index_price = base_value × Σ(weight_i × current_price_i / base_price_i)
```
- `base_value = 100` (configurable per index)
- `base_price_i` = price of component at index creation time (locked in DB)
- `weight_i` = dynamically computed weight (sums to 1.0)

**OHLCV per kline interval:**
```
open/high/low/close = base_value × Σ(weight_i × kline_field_i / base_price_i)
volume = Σ(weight_i × kline_quoteVolume_i)   # weighted USD volume
```

**Real-time flow:**
```
Binance price streams (WLFIUSDT, TRUMPUSDT, etc.)
    ↓ CustomSymbolService.onComponentPriceUpdate()
    ↓ computes POLITIFI price
wsService.emitPriceUpdate('POLITIFI', price, ts)      → rooms: prices:POLITIFI
wsService.emitKlineUpdate({ symbol: 'POLITIFI', ...}) → rooms: klines:POLITIFI:1h
    ↓ (when candle closes) persisted to klines table
kline.list({ symbol: 'POLITIFI', interval: '1h' })    → identical to BTCUSDT
```

**Only 2 integration points** need explicit custom-symbol handling:
1. `kline-prefetch.ts` — skip Binance API, call `customSymbolService.backfillKlines()` instead
2. `kline-fetcher.ts` (backtesting) — same: add a third branch for custom symbols

---

## Database Schema

Add to `apps/backend/src/db/schema.ts`:

```typescript
export const customSymbols = pgTable('custom_symbols', {
  id: serial('id').primaryKey(),
  symbol: varchar({ length: 30 }).unique().notNull(),        // 'POLITIFI'
  name: varchar({ length: 100 }).notNull(),                  // 'Political Token Index'
  description: text(),
  category: varchar({ length: 50 }).notNull(),               // 'politics' | 'defi' | 'gaming' | 'ai' | 'other'
  baseValue: numeric('base_value', { precision: 20, scale: 8 }).notNull().default('100'),
  weightingMethod: varchar('weighting_method', { length: 30 })
    .$type<'EQUAL' | 'MARKET_CAP' | 'CAPPED_MARKET_CAP' | 'SQRT_MARKET_CAP' | 'MANUAL'>()
    .notNull().default('CAPPED_MARKET_CAP'),
  capPercent: numeric('cap_percent', { precision: 5, scale: 2 }).default('40'), // e.g. 40 = 40%
  rebalanceIntervalDays: integer('rebalance_interval_days').default(30),
  lastRebalancedAt: timestamp('last_rebalanced_at', { mode: 'date' }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

export const customSymbolComponents = pgTable('custom_symbol_components', {
  id: serial('id').primaryKey(),
  customSymbolId: integer('custom_symbol_id')
    .notNull()
    .references(() => customSymbols.id, { onDelete: 'cascade' }),
  symbol: varchar({ length: 20 }).notNull(),                 // 'WLFIUSDT'
  marketType: varchar('market_type', { length: 10 })
    .$type<'SPOT' | 'FUTURES'>().default('SPOT').notNull(),
  coingeckoId: varchar('coingecko_id', { length: 100 }),     // 'world-liberty-financial' (for market cap lookup)
  weight: numeric({ precision: 10, scale: 8 }).notNull(),    // '0.3000000000' (last computed)
  basePrice: numeric('base_price', { precision: 20, scale: 8 }), // price at index creation
  isActive: boolean('is_active').default(true).notNull(),
  addedAt: timestamp('added_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  uniqueComponent: unique().on(table.customSymbolId, table.symbol, table.marketType),
  customSymbolIdx: index('custom_symbol_components_idx').on(table.customSymbolId),
}));
```

Then run: `pnpm --filter @marketmind/backend db:generate` to generate the migration, and apply with `pnpm --filter @marketmind/backend db:migrate`.

---

## Backend: CustomSymbolService

**New file:** `apps/backend/src/services/custom-symbol-service.ts`

### Responsibilities

1. **On startup:** Load all active custom symbols from DB, initialize base prices (fetch from Binance if null), subscribe to component price streams, trigger async historical backfill
2. **Price updates:** When any component price changes → recompute index → emit to WebSocket
3. **Kline updates:** When component kline closes → compute synthetic OHLCV → persist to DB → emit kline update
4. **Backfill:** Compute historical synthetic klines from component klines stored in DB
5. **Weight rebalancing:** Fetch market caps from CoinGecko API → compute new weights → update DB
6. **Seed POLITIFI:** Insert POLITIFI to DB if not present, using live CoinGecko market caps for initial weights

### Dynamic Weight Computation (CoinGecko API)

Use CoinGecko free API (no auth required for basic market data):

```typescript
// GET https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=world-liberty-financial,official-trump,...
async fetchMarketCaps(coingeckoIds: string[]): Promise<Map<string, number>> {
  const ids = coingeckoIds.join(',');
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=100&page=1`;
  const response = await fetch(url);
  const data = await response.json();
  return new Map(data.map((coin: any) => [coin.id, coin.market_cap]));
}

computeWeights(method: WeightingMethod, marketCaps: number[], capPercent?: number): number[] {
  if (method === 'EQUAL') return marketCaps.map(() => 1 / marketCaps.length);

  let raw = method === 'SQRT_MARKET_CAP'
    ? marketCaps.map(Math.sqrt)
    : [...marketCaps]; // MARKET_CAP or CAPPED_MARKET_CAP

  const total = raw.reduce((a, b) => a + b, 0);
  let weights = raw.map(v => v / total);

  if (method === 'CAPPED_MARKET_CAP' && capPercent) {
    weights = applyCap(weights, capPercent / 100); // iterative capping
  }
  return weights;
}

// Iterative capping: redistribute excess from capped components
function applyCap(weights: number[], cap: number): number[] {
  let result = [...weights];
  let changed = true;
  while (changed) {
    changed = false;
    const excess = result.reduce((sum, w) => sum + Math.max(0, w - cap), 0);
    if (excess < 0.0001) break;
    const uncapped = result.filter(w => w < cap).length;
    result = result.map(w => {
      if (w >= cap) { changed = true; return cap; }
      return w + excess / uncapped;
    });
  }
  return result;
}
```

### Key interfaces

```typescript
interface ComponentState {
  id: number;
  symbol: string;         // 'WLFIUSDT'
  marketType: 'SPOT' | 'FUTURES';
  coingeckoId: string | null;
  weight: number;         // 0.30 (rebalanced)
  basePrice: number;      // price at index creation
  currentPrice: number;   // latest Binance price
}

interface CustomSymbolState {
  id: number;
  symbol: string;         // 'POLITIFI'
  name: string;
  baseValue: number;      // 100
  weightingMethod: string;
  capPercent: number | null;
  components: ComponentState[];
}
```

### Startup flow

```typescript
async start(): Promise<void> {
  await this.loadFromDb();              // Load all active symbols + components
  await this.initializeBasePrices();    // Fetch from Binance if basePrice is null
  await this.rebalanceIfNeeded();       // Update weights from CoinGecko if stale
  this.subscribeToComponentStreams();   // Register with binancePriceStreamService
  void this.backfillAllActiveSymbols(); // Fire-and-forget
}
```

### Hook into BinancePriceStreamService

In `apps/backend/src/services/binance-price-stream.ts`, add an observer pattern:

```typescript
// In BinancePriceStreamService class:
private priceObservers: Array<(symbol: string, price: number, timestamp: number) => void> = [];

public onPriceUpdate(handler: (symbol: string, price: number, timestamp: number) => void): void {
  this.priceObservers.push(handler);
}

// In processPriceUpdate, after emitting to WebSocket:
for (const observer of this.priceObservers) {
  observer(update.symbol, update.price, update.timestamp);
}
```

Then in CustomSymbolService:

```typescript
private subscribeToComponentStreams(): void {
  binancePriceStreamService.onPriceUpdate((symbol, price, timestamp) => {
    this.onComponentPriceUpdate(symbol, price, timestamp);
  });

  // Subscribe each component to Binance price stream
  for (const state of this.definitions.values()) {
    for (const component of state.components) {
      binancePriceStreamService.subscribeSymbol(component.symbol);
    }
  }
}
```

### Historical backfill

```typescript
async backfillKlines(
  customSymbol: string,
  interval: Interval,
  marketType: 'SPOT' | 'FUTURES',
  startTime?: Date,
  endTime?: Date,
): Promise<void> {
  const state = this.definitions.get(customSymbol);
  if (!state) return;

  // 1. Fetch klines for all components at this interval
  const componentKlines = await Promise.all(
    state.components.map(c => fetchComponentKlines(c.symbol, interval, c.marketType, startTime, endTime))
  );

  // 2. Align timestamps (intersection of all component timestamps)
  const timestamps = getAlignedTimestamps(componentKlines);

  // 3. Compute OHLCV for each timestamp
  const syntheticKlines = timestamps.map(ts => computeSyntheticKline(state, componentKlines, ts));

  // 4. Batch-upsert into klines table
  await batchUpsertKlines(customSymbol, interval, 'SPOT', syntheticKlines);
}
```

### isCustomSymbolSync (used by kline.ts and kline-fetcher.ts)

```typescript
private customSymbolSet = new Set<string>(); // loaded at startup

isCustomSymbolSync(symbol: string): boolean {
  return this.customSymbolSet.has(symbol.toUpperCase());
}
```

---

## Backend: tRPC Router

**New file:** `apps/backend/src/routers/custom-symbol.ts`

```typescript
const createCustomSymbolSchema = z.object({
  symbol: z.string().min(2).max(30).toUpperCase(),
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  category: z.enum(['politics', 'defi', 'gaming', 'ai', 'other']),
  baseValue: z.number().positive().default(100),
  weightingMethod: z.enum(['EQUAL', 'MARKET_CAP', 'CAPPED_MARKET_CAP', 'SQRT_MARKET_CAP', 'MANUAL']).default('CAPPED_MARKET_CAP'),
  capPercent: z.number().min(1).max(100).optional(),
  rebalanceIntervalDays: z.number().min(1).default(30),
  components: z.array(z.object({
    symbol: z.string().toUpperCase(),
    marketType: z.enum(['SPOT', 'FUTURES']).default('SPOT'),
    coingeckoId: z.string().optional(),
    weight: z.number().min(0).max(1).optional(), // only for MANUAL method
  })).min(2),
});

export const customSymbolRouter = router({
  list: protectedProcedure.query(async () => {
    // Return all active custom symbols with their components
  }),

  // Compute suggested weights from CoinGecko (called before save)
  computeWeights: protectedProcedure
    .input(z.object({
      components: z.array(z.object({ coingeckoId: z.string(), symbol: z.string() })),
      method: z.enum(['EQUAL', 'MARKET_CAP', 'CAPPED_MARKET_CAP', 'SQRT_MARKET_CAP', 'MANUAL']),
      capPercent: z.number().optional(),
    }))
    .query(async ({ input }) => {
      // Fetch market caps from CoinGecko for the given coingeckoIds
      // Return computed weights
    }),

  create: protectedProcedure
    .input(createCustomSymbolSchema)
    .mutation(async ({ input }) => {
      // 1. Validate no duplicate symbol
      // 2. Fetch Binance prices for base prices
      // 3. If not MANUAL: compute weights via CoinGecko
      // 4. Insert to DB
      // 5. customSymbolService.hotLoad(newSymbol) — add to in-memory state
      // 6. Trigger async backfill
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      category: z.enum(['politics', 'defi', 'gaming', 'ai', 'other']).optional(),
      weightingMethod: z.enum(['EQUAL', 'MARKET_CAP', 'CAPPED_MARKET_CAP', 'SQRT_MARKET_CAP', 'MANUAL']).optional(),
      capPercent: z.number().optional(),
      rebalanceIntervalDays: z.number().optional(),
      components: z.array(z.object({
        symbol: z.string(),
        marketType: z.enum(['SPOT', 'FUTURES']).default('SPOT'),
        coingeckoId: z.string().optional(),
        weight: z.number().optional(),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      // Update DB, reload in-memory state, trigger backfill if components changed
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      // Set isActive = false
      // Remove from in-memory state
      // Optionally: delete klines from DB for this symbol
    }),

  rebalance: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      // Force rebalance: fetch market caps → compute new weights → update DB → reload
    }),
});
```

**Register in `apps/backend/src/trpc/router.ts`:**
```typescript
import { customSymbolRouter } from '../routers/custom-symbol';
// ...
customSymbol: customSymbolRouter,
```

---

## Backend: Kline Integration Points

### 1. `apps/backend/src/services/kline-prefetch.ts`

At the top of `prefetchKlines`, before the Binance API ban check:

```typescript
// Import at top of file:
// import { getCustomSymbolService } from './custom-symbol-service';

if (getCustomSymbolService()?.isCustomSymbolSync(symbol)) {
  await getCustomSymbolService()!.ensureKlinesBackfilled(symbol, interval as Interval, marketType ?? 'SPOT', targetCount);
  return { success: true, downloaded: 0, totalInDb: 0, gaps: 0, alreadyComplete: true };
}
// ... rest of existing function unchanged
```

### 2. `apps/backend/src/services/backtesting/kline-fetcher.ts`

In `fetchKlinesFromDbWithBackfill`, add third branch:

```typescript
if (dbKlines.length < minRequired) {
  const isIB = exchange === 'INTERACTIVE_BROKERS';
  const isCustom = getCustomSymbolService()?.isCustomSymbolSync(symbol) ?? false;

  if (isCustom) {
    await getCustomSymbolService()!.backfillKlines(symbol, interval, effectiveMarketType, startTime, endTime);
  } else if (isIB) {
    await smartBackfillIBKlines(symbol, interval, expectedKlines, effectiveMarketType);
  } else {
    await smartBackfillKlines(symbol, interval, expectedKlines, marketType);
  }

  dbKlines = await db.query.klines.findMany({ where: queryWhere, orderBy: [desc(klinesTable.openTime)] });
}
```

### 3. `apps/backend/src/routers/kline.ts`

In `kline.list` handler, before `prefetchKlines` call:

```typescript
const isCustom = getCustomSymbolService()?.isCustomSymbolSync(input.symbol) ?? false;
if (isCustom) {
  await getCustomSymbolService()!.ensureKlinesBackfilled(input.symbol, input.interval as Interval, marketType, input.limit);
  const result = await db.query.klines.findMany({
    where: and(
      eq(klines.symbol, input.symbol),
      eq(klines.interval, input.interval as Interval),
      eq(klines.marketType, 'SPOT'),
      ...(input.startTime ? [gte(klines.openTime, input.startTime)] : []),
      ...(input.endTime ? [lte(klines.openTime, input.endTime)] : []),
    ),
    orderBy: [desc(klines.openTime)],
    limit: input.limit,
  });
  result.sort((a, b) => new Date(a.openTime).getTime() - new Date(b.openTime).getTime());
  return result; // No subscribeToStream — custom service handles real-time
}
// ... existing code
```

In `kline.searchSymbols` handler, prepend custom symbols to results:

```typescript
const query = input.query?.toUpperCase() ?? '';
const customSymbols = await db.query.customSymbols.findMany({
  where: and(eq(customSymbols.isActive, true)),
});
const customMatches = customSymbols
  .filter(cs => !query || cs.symbol.includes(query) || cs.name.toUpperCase().includes(query))
  .map(cs => ({
    symbol: cs.symbol,
    baseAsset: cs.symbol,
    quoteAsset: 'INDEX',
    displayName: cs.name,
    isCustom: true,
  }));
// Prepend to results: return [...customMatches, ...binanceResults]
```

### 4. `apps/backend/src/services/websocket.ts`

In `subscribe:prices` handler:

```typescript
socket.on('subscribe:prices', (symbol: string) => {
  const room = `prices:${symbol}`;
  if (!socket.rooms.has(room)) socket.join(room);
  // Only subscribe Binance stream for non-custom symbols
  if (!(getCustomSymbolService()?.isCustomSymbolSync(symbol) ?? false)) {
    binancePriceStreamService.subscribeSymbol(symbol);
  }
});
```

Same logic for `subscribe:klines`.

### 5. `apps/backend/src/index.ts`

After `binancePriceStreamService.start()`:

```typescript
const { customSymbolService } = await import('./services/custom-symbol-service');
await customSymbolService.start();
```

Export a getter to avoid circular deps:
```typescript
// In custom-symbol-service.ts
let instance: CustomSymbolService | null = null;
export const getCustomSymbolService = () => instance;
```

---

## POLITIFI Seed (in `customSymbolService.start()`)

```typescript
async seedPolitifi(): Promise<void> {
  const existing = await db.query.customSymbols.findFirst({
    where: eq(customSymbols.symbol, 'POLITIFI'),
  });
  if (existing) return; // idempotent

  const components = [
    { symbol: 'WLFIUSDT',    marketType: 'SPOT' as const, coingeckoId: 'world-liberty-financial' },
    { symbol: 'TRUMPUSDT',   marketType: 'SPOT' as const, coingeckoId: 'official-trump' },
    { symbol: 'MELANIAUSDT', marketType: 'SPOT' as const, coingeckoId: 'official-melania-meme' },
    { symbol: 'PEOPLEUSDT',  marketType: 'SPOT' as const, coingeckoId: 'constitutiondao' },
    { symbol: 'PNUTUSDT',    marketType: 'SPOT' as const, coingeckoId: 'peanut-the-squirrel' },
  ];

  // Fetch market caps from CoinGecko → compute weights (CAPPED_MARKET_CAP, 40% cap)
  const marketCaps = await this.fetchMarketCaps(components.map(c => c.coingeckoId));
  const weights = this.computeWeights('CAPPED_MARKET_CAP', marketCaps, 40);

  // Fetch current Binance prices for base prices
  const basePrices = await this.fetchBasePrices(components);

  // IMPORTANT: If MELANIAUSDT is not on SPOT, fall back to FUTURES
  // Check availability: try Binance REST, catch error, retry with FUTURES

  const [politifi] = await db.insert(customSymbols).values({
    symbol: 'POLITIFI',
    name: 'Political Token Index',
    description: 'A basket of top PolitiFi tokens weighted by capped market cap',
    category: 'politics',
    baseValue: '100',
    weightingMethod: 'CAPPED_MARKET_CAP',
    capPercent: '40',
    rebalanceIntervalDays: 30,
    lastRebalancedAt: new Date(),
  }).returning();

  await db.insert(customSymbolComponents).values(
    components.map((c, i) => ({
      customSymbolId: politifi.id,
      symbol: c.symbol,
      marketType: c.marketType,
      coingeckoId: c.coingeckoId,
      weight: weights[i].toString(),
      basePrice: basePrices.get(c.symbol)?.toString() ?? null,
    }))
  );

  logger.info({ components: components.length }, 'POLITIFI index seeded');
}
```

---

## Frontend: UIStore

In `apps/electron/src/renderer/store/uiStore.ts`, add:

```typescript
isCustomSymbolsOpen: boolean;
setCustomSymbolsOpen: (open: boolean) => void;
toggleCustomSymbols: () => void;
```

Pattern is identical to the existing `isAnalyticsOpen` state — follow exactly the same pattern.

---

## Frontend: Hook

**New file:** `apps/electron/src/renderer/hooks/useBackendCustomSymbols.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '../services/trpc';

export const useBackendCustomSymbols = () => {
  const queryClient = useQueryClient();

  const customSymbols = useQuery({
    queryKey: ['customSymbols'],
    queryFn: () => trpc.customSymbol.list.query(),
    staleTime: 5 * 60 * 1000,
  });

  const computeWeights = useMutation({
    mutationFn: (input: Parameters<typeof trpc.customSymbol.computeWeights.query>[0]) =>
      trpc.customSymbol.computeWeights.query(input),
  });

  const createCustomSymbol = useMutation({
    mutationFn: (data: Parameters<typeof trpc.customSymbol.create.mutate>[0]) =>
      trpc.customSymbol.create.mutate(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customSymbols'] }),
  });

  const updateCustomSymbol = useMutation({
    mutationFn: (data: Parameters<typeof trpc.customSymbol.update.mutate>[0]) =>
      trpc.customSymbol.update.mutate(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customSymbols'] }),
  });

  const deleteCustomSymbol = useMutation({
    mutationFn: (id: number) => trpc.customSymbol.delete.mutate({ id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customSymbols'] }),
  });

  const rebalanceCustomSymbol = useMutation({
    mutationFn: (id: number) => trpc.customSymbol.rebalance.mutate({ id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customSymbols'] }),
  });

  return { customSymbols, computeWeights, createCustomSymbol, updateCustomSymbol, deleteCustomSymbol, rebalanceCustomSymbol };
};
```

---

## Frontend: Symbol Selector

In `apps/electron/src/renderer/components/SymbolSelector.tsx`:

1. Import `useBackendCustomSymbols`
2. Add query at top of component (alongside existing queries)
3. Add a "Custom Symbols" group section — above "Popular Symbols":

```tsx
{customSymbols.data && customSymbols.data.length > 0 && (
  <>
    <Text fontSize="xs" fontWeight="bold" color="fg.muted" px={2} pt={2}>
      {t('symbolSelector.customSymbols')}
    </Text>
    {customSymbols.data.map(cs => (
      <Button
        key={cs.symbol}
        variant="ghost"
        size="sm"
        w="full"
        justifyContent="flex-start"
        onClick={() => {
          onChange(cs.symbol, 'SPOT');
          onClose();
        }}
      >
        <HStack>
          <Badge size="xs" colorPalette="purple">{cs.category}</Badge>
          <Text fontWeight="semibold">{cs.symbol}</Text>
          <Text color="fg.muted" fontSize="xs">{cs.name}</Text>
        </HStack>
      </Button>
    ))}
  </>
)}
```

4. Custom symbols also appear in `searchSymbols` results from backend (already handled by the backend modification)

---

## Frontend: Toolbar Button

In `apps/electron/src/renderer/components/Layout/Toolbar.tsx`:

1. Import `LuLayers` from `react-icons/lu`
2. Import and destructure `isCustomSymbolsOpen`, `toggleCustomSymbols` from `useUIStore`
3. Add button between Analytics and Trading buttons (around line 188):

```tsx
<TooltipWrapper label={t('customSymbols.title')} showArrow>
  <IconButton
    size="2xs"
    aria-label={t('customSymbols.title')}
    onClick={toggleCustomSymbols}
    colorPalette={isCustomSymbolsOpen ? 'blue' : 'gray'}
    variant={isCustomSymbolsOpen ? 'solid' : 'ghost'}
  >
    <LuLayers />
  </IconButton>
</TooltipWrapper>
```

Find where `AnalyticsModal` is rendered in the layout (search for `<AnalyticsModal`) and add `<CustomSymbolsModal />` right next to it.

---

## Frontend: CustomSymbolsModal

**New files:**
- `apps/electron/src/renderer/components/CustomSymbols/CustomSymbolsModal.tsx`
- `apps/electron/src/renderer/components/CustomSymbols/index.ts`

**Modal structure:**

```
Dialog (isOpen=isCustomSymbolsOpen, onClose=toggleCustomSymbols)
├── DialogHeader: t('customSymbols.title')
└── DialogBody:
    ├── Tabs:
    │   ├── Tab "My Indices"
    │   │   └── Stack of IndexCard for each custom symbol
    │   │       └── IndexCard:
    │   │           ├── Name + Symbol badge + Category badge
    │   │           ├── Current price (from priceStore or live)
    │   │           ├── Last rebalanced date
    │   │           ├── Components: horizontal chips [TRUMPUSDT 30% | WLFIUSDT 28% | ...]
    │   │           └── Action buttons: Edit | Rebalance | Delete
    │   │
    │   └── Tab "Create New"
    │       └── CreateIndexForm:
    │           ├── Name (text input)
    │           ├── Symbol / Ticker (text input, auto-uppercase)
    │           ├── Category (Select: Politics | DeFi | Gaming | AI | Other)
    │           ├── Base Value (NumberInput, default 100)
    │           ├── Weighting Method (Select: Equal | Market Cap | Capped Market Cap | Sqrt Market Cap | Manual)
    │           ├── Cap % (NumberInput, visible when CAPPED_MARKET_CAP, default 40)
    │           ├── Components section:
    │           │   ├── Search input (calls kline.searchSymbols)
    │           │   ├── Add button → adds row to components table
    │           │   └── Components table:
    │           │       └── [Symbol | CoinGecko ID | Weight% (auto or manual) | Remove]
    │           ├── "Compute Weights" button (calls computeWeights mutation, fills in Weight% column)
    │           └── "Create Index" button (submit)
```

**Edit mode:** same form, pre-filled with existing data.

Use existing UI components: `Dialog`, `Tabs`, `Button`, `Input`, `Select` from `@/renderer/components/ui/`. Layout with `Box`, `Flex`, `Stack`, `Text`, `Badge` from `@chakra-ui/react`.

---

## Internationalization

Update all 4 files: `apps/electron/src/renderer/locales/{en,es,fr,pt}/translation.json`

**English keys to add:**
```json
"customSymbols": {
  "title": "Custom Symbols",
  "myIndices": "My Indices",
  "createNew": "Create New",
  "newIndex": "New Index",
  "components": "Components",
  "weight": "Weight",
  "category": "Category",
  "baseValue": "Base Value",
  "weightingMethod": "Weighting Method",
  "capPercent": "Cap %",
  "coingeckoId": "CoinGecko ID",
  "computeWeights": "Compute Weights",
  "createIndex": "Create Index",
  "rebalance": "Rebalance",
  "lastRebalanced": "Last rebalanced",
  "deleteConfirm": "Delete this index?",
  "methods": {
    "EQUAL": "Equal Weight",
    "MARKET_CAP": "Market Cap",
    "CAPPED_MARKET_CAP": "Capped Market Cap",
    "SQRT_MARKET_CAP": "Square Root Market Cap",
    "MANUAL": "Manual"
  },
  "categories": {
    "politics": "Politics",
    "defi": "DeFi",
    "gaming": "Gaming",
    "ai": "AI",
    "other": "Other"
  }
},
"symbolSelector": {
  "customSymbols": "Custom Symbols"
}
```

Translate the same keys into es/fr/pt appropriately.

---

## Tests

### Backend: `apps/backend/src/__tests__/custom-symbol-service.test.ts`

Test:
- `computeWeights` for all methods (EQUAL, MARKET_CAP, CAPPED_MARKET_CAP, SQRT_MARKET_CAP)
- `applyCap` iterative algorithm correctness
- OHLCV computation from aligned component klines
- `isCustomSymbolSync` returns true after load
- Seed idempotency (calling seed twice → only 1 DB row)
- Price computation formula: `base × Σ(w_i × p_i / bp_i)`

Mock `binance-price-stream.ts`, CoinGecko fetch, and DB calls.

### Backend: `apps/backend/src/__tests__/routers/custom-symbol.router.test.ts`

Test CRUD operations using `testcontainers` pattern (see existing router tests in `apps/backend/src/__tests__/routers/`).

### Frontend: `apps/electron/src/renderer/components/CustomSymbols/CustomSymbolsModal.test.tsx`

Test:
- Renders "My Indices" tab with mocked custom symbols
- Shows components with weights
- Edit button opens form pre-filled
- Delete button calls mutation

---

## Complete File List

### Create
| File | Purpose |
|------|---------|
| `apps/backend/src/services/custom-symbol-service.ts` | Core service (weights, backfill, real-time, seed) |
| `apps/backend/src/routers/custom-symbol.ts` | tRPC CRUD router |
| `apps/electron/src/renderer/hooks/useBackendCustomSymbols.ts` | Frontend data hook |
| `apps/electron/src/renderer/components/CustomSymbols/CustomSymbolsModal.tsx` | Modal component |
| `apps/electron/src/renderer/components/CustomSymbols/index.ts` | Re-exports |
| `apps/backend/src/__tests__/custom-symbol-service.test.ts` | Backend unit tests |
| `apps/backend/src/__tests__/routers/custom-symbol.router.test.ts` | Router integration tests |
| `apps/electron/src/renderer/components/CustomSymbols/CustomSymbolsModal.test.tsx` | Frontend tests |

### Modify
| File | Change |
|------|--------|
| `apps/backend/src/db/schema.ts` | Add `customSymbols`, `customSymbolComponents` tables |
| `apps/backend/src/trpc/router.ts` | Register `customSymbolRouter` |
| `apps/backend/src/routers/kline.ts` | Custom symbol intercept in `list` + `searchSymbols` |
| `apps/backend/src/services/kline-prefetch.ts` | Short-circuit for custom symbols |
| `apps/backend/src/services/backtesting/kline-fetcher.ts` | Third backfill path for custom symbols |
| `apps/backend/src/services/websocket.ts` | Skip Binance subscription for custom symbols |
| `apps/backend/src/services/binance-price-stream.ts` | Add `onPriceUpdate` observer registration |
| `apps/backend/src/index.ts` | Start `customSymbolService` after binance services |
| `apps/electron/src/renderer/components/SymbolSelector.tsx` | Add "Custom Symbols" group |
| `apps/electron/src/renderer/components/Layout/Toolbar.tsx` | Add Custom Symbols button |
| `apps/electron/src/renderer/store/uiStore.ts` | Add `isCustomSymbolsOpen` state |
| `apps/electron/src/renderer/locales/en/translation.json` | New i18n keys |
| `apps/electron/src/renderer/locales/es/translation.json` | New i18n keys (Spanish) |
| `apps/electron/src/renderer/locales/fr/translation.json` | New i18n keys (French) |
| `apps/electron/src/renderer/locales/pt/translation.json` | New i18n keys (Portuguese) |

---

## Implementation Order

1. DB schema changes + migration (`schema.ts` → `db:generate` → `db:migrate`)
2. `custom-symbol-service.ts` (core logic + POLITIFI seed)
3. `binance-price-stream.ts` observer hook
4. `custom-symbol.ts` tRPC router
5. `trpc/router.ts` registration
6. `kline.ts` interception + `kline-prefetch.ts` + `kline-fetcher.ts`
7. `websocket.ts` subscription guard
8. `index.ts` service startup
9. `uiStore.ts` state
10. `useBackendCustomSymbols.ts` hook
11. `SymbolSelector.tsx` custom group
12. `Toolbar.tsx` button
13. `CustomSymbolsModal.tsx` (CRUD)
14. i18n keys (all 4 languages)
15. Tests
16. `pnpm --filter @marketmind/backend type-check`
17. `pnpm --filter @marketmind/electron type-check`
18. `pnpm --filter @marketmind/electron lint`
19. `pnpm test` — ensure all tests pass

---

## Verification

1. `pnpm --filter @marketmind/backend db:migrate` — migration applies cleanly
2. Start backend → check logs: "POLITIFI index seeded" with 5 components
3. `SELECT symbol, weight, base_price FROM custom_symbol_components` → weights sum to 1.0, dynamically computed
4. Open chart → select POLITIFI → candles render for 1m, 5m, 1h, 1d, 1w
5. Real-time: price updates as TRUMP/WLFI/etc prices change
6. Symbol selector: "Custom Symbols" group shows POLITIFI
7. Search "POLI" → POLITIFI appears
8. Modal: create new index (BTCUSDT 50% + ETHUSDT 50%) → appears in selector → chart works
9. Edit index: change weights → chart updates on next refresh
10. Delete index: disappears from selector
11. Backtesting: run any strategy with symbol = 'POLITIFI' → backtest executes with OHLCV data
12. `pnpm test` → all pass, no regressions

---

## Notes & Gotchas

- Use `getCustomSymbolService()` getter (not direct import) to avoid circular dependencies
- MELANIAUSDT may be FUTURES-only on Binance — handle gracefully in seed (fallback to FUTURES marketType)
- CoinGecko free API has rate limits (30 req/min) — cache market cap results for at least 5 minutes
- Weights in DB are stored as strings (numeric precision) — parse with `parseFloat()` when used
- `isCustomSymbolSync()` must be populated before kline.ts starts handling requests — ensure startup order
- When rebalancing: do NOT reset `basePrice` (it stays fixed at creation time to track performance since inception)
- Component klines for backfill are fetched from DB first; if insufficient, trigger Binance backfill for each component separately (not for the custom symbol), then compute synthetic klines
- Follow all CLAUDE.md rules: no comments in code, no hardcoded strings, use semantic tokens for colors, import interactive components from `@/renderer/components/ui/`
