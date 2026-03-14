# PLAN-01: Order Execution Latency

## Context
The futures order execution path in `binance-futures-user-stream.ts` has multiple performance bottlenecks that add 1-1.5s of unnecessary latency per order event. For scalping (where edge is measured in milliseconds), this is unacceptable. Additionally, 15 duplicate wallet DB queries fire per order cycle, and unbounded Maps risk memory leaks on long-running servers.

## Branch
`perf/order-execution-latency`

---

## 1. Remove hard `setTimeout` delays

### File: `apps/backend/src/services/binance-futures-user-stream.ts`

### 1A. Line 191: 300ms delay after cancel before re-placing SL/TP

**Current:**
```typescript
await cancelAllOpenProtectionOrdersOnExchange({ wallet: walletRow, symbol, marketType: 'FUTURES' });
await new Promise(r => setTimeout(r, 300));
```

**Change:** Remove the 300ms delay entirely. The cancel API returns when the order is confirmed cancelled by Binance. If re-placement fails with `UNKNOWN_ORDER_SENT`, retry once after 100ms.

**New code:**
```typescript
await cancelAllOpenProtectionOrdersOnExchange({ wallet: walletRow, symbol, marketType: 'FUTURES' });

if (slPrice) {
  try {
    newSlResult = await createStopLossOrder({ ... });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Unknown order') || msg.includes('-2011')) {
      await new Promise(r => setTimeout(r, 100));
      try {
        newSlResult = await createStopLossOrder({ ... });
      } catch (retryErr) {
        logger.error({ ... }, '[FuturesUserStream] CRITICAL: Failed to place debounced SL after retry');
      }
    } else {
      logger.error({ ... }, '[FuturesUserStream] CRITICAL: Failed to place debounced SL');
    }
  }
}
```

### 1B. Lines with exponential backoff (1000ms * attempt)

**Current:** `await new Promise(resolve => setTimeout(resolve, 1000 * attempt))`

**Change:** Start at 100ms instead of 1000ms: `await new Promise(resolve => setTimeout(resolve, 100 * attempt))`

### 1C. Extract retry utility

Create `apps/backend/src/utils/retry.ts`:
```typescript
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; initialDelayMs?: number; factor?: number } = {}
): Promise<T> => {
  const { maxRetries = 3, initialDelayMs = 100, factor = 2 } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, initialDelayMs * Math.pow(factor, attempt)));
      }
    }
  }
  throw lastError;
};
```

---

## 2. Cache wallet lookups

### File: `apps/backend/src/services/binance-futures-user-stream.ts`

### Problem
15 separate `db.select().from(wallets).where(eq(wallets.id, walletId))` queries throughout the file. Each order event (100+/min during active trading) triggers multiple wallet lookups for the same wallet.

### Solution
Add an in-memory wallet cache with 60s TTL to the class:

```typescript
private walletCache = new Map<string, { wallet: Wallet; cachedAt: number }>();
private static readonly WALLET_CACHE_TTL_MS = 60_000;

private async getCachedWallet(walletId: string): Promise<Wallet | null> {
  const cached = this.walletCache.get(walletId);
  if (cached && Date.now() - cached.cachedAt < BinanceFuturesUserStreamService.WALLET_CACHE_TTL_MS) {
    return cached.wallet;
  }
  const [walletRow] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
  if (walletRow) {
    this.walletCache.set(walletId, { wallet: walletRow, cachedAt: Date.now() });
  }
  return walletRow ?? null;
}

private invalidateWalletCache(walletId: string): void {
  this.walletCache.delete(walletId);
}
```

### Where to invalidate
- In the `ACCOUNT_UPDATE` handler (wallet balance changes) — call `this.invalidateWalletCache(walletId)`
- When wallet credentials are updated (handled by the wallet router, but the stream doesn't know — 60s TTL handles this)

### Replace all occurrences
Search for `db.select().from(wallets).where(eq(wallets.id, walletId))` and replace with `this.getCachedWallet(walletId)`. Locations:
- Line 181 (scheduleDebouncedSlTpUpdate)
- All `handleOrderUpdate` branches
- All `handleAlgoOrderUpdate` branches
- `handleAccountUpdate` (invalidate after processing)

---

## 3. Replace pyramid lock with async mutex

### File: `apps/backend/src/services/binance-futures-user-stream.ts`

### Current (lines 150-164):
```typescript
private async withPyramidLock<T>(walletId: string, symbol: string, fn: () => Promise<T>): Promise<T> {
  const key = `${walletId}:${symbol}`;
  while (this.pyramidLocks.has(key)) {
    await this.pyramidLocks.get(key);
  }
  // ...
}
```

### Problem
- Spin-wait pattern: if 3 concurrent locks arrive, the 3rd re-checks after the 1st releases but the 2nd now holds it
- No timeout: a failed lock stays forever, blocking all future pyramids on that symbol
- No ordering guarantee: whichever promise resolves first wins

### Solution: Queue-based async mutex with timeout

```typescript
private pyramidQueues = new Map<string, Array<{ resolve: () => void; timer: ReturnType<typeof setTimeout> }>>();
private pyramidActive = new Set<string>();
private static readonly PYRAMID_LOCK_TIMEOUT_MS = 30_000;

private async withPyramidLock<T>(walletId: string, symbol: string, fn: () => Promise<T>): Promise<T> {
  const key = `${walletId}:${symbol}`;

  if (this.pyramidActive.has(key)) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        const queue = this.pyramidQueues.get(key);
        if (queue) {
          const idx = queue.findIndex(item => item.resolve === resolve);
          if (idx !== -1) queue.splice(idx, 1);
          if (queue.length === 0) this.pyramidQueues.delete(key);
        }
        resolve();
      }, BinanceFuturesUserStreamService.PYRAMID_LOCK_TIMEOUT_MS);

      const queue = this.pyramidQueues.get(key) ?? [];
      queue.push({ resolve, timer });
      this.pyramidQueues.set(key, queue);
    });
  }

  this.pyramidActive.add(key);
  try {
    return await fn();
  } finally {
    this.pyramidActive.delete(key);
    const queue = this.pyramidQueues.get(key);
    if (queue && queue.length > 0) {
      const next = queue.shift()!;
      clearTimeout(next.timer);
      if (queue.length === 0) this.pyramidQueues.delete(key);
      next.resolve();
    }
  }
}
```

---

## 4. Unbounded Maps cleanup

### File: `apps/backend/src/services/auto-trading-scheduler.ts`

### Problem
- `recentlyRotatedWatchers: Map<string, number>` — entries added on rotation, never pruned
- `rotationPendingWatchers: Map<string, { addedAt: number; targetCandleClose: number }>` — same issue
- After 30 days of uptime, these could have 100K+ stale entries

### Solution
Add cleanup to the existing periodic check (anticipation timer):

```typescript
private static readonly MAP_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
private static readonly MAP_ENTRY_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
private lastMapCleanup = Date.now();

private cleanupStaleMaps(): void {
  const now = Date.now();
  if (now - this.lastMapCleanup < AutoTradingScheduler.MAP_CLEANUP_INTERVAL_MS) return;
  this.lastMapCleanup = now;

  for (const [key, timestamp] of this.recentlyRotatedWatchers) {
    if (now - timestamp > AutoTradingScheduler.MAP_ENTRY_MAX_AGE_MS) {
      this.recentlyRotatedWatchers.delete(key);
    }
  }

  for (const [key, entry] of this.rotationPendingWatchers) {
    if (now - entry.addedAt > AutoTradingScheduler.MAP_ENTRY_MAX_AGE_MS) {
      this.rotationPendingWatchers.delete(key);
    }
  }
}
```

Call `this.cleanupStaleMaps()` inside the anticipation timer callback or the main processing loop.

### Also: pendingSlTpUpdates cleanup on shutdown

Add a `shutdown()` method to `BinanceFuturesUserStreamService`:
```typescript
shutdown(): void {
  for (const [key, timer] of this.pendingSlTpUpdates) {
    clearTimeout(timer);
  }
  this.pendingSlTpUpdates.clear();
  this.pyramidQueues.clear();
  this.pyramidActive.clear();
  this.walletCache.clear();
}
```

---

## Verification

```bash
# Run backend tests
pnpm --filter @marketmind/backend test

# Type check
pnpm --filter @marketmind/backend type-check

# Manual verification:
# 1. Place rapid consecutive orders on futures testnet
# 2. Verify SL/TP placement happens without 300ms gap
# 3. Monitor memory usage over 1hr+ runtime
# 4. Check logs for wallet cache hits vs DB queries
```

## Files Modified
- `apps/backend/src/services/binance-futures-user-stream.ts` (main changes)
- `apps/backend/src/services/auto-trading-scheduler.ts` (Map cleanup)
- `apps/backend/src/utils/retry.ts` (new utility)
