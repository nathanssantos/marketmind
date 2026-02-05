# Interactive Brokers Integration - Stocks Margin Trading

## Executive Summary

This document outlines the requirements for integrating Interactive Brokers (IB) into MarketMind, **focused exclusively on US stocks trading with margin accounts** (supporting both long and short positions). The exchange abstraction layer is already complete, making IB integration a matter of implementing the `ExchangeProvider` interface.

**Scope**: US Stocks only (no futures, options, or crypto via IB)
**Account Type**: Margin account (Reg-T) with long/short capability

---

## 1. Costs & Pricing

### 1.1 API Access
| Item | Cost |
|------|------|
| API Access | FREE |
| Account Minimum | $500 USD |
| Market Data Lines | 100 (default) |

### 1.2 Market Data (Monthly)
| Package | Price | Waiver |
|---------|-------|--------|
| US Stocks Level 1 (NASDAQ/NYSE) | ~$4.50 | $35/mo commissions |

### 1.3 Trading Commissions (IBKR Pro - Tiered)
| Volume (shares/mo) | Commission |
|-------------------|------------|
| 0 - 300,000 | $0.0035/share (min $0.35) |
| 300,001 - 3M | $0.002/share |
| 3M+ | $0.0015/share |

**IBKR Lite**: US stocks/ETFs are FREE (0 commission)

### 1.4 Margin Interest Rates
- Debit balances charged at benchmark rate + spread
- ~5.83% - 6.83% depending on balance tier
- Short stock borrow fees vary by availability

---

## 2. Margin Account Requirements (Reg-T)

### 2.1 Margin Requirements
| Type | Requirement | Effective Leverage |
|------|-------------|-------------------|
| Initial Margin (overnight) | 50% | 2:1 |
| Maintenance Margin | 25% | 4:1 max |
| Day Trading (PDT) | 25% intraday | 4:1 |
| Short Selling Initial | 50% | 2:1 |
| Short Selling Maintenance | 30% | ~3.3:1 |

### 2.2 Pattern Day Trader (PDT) Rules
- **Requirement**: $25,000+ Net Liquidation Value
- **Definition**: 4+ day trades in 5 business days
- **Benefit**: 4:1 intraday leverage (vs 2:1 for non-PDT)
- **API Tag**: `DayTradesRemaining` tracks available day trades

### 2.3 Essential Account Summary Tags
```typescript
const MARGIN_ACCOUNT_TAGS = [
  'NetLiquidation',           // Total account value
  'BuyingPower',              // Available buying power (includes margin)
  'AvailableFunds',           // Funds available for new trades
  'ExcessLiquidity',          // Buffer above maintenance margin
  'InitMarginReq',            // Current initial margin requirement
  'MaintMarginReq',           // Current maintenance margin requirement
  'EquityWithLoanValue',      // Equity including margin loan
  'GrossPositionValue',       // Total position value (absolute)
  'SMA',                      // Special Memorandum Account (Reg-T)
  'Leverage',                 // Current leverage ratio
  'Cushion',                  // % buffer before margin call
  'DayTradesRemaining',       // PDT rule tracking
  'FullInitMarginReq',        // Full initial margin (all positions)
  'FullMaintMarginReq',       // Full maintenance margin
  'FullAvailableFunds',       // Full available funds
  'FullExcessLiquidity',      // Full excess liquidity
] as const;
```

---

## 3. Short Selling Implementation

### 3.1 Checking Shortability
```typescript
// Request shortability info via generic tick 236
ib.reqMktData(reqId, contract, "236", false, false);

// Callback receives shortableShares tick
// Values interpretation:
// ≤ 1.5     = Not available for short sale
// > 1.5-2.5 = Hard to borrow (locate required)
// > 2.5     = Easy to borrow (1000+ shares available)
```

### 3.2 ShortabilityInfo Interface
```typescript
interface ShortabilityInfo {
  symbol: string;
  available: boolean;
  difficulty: 'easy' | 'hard' | 'unavailable';
  sharesAvailable: number;
  borrowFeeRate?: number;      // Annual fee rate for borrowing
  rebateRate?: number;         // Rebate on short proceeds
}

type ShortDifficulty =
  | 'easy'        // > 2.5: Readily available
  | 'hard'        // 1.5-2.5: May need pre-borrow
  | 'unavailable'; // ≤ 1.5: Cannot short
```

### 3.3 Pre-Borrow for Hard-to-Borrow Stocks
For stocks marked "hard to borrow", use pre-borrow to guarantee shares:
```typescript
// Pre-borrow request (ensures shares available at execution)
const preBorrowOrder: Order = {
  action: 'SSHORT',           // Short sale
  orderType: 'LMT',
  totalQuantity: 100,
  lmtPrice: 150.00,
  // IB handles locate automatically for easy-to-borrow
  // Hard-to-borrow may require manual pre-borrow via TWS
};
```

---

## 4. Pre-Trade Margin Validation

### 4.1 WhatIf Order (Margin Impact Check)
```typescript
// Check margin impact BEFORE executing
const whatIfOrder: Order = {
  action: 'BUY',
  orderType: 'LMT',
  totalQuantity: 100,
  lmtPrice: 150.00,
  whatIf: true,  // ← Simulates, does not execute
};

// Response provides margin impact
interface MarginImpact {
  initMarginBefore: number;
  maintMarginBefore: number;
  equityWithLoanBefore: number;
  initMarginChange: number;
  maintMarginChange: number;
  initMarginAfter: number;
  maintMarginAfter: number;
  equityWithLoanAfter: number;
  commission: number;
  minCommission: number;
  maxCommission: number;
}
```

### 4.2 Margin Safety Checks
```typescript
interface MarginSafetyConfig {
  minCushion: number;           // Minimum cushion % (e.g., 0.15 = 15%)
  maxLeverage: number;          // Maximum allowed leverage (e.g., 1.8)
  warnDayTradesRemaining: number; // Warn when below this (e.g., 2)
  blockWhenMarginCall: boolean;  // Block new trades during margin call
}

const validateMarginSafety = (
  account: MarginAccountInfo,
  config: MarginSafetyConfig
): MarginValidationResult => {
  const issues: string[] = [];

  if (account.cushion < config.minCushion) {
    issues.push(`Cushion ${(account.cushion * 100).toFixed(1)}% below minimum ${config.minCushion * 100}%`);
  }

  if (account.leverage > config.maxLeverage) {
    issues.push(`Leverage ${account.leverage.toFixed(2)}x exceeds maximum ${config.maxLeverage}x`);
  }

  if (account.dayTradesRemaining <= config.warnDayTradesRemaining) {
    issues.push(`Only ${account.dayTradesRemaining} day trades remaining (PDT rule)`);
  }

  return {
    safe: issues.length === 0,
    issues,
    canTrade: account.cushion > 0 && account.availableFunds > 0,
  };
};
```

---

## 5. Gap Handling for Stocks

### 5.1 The Gap Problem

Unlike crypto (24/7), stocks have regular gaps:

| Gap Type | Duration | Frequency |
|----------|----------|-----------|
| Overnight | ~17.5 hours | Daily |
| Weekend | ~65.5 hours | Weekly |
| Holiday | 24-89 hours | ~10/year |
| Extended Hours | Variable | Daily |

**Current System Limitation**: Gap detection uses `timeDiff > intervalMs * 1.5`, which flags legitimate stock gaps as "corrupted data".

### 5.2 Market Hours Configuration

```typescript
interface MarketSession {
  name: string;
  open: string;   // HH:mm format
  close: string;  // HH:mm format
  isCore: boolean;
}

interface MarketCalendar {
  timezone: string;
  sessions: MarketSession[];
  holidays: Date[];
  earlyCloses: Map<string, string>; // date -> close time
}

const US_STOCK_MARKET: MarketCalendar = {
  timezone: 'America/New_York',
  sessions: [
    { name: 'PRE_MARKET',   open: '04:00', close: '09:30', isCore: false },
    { name: 'REGULAR',      open: '09:30', close: '16:00', isCore: true },
    { name: 'AFTER_HOURS',  open: '16:00', close: '20:00', isCore: false },
  ],
  holidays: [
    // 2024-2025 NYSE Holidays
    new Date('2025-01-01'), // New Year's Day
    new Date('2025-01-20'), // MLK Day
    new Date('2025-02-17'), // Presidents Day
    new Date('2025-04-18'), // Good Friday
    new Date('2025-05-26'), // Memorial Day
    new Date('2025-06-19'), // Juneteenth
    new Date('2025-07-04'), // Independence Day
    new Date('2025-09-01'), // Labor Day
    new Date('2025-11-27'), // Thanksgiving
    new Date('2025-12-25'), // Christmas
  ],
  earlyCloses: new Map([
    ['2025-07-03', '13:00'],  // Day before July 4th
    ['2025-11-28', '13:00'],  // Day after Thanksgiving
    ['2025-12-24', '13:00'],  // Christmas Eve
  ]),
};
```

### 5.3 Gap Classification System

```typescript
type GapType =
  | 'OVERNIGHT'       // Normal overnight close
  | 'WEEKEND'         // Saturday-Sunday
  | 'HOLIDAY'         // Market holiday
  | 'EARLY_CLOSE'     // Early close day
  | 'UNEXPECTED';     // Actual missing data (needs backfill)

interface GapInfo {
  type: GapType;
  start: Date;
  end: Date;
  durationMs: number;
  expectedKlines: number;
  isLegitimate: boolean;  // true = market was closed, false = missing data
}

const classifyGap = (
  gapStart: Date,
  gapEnd: Date,
  calendar: MarketCalendar,
  interval: TimeInterval
): GapInfo => {
  const startNY = toZonedTime(gapStart, calendar.timezone);
  const endNY = toZonedTime(gapEnd, calendar.timezone);

  // Check if gap spans a weekend
  const startDay = startNY.getDay();
  const endDay = endNY.getDay();
  if (startDay === 5 && endDay === 1) {
    return { type: 'WEEKEND', isLegitimate: true, ... };
  }

  // Check if gap includes a holiday
  const datesInGap = eachDayOfInterval({ start: gapStart, end: gapEnd });
  const hasHoliday = datesInGap.some(d =>
    calendar.holidays.some(h => isSameDay(d, h))
  );
  if (hasHoliday) {
    return { type: 'HOLIDAY', isLegitimate: true, ... };
  }

  // Check if normal overnight gap
  const gapHours = (gapEnd.getTime() - gapStart.getTime()) / (1000 * 60 * 60);
  if (gapHours >= 14 && gapHours <= 18) {
    return { type: 'OVERNIGHT', isLegitimate: true, ... };
  }

  // Unexpected gap - needs investigation/backfill
  return { type: 'UNEXPECTED', isLegitimate: false, ... };
};
```

### 5.4 Updated Gap Detection for Stocks

```typescript
interface GapDetectionConfig {
  marketType: 'CRYPTO' | 'STOCK';
  calendar?: MarketCalendar;
  includeExtendedHours: boolean;
}

const detectGaps = async (
  klines: Kline[],
  interval: TimeInterval,
  config: GapDetectionConfig
): Promise<GapInfo[]> => {
  const gaps: GapInfo[] = [];
  const intervalMs = TIME_MS[interval];

  for (let i = 1; i < klines.length; i++) {
    const timeDiff = klines[i].openTime - klines[i - 1].closeTime;

    if (config.marketType === 'CRYPTO') {
      // Crypto: Any gap > 1.5x interval is unexpected
      if (timeDiff > intervalMs * 1.5) {
        gaps.push({
          type: 'UNEXPECTED',
          isLegitimate: false,
          start: new Date(klines[i - 1].closeTime),
          end: new Date(klines[i].openTime),
          durationMs: timeDiff,
          expectedKlines: Math.floor(timeDiff / intervalMs),
        });
      }
    } else {
      // Stocks: Classify the gap
      const gapInfo = classifyGap(
        new Date(klines[i - 1].closeTime),
        new Date(klines[i].openTime),
        config.calendar!,
        interval
      );

      // Only report unexpected gaps
      if (!gapInfo.isLegitimate) {
        gaps.push(gapInfo);
      }
    }
  }

  return gaps;
};
```

### 5.5 Extended Hours Data Handling

```typescript
interface KlineFetchOptions {
  symbol: string;
  interval: TimeInterval;
  startTime: Date;
  endTime: Date;
  includeExtendedHours: boolean;  // Pre-market + After-hours
  sessionFilter?: 'ALL' | 'REGULAR' | 'EXTENDED';
}

// IB whatToShow parameter
type WhatToShow =
  | 'TRADES'        // Regular + Extended hours
  | 'MIDPOINT'      // Midpoint prices
  | 'BID'           // Bid prices
  | 'ASK';          // Ask prices

// useRTH (Regular Trading Hours) parameter
// true  = Only regular session (9:30-16:00)
// false = Include pre-market and after-hours
```

---

## 6. Historical Data Backfill System

### 6.1 IBKR API Limitations

| Constraint | Limit | Notes |
|------------|-------|-------|
| **Max Concurrent Requests** | 50 | Open requests at once |
| **Requests per 10 min** | 60 | Hard limit, causes pacing violation |
| **Same Contract Requests** | 6 per 2 sec | Same symbol/exchange/type |
| **Identical Requests** | 15 sec cooldown | Exact same request |
| **BID_ASK Data** | Counts 2x | Doubles toward limits |
| **Bars ≤30 sec** | 6 months max | Age limitation |
| **Max Bars per Request** | ~10,000 | Practical limit |

### 6.2 Duration vs Bar Size Matrix

| Bar Size | Max Duration | Bars per Request |
|----------|--------------|------------------|
| 1 sec | 2,000 sec | ~2,000 |
| 5 sec | 10,000 sec | ~2,000 |
| 15 sec | 30,000 sec | ~2,000 |
| 30 sec | 86,400 sec (1 day) | ~2,880 |
| 1 min | 1 day | 1,440 |
| 5 min | 1 week | ~2,016 |
| 15 min | 2 weeks | ~1,344 |
| 30 min | 1 month | ~1,344 |
| 1 hour | 1 month | ~744 |
| 4 hours | 1 year | ~2,190 |
| 1 day | 1 year | ~252 |
| 1 week | 5 years | ~260 |
| 1 month | 20 years | ~240 |

### 6.3 Rate Limit Analysis

```
IBKR Rate Limits:
├── Global: 60 requests per 10 minutes (rolling window)
├── Per Contract: 6 requests per 2 seconds
├── Concurrent: 50 simultaneous open requests
└── Identical: 15 second cooldown (same exact request)

Theoretical Maximum:
├── 60 req / 600 sec = 0.1 req/sec average
├── But can BURST up to 6 req/2sec per contract
└── With 50 concurrent slots, parallelization is key
```

### 6.4 Maximum Performance Strategy

**Key Insight**: Use Rolling Window + Token Bucket + Parallelization

```typescript
// AGGRESSIVE configuration - at the edge of limits
const IBKR_MAX_PERFORMANCE_CONFIG = {
  // Global rate limit (60 per 10 min)
  globalLimit: 58,              // 2 buffer for safety
  globalWindowMs: 600_000,      // 10 minutes

  // Per-contract limit (6 per 2 sec)
  perContractLimit: 5,          // 1 buffer for safety
  perContractWindowMs: 2_000,   // 2 seconds

  // Concurrency
  maxConcurrent: 45,            // 5 buffer from 50 max

  // Recovery
  pacingViolationDelay: 15_000, // 15 sec on violation
  maxRetries: 3,
} as const;
```

### 6.5 Rolling Window Rate Limiter

```typescript
class RollingWindowRateLimiter {
  private timestamps: number[] = [];
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();

    // Remove expired timestamps (outside window)
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);

    if (this.timestamps.length >= this.limit) {
      // Calculate wait time until oldest request expires
      const oldestTimestamp = this.timestamps[0];
      const waitTime = this.windowMs - (now - oldestTimestamp) + 100; // +100ms buffer

      if (waitTime > 0) {
        await sleep(waitTime);
        return this.acquire(); // Retry after waiting
      }
    }

    // Record this request
    this.timestamps.push(Date.now());
  }

  get availableSlots(): number {
    const now = Date.now();
    const activeRequests = this.timestamps.filter(t => now - t < this.windowMs).length;
    return Math.max(0, this.limit - activeRequests);
  }

  get nextAvailableIn(): number {
    if (this.availableSlots > 0) return 0;
    const now = Date.now();
    const oldestTimestamp = this.timestamps[0];
    return Math.max(0, this.windowMs - (now - oldestTimestamp));
  }
}
```

### 6.6 Per-Contract Rate Limiter

```typescript
class PerContractRateLimiter {
  private contractTimestamps = new Map<string, number[]>();
  private readonly limit: number;      // 5 (6 - 1 buffer)
  private readonly windowMs: number;   // 2000ms

  constructor(limit = 5, windowMs = 2000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  async acquire(contractKey: string): Promise<void> {
    const now = Date.now();
    let timestamps = this.contractTimestamps.get(contractKey) || [];

    // Remove expired
    timestamps = timestamps.filter(t => now - t < this.windowMs);

    if (timestamps.length >= this.limit) {
      const waitTime = this.windowMs - (now - timestamps[0]) + 50;
      await sleep(waitTime);
      return this.acquire(contractKey);
    }

    timestamps.push(now);
    this.contractTimestamps.set(contractKey, timestamps);
  }
}
```

### 6.7 High-Performance Backfill Service

```typescript
class IBKRHighPerformanceBackfill {
  private globalLimiter = new RollingWindowRateLimiter(58, 600_000);
  private contractLimiter = new PerContractRateLimiter(5, 2000);
  private activeTasks = 0;
  private readonly maxConcurrent = 45;

  async backfillSymbol(
    symbol: string,
    interval: TimeInterval,
    targetKlines: number = 40_000
  ): Promise<BackfillResult> {
    const contractKey = `${symbol}:${interval}`;
    const chunks = this.createOptimalChunks(symbol, interval, targetKlines);
    const results: Kline[] = [];
    const startTime = Date.now();

    // Process chunks with maximum parallelization
    const chunkPromises: Promise<Kline[]>[] = [];

    for (const chunk of chunks) {
      // Wait for global rate limit
      await this.globalLimiter.acquire();

      // Wait for per-contract rate limit
      await this.contractLimiter.acquire(contractKey);

      // Wait for concurrent slot
      while (this.activeTasks >= this.maxConcurrent) {
        await sleep(50);
      }

      // Launch request (non-blocking)
      this.activeTasks++;
      const promise = this.fetchChunk(chunk)
        .then(klines => {
          results.push(...klines);
          return klines;
        })
        .finally(() => {
          this.activeTasks--;
        });

      chunkPromises.push(promise);
    }

    // Wait for all chunks to complete
    await Promise.all(chunkPromises);

    return {
      symbol,
      interval,
      klines: this.deduplicateAndSort(results),
      totalRequests: chunks.length,
      durationMs: Date.now() - startTime,
      avgRequestTime: (Date.now() - startTime) / chunks.length,
    };
  }

  // Backfill multiple symbols in parallel (MAXIMUM PERFORMANCE)
  async backfillMultipleSymbols(
    requests: Array<{ symbol: string; interval: TimeInterval; targetKlines?: number }>
  ): Promise<Map<string, BackfillResult>> {
    const results = new Map<string, BackfillResult>();

    // Interleave requests from different symbols to maximize throughput
    const allChunks: Array<{ symbol: string; interval: TimeInterval; chunk: BackfillChunk }> = [];

    for (const req of requests) {
      const chunks = this.createOptimalChunks(req.symbol, req.interval, req.targetKlines || 40_000);
      for (const chunk of chunks) {
        allChunks.push({ symbol: req.symbol, interval: req.interval, chunk });
      }
    }

    // Shuffle chunks to distribute load across symbols
    this.shuffleArray(allChunks);

    const symbolResults = new Map<string, Kline[]>();
    const startTime = Date.now();

    for (const { symbol, interval, chunk } of allChunks) {
      const contractKey = `${symbol}:${interval}`;

      await this.globalLimiter.acquire();
      await this.contractLimiter.acquire(contractKey);

      while (this.activeTasks >= this.maxConcurrent) {
        await sleep(50);
      }

      this.activeTasks++;
      this.fetchChunk(chunk)
        .then(klines => {
          const existing = symbolResults.get(contractKey) || [];
          existing.push(...klines);
          symbolResults.set(contractKey, existing);
        })
        .finally(() => {
          this.activeTasks--;
        });
    }

    // Wait for completion
    while (this.activeTasks > 0) {
      await sleep(100);
    }

    // Build results
    for (const req of requests) {
      const key = `${req.symbol}:${req.interval}`;
      const klines = symbolResults.get(key) || [];
      results.set(key, {
        symbol: req.symbol,
        interval: req.interval,
        klines: this.deduplicateAndSort(klines),
        totalRequests: allChunks.filter(c => c.symbol === req.symbol).length,
        durationMs: Date.now() - startTime,
      });
    }

    return results;
  }

  private createOptimalChunks(
    symbol: string,
    interval: TimeInterval,
    targetKlines: number
  ): BackfillChunk[] {
    // Use MAXIMUM duration per request to minimize total requests
    const optimalDuration = OPTIMAL_DURATION_MAX[interval];
    const barsPerRequest = BARS_PER_REQUEST[interval];
    const requestsNeeded = Math.ceil(targetKlines / barsPerRequest);

    const chunks: BackfillChunk[] = [];
    let endDate = new Date();

    for (let i = 0; i < requestsNeeded; i++) {
      chunks.push({
        symbol,
        interval,
        endDateTime: new Date(endDate),
        duration: optimalDuration,
      });

      // Move back by the duration for next chunk
      endDate = this.subtractDuration(endDate, optimalDuration);
    }

    return chunks;
  }

  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}

// Maximum duration per bar size (to minimize requests)
const OPTIMAL_DURATION_MAX: Record<TimeInterval, string> = {
  '1m': '1 D',       // 390 bars/request
  '5m': '1 W',       // 1,950 bars/request
  '15m': '2 W',      // 1,300 bars/request
  '30m': '1 M',      // 520 bars/request
  '1h': '1 M',       // 168 bars/request (could use more)
  '4h': '1 Y',       // 504 bars/request
  '1d': '1 Y',       // 252 bars/request
  '1w': '5 Y',       // 260 bars/request
};

// Estimated bars per request (trading hours only)
const BARS_PER_REQUEST: Record<TimeInterval, number> = {
  '1m': 390,         // 1 trading day
  '5m': 1950,        // 1 week = 5 days * 390
  '15m': 1300,       // 2 weeks
  '30m': 520,        // 1 month
  '1h': 168,         // 1 month
  '4h': 504,         // 1 year
  '1d': 252,         // 1 year
  '1w': 260,         // 5 years
};
```

### 6.8 Comparison: Binance vs IBKR Backfill

| Aspect | Binance | IBKR (Conservative) | IBKR (Max Perf) |
|--------|---------|---------------------|-----------------|
| Rate Limit | 1200 req/min | 5 req/min | **5.8 req/min** |
| Strategy | Sequential | Fixed delay | **Rolling window** |
| Parallelization | N/A | None | **45 concurrent** |
| 40k Klines (1m) | ~4 min | ~21 min | **~11 min** |
| 40k Klines (1d) | ~4 min | ~32 min | **~17 min** |

### 6.9 Time Estimates for 40k Klines (Maximum Performance)

| Interval | Bars/Request | Requests Needed | Theoretical Min | Realistic |
|----------|--------------|-----------------|-----------------|-----------|
| 1m | 390 | 103 | 10.3 min | **~11 min** |
| 5m | 1,950 | 21 | 2.1 min | **~3 min** |
| 15m | 1,300 | 31 | 3.1 min | **~4 min** |
| 30m | 520 | 77 | 7.7 min | **~9 min** |
| 1h | 168 | 239 | 23.9 min | **~25 min** |
| 4h | 504 | 80 | 8.0 min | **~9 min** |
| 1d | 252 | 159 | 15.9 min | **~17 min** |
| 1w | 260 | 154 | 15.4 min | **~17 min** |

*Theoretical minimum = requests / 5.8 per minute. Realistic adds ~10% buffer.*

### 6.10 Multi-Symbol Parallel Backfill

```typescript
// Example: Backfill 10 symbols in parallel
const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'JPM', 'V', 'JNJ'];

const backfillService = new IBKRHighPerformanceBackfill();
const results = await backfillService.backfillMultipleSymbols(
  symbols.map(symbol => ({ symbol, interval: '1h', targetKlines: 40_000 }))
);

// With interleaving, 10 symbols takes roughly the same time as 1 symbol
// because we're always using the full 58 req/10min capacity
// Total: 10 * 239 requests = 2,390 requests
// Time: 2,390 / 5.8 = ~412 minutes = ~6.9 hours for ALL 10 symbols
```

### 6.11 Pacing Violation Recovery

```typescript
class PacingViolationHandler {
  private violations: number[] = [];
  private readonly maxViolations = 3;
  private readonly backoffMultiplier = 2;

  async handleViolation(): Promise<void> {
    this.violations.push(Date.now());

    // Clean old violations (older than 30 min)
    this.violations = this.violations.filter(t => Date.now() - t < 30 * 60 * 1000);

    if (this.violations.length >= this.maxViolations) {
      // Too many violations - enter conservative mode
      const backoffTime = 60_000 * Math.pow(this.backoffMultiplier, this.violations.length - this.maxViolations);
      console.warn(`Multiple pacing violations! Backing off for ${backoffTime / 1000}s`);
      await sleep(backoffTime);
      return;
    }

    // Standard violation recovery: wait 15 seconds
    console.warn('Pacing violation - waiting 15 seconds...');
    await sleep(15_000);
  }

  shouldReduceRate(): boolean {
    // If 2+ violations in last 10 minutes, reduce rate
    const recentViolations = this.violations.filter(t => Date.now() - t < 10 * 60 * 1000);
    return recentViolations.length >= 2;
  }
}
```

---

## 7. SDK & Connection

### 7.1 Recommended: @stoqey/ib

```bash
pnpm add @stoqey/ib
```

**Features**:
- Full TWS API parity in TypeScript
- `IBApi` (callback-based) and `IBApiNext` (RxJS observables)
- MIT licensed, actively maintained
- Connects to TWS or IB Gateway

### 7.2 Connection Configuration

```typescript
interface IBConnectionConfig {
  host: string;           // 'localhost' or '127.0.0.1'
  port: number;           // See port table below
  clientId: number;       // Unique per connection (1-32)
  connectionTimeout: number;
}

// Port Configuration
const IB_PORTS = {
  TWS_LIVE: 7496,
  TWS_PAPER: 7497,
  GATEWAY_LIVE: 4001,
  GATEWAY_PAPER: 4002,
} as const;

// Recommended: IB Gateway (headless, lighter)
const config: IBConnectionConfig = {
  host: '127.0.0.1',
  port: IB_PORTS.GATEWAY_PAPER,  // Start with paper trading
  clientId: 1,
  connectionTimeout: 5000,
};
```

---

## 8. Entity Mapping

### 8.1 Stock Contract

```typescript
// MarketMind symbol -> IB Contract
const createStockContract = (symbol: string): Contract => ({
  symbol: symbol.toUpperCase(),
  secType: 'STK',
  exchange: 'SMART',          // IB Smart Routing
  primaryExchange: 'NASDAQ',  // Or 'NYSE', 'ARCA', etc.
  currency: 'USD',
});

// Examples
const contracts = {
  AAPL: { symbol: 'AAPL', secType: 'STK', exchange: 'SMART', primaryExchange: 'NASDAQ', currency: 'USD' },
  JPM:  { symbol: 'JPM',  secType: 'STK', exchange: 'SMART', primaryExchange: 'NYSE', currency: 'USD' },
  SPY:  { symbol: 'SPY',  secType: 'STK', exchange: 'SMART', primaryExchange: 'ARCA', currency: 'USD' },
};
```

### 8.2 Order Types Mapping

| MarketMind | IB OrderType | Notes |
|------------|--------------|-------|
| `MARKET` | `MKT` | Immediate execution |
| `LIMIT` | `LMT` | Price limit |
| `STOP_LOSS` | `STP` | Stop market |
| `STOP_LOSS_LIMIT` | `STP LMT` | Stop limit |
| `TRAILING_STOP_MARKET` | `TRAIL` | Native trailing |

### 8.3 Kline Transformation

```typescript
// IB Bar -> MarketMind Kline
const mapIBBarToKline = (
  bar: IBBar,
  symbol: string,
  interval: TimeInterval
): Kline => {
  const openTime = parseIBDateTime(bar.time);
  const intervalMs = TIME_MS[interval];

  return {
    symbol,
    interval,
    openTime,
    closeTime: openTime + intervalMs - 1,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    quoteVolume: bar.volume * bar.wap,  // Approximate using VWAP
    trades: bar.barCount,
    takerBuyBaseVolume: 0,  // Not available from IB
    takerBuyQuoteVolume: 0, // Not available from IB
  };
};

// IB DateTime format: "20240115 09:30:00" or "20240115"
const parseIBDateTime = (ibTime: string): number => {
  const [date, time] = ibTime.split(' ');
  const [year, month, day] = [date.slice(0, 4), date.slice(4, 6), date.slice(6, 8)];
  const timeStr = time || '09:30:00';
  return new Date(`${year}-${month}-${day}T${timeStr}-05:00`).getTime();
};
```

---

## 9. File Structure

```
apps/backend/src/exchange/interactive-brokers/
├── index.ts                 # Public exports
├── provider.ts              # IBExchangeProvider (implements ExchangeProvider)
├── stock-client.ts          # Stock trading operations (long/short)
├── connection-manager.ts    # Connection lifecycle, reconnection
├── kline-stream.ts          # Historical data + real-time bars
├── price-stream.ts          # Level 1 quotes (reqMktData)
├── user-stream.ts           # Orders, positions, account updates
├── symbol-adapter.ts        # Symbol <-> Contract mapping
├── market-hours.ts          # NYSE/NASDAQ calendar, session logic
├── gap-classifier.ts        # Gap detection and classification
├── margin-calculator.ts     # Margin validation, whatIf orders
├── shortable-checker.ts     # Short availability (tick 236)
├── backfill-service.ts      # Rate-limited historical data fetch
├── fee-calculator.ts        # Tiered commission calculator (PRO/LITE)
├── types.ts                 # IB-specific types
└── constants.ts             # Ports, limits, intervals

apps/electron/src/renderer/components/
├── StockSymbolSelector/     # Stock search with exchange info
├── MarketStatusBar/         # Open/closed indicator, next open
├── MarginInfoPanel/         # Buying power, cushion, leverage
└── ShortabilityBadge/       # Easy/hard/unavailable indicator
```

---

## 10. Implementation Phases

### Phase 1: Core Connection (Week 1) ✅ COMPLETE
- [x] Setup `@stoqey/ib` dependency
- [x] Implement `ConnectionManager` with reconnection logic
- [x] Implement `IBExchangeProvider` skeleton
- [x] Connect to IB Gateway paper trading (port 4002)
- [x] Implement `getAccountSummary()` with margin tags
- [x] Implement `IBStockClient` with order methods
- [x] Register provider in factory
- [x] Unit tests for provider and constants (24 tests)

### Phase 2: Market Data (Week 2) ✅ COMPLETE
- [x] Implement `IBKlineStream` for historical bars
- [x] Implement `IBPriceStream` for real-time quotes (TickType mapping)
- [x] Implement `MarketHoursService` with NYSE calendar (holidays, early closes)
- [x] Implement `GapClassifier` for stock gaps (OVERNIGHT, WEEKEND, HOLIDAY, EARLY_CLOSE)
- [x] Implement `BackfillService` with rate limiting (58 req/10min, per-contract limits)
- [x] Unit tests for Phase 2 (63 tests, 2520 total passing)

### Phase 3: Trading Operations (Week 3) ✅ COMPLETE
- [x] Implement `StockClient.submitOrder()` for long positions
- [x] Implement `StockClient.submitOrder()` for short positions (via OrderAction.SELL)
- [x] Implement `ShortableChecker` (tick 236 for shortability info)
- [x] Implement `MarginCalculator` with whatIf orders (margin impact, safety validation)
- [x] Implement bracket orders and OCO
- [x] Unit tests for ShortableChecker and MarginCalculator (33 tests)

### Phase 4: Frontend Integration (Week 4) ✅ COMPLETE
- [x] Add Crypto/Stocks toggle to SymbolSelector (AssetClass support)
- [x] Implement stock symbol search via `reqMatchingSymbols` (IBSymbolSearch)
- [x] Add `MarketStatusBar` component (shows market open/closed status)
- [x] Add `MarginInfoPanel` to TradingSidebar (buying power, cushion, leverage)
- [x] Add Stock presets to WatcherManager (FAANG+, Tech Leaders, ETFs, Financials)
- [x] Implement `TrailingStopAdapter` for IB native TRAIL orders
- [x] Multi-language support (EN, PT, ES, FR) for all IB components

### Phase 5: Testing & Polish (Week 5) ✅ COMPLETE
- [x] Integration test stubs for all IB modules (connection-manager, stock-client, kline-stream, price-stream)
- [x] CLI backtest commands with `--exchange` and `--asset-class` flags
- [x] `IBFeeCalculator` with tiered commissions (TIER_1-4, LITE accounts, round-trip support) - 17 tests
- [x] `smartBackfillIBKlines` service for IB historical data backfill with DB caching
- [x] BacktestEngine exchange routing (kline fetching routes to IB or Binance based on config)
- [x] Full type-check and lint clean across backend and frontend
- [x] Documentation updates
- [ ] End-to-end tests on paper trading (requires IB Gateway)
- [ ] Backfill stress testing (requires IB Gateway)
- [ ] Migration guide (paper → live)

---

## 11. CLI Usage

### 11.1 Backtest with IB Data

The CLI backtest commands support fetching historical data from Interactive Brokers:

```bash
# Validate strategy with IB stock data
pnpm backtest validate \
  --strategy setup91 \
  --symbol AAPL \
  --interval 1h \
  --start 2024-01-01 \
  --end 2024-12-31 \
  --exchange INTERACTIVE_BROKERS \
  --asset-class STOCKS

# Batch backtest with IB
pnpm backtest batch \
  --start 2024-01-01 \
  --end 2024-12-31 \
  --symbols AAPL,MSFT,GOOGL,NVDA \
  --intervals 1h,4h,1d \
  --exchange INTERACTIVE_BROKERS \
  --asset-class STOCKS \
  --output results/ib-batch.csv
```

### 11.2 Exchange Options

| Flag | Values | Default | Description |
|------|--------|---------|-------------|
| `--exchange` | `BINANCE`, `INTERACTIVE_BROKERS` | `BINANCE` | Data source for klines |
| `--asset-class` | `CRYPTO`, `STOCKS` | `CRYPTO` | Asset class for trading rules |

---

## 12. Trailing Stop Adapter

### 12.1 IB Native TRAIL Orders

Interactive Brokers supports native trailing stop orders (TRAIL order type), which is more reliable than software-based trailing:

```typescript
import { createTrailingStopOrderParams } from './exchange/interactive-brokers/trailing-stop-adapter';

// Create trailing stop for LONG position
const result = createTrailingStopOrderParams({
  symbol: 'AAPL',
  side: 'LONG',
  quantity: 100,
  trailPercent: 2,        // 2% trailing distance
  initialStopPrice: 145,  // Optional initial stop price
  outsideRth: true,       // Allow outside regular trading hours
});

// Result contains IB-compatible order parameters
console.log(result.orderParams);
// {
//   contract: { symbol: 'AAPL', secType: 'STK', exchange: 'SMART', currency: 'USD' },
//   action: 'SELL',
//   orderType: 'TRAIL',
//   totalQuantity: 100,
//   trailingPercent: 2,
//   tif: 'GTC',
//   ...
// }
```

### 12.2 MarketMind to IB Trailing Conversion

```typescript
import { mapMarketMindTrailingToIB } from './exchange/interactive-brokers/trailing-stop-adapter';

// Convert MarketMind's activation-based trailing to IB parameters
const ibParams = mapMarketMindTrailingToIB(
  100,      // Entry price
  103,      // Current price (3% profit)
  'LONG',   // Position side
  2,        // Activation threshold (2%)
  1         // Trailing distance (1%)
);

// Returns null if profit < activation threshold
// Otherwise returns: { trailPercent: 1, initialStopPrice: 101.97 }
```

### 12.3 Trailing Stop Features

| Feature | Percent-Based | Amount-Based |
|---------|---------------|--------------|
| Parameter | `trailPercent` | `auxPrice` |
| Example | 2% of price | $5.00 fixed |
| Best For | Volatile stocks | Stable stocks |
| IB Field | `trailingPercent` | `auxPrice` |

---

## 13. Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Scope** | Stocks only | Simplify integration, futures/options later |
| **Account Type** | Margin (Reg-T) | Enable long + short trading |
| **Connection** | IB Gateway | Headless, lighter than TWS |
| **Environment** | Paper first | Safe development and testing |
| **Extended Hours** | Configurable | User preference for pre/post market |
| **Gap Handling** | Classification | Distinguish legitimate vs missing data |
| **Backfill Rate** | 5.8 req/min | Maximum with rolling window rate limiter |
| **Short Pre-borrow** | Manual via TWS | Auto pre-borrow complex, phase 2 |
| **Trailing Stops** | IB Native TRAIL | More reliable than software-based |

---

## 14. Open Questions

1. **Pre-market/After-hours**: Enable by default or require opt-in?
2. **Margin Alerts**: Auto-notify when cushion drops below X%?
3. **PDT Warnings**: Block trades or just warn when low day trades?
4. **Symbol Cache**: How long to cache `reqMatchingSymbols` results?
5. **Failover**: What happens if IB Gateway disconnects mid-trade?

---

## 15. References

- [@stoqey/ib GitHub](https://github.com/stoqey/ib)
- [TWS API Documentation](https://interactivebrokers.github.io/tws-api/)
- [Historical Data Limitations](https://interactivebrokers.github.io/tws-api/historical_limitations.html)
- [Account Summary Tags](https://interactivebrokers.github.io/tws-api/account_summary.html)
- [Margin Check (whatIf)](https://interactivebrokers.github.io/tws-api/margin.html)
- [Stock Margin Requirements](https://www.interactivebrokers.com/en/trading/margin-stocks.php)
- [Reg-T Margin](https://www.interactivebrokers.com/campus/glossary-terms/reg-t-margin/)
- [Short Selling](https://www.interactivebrokers.com/campus/trading-lessons/short-selling-and-margin/)
- [Pacing Violations](https://www.multicharts.com/trading-software/index.php?title=Interactive_Brokers_Pacing_Violation)
