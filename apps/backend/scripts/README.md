# Backend Scripts

Organized utility scripts for the MarketMind backend.

## Directory Structure

```
scripts/
├── backtest/          # Backtest optimization
├── data/              # Kline data management
├── trading/           # Position & order management
├── audit/             # Trade reconciliation & sync
├── maintenance/       # Database maintenance
├── debug/             # Debugging tools
├── sql/               # Raw SQL migrations
└── ensure-docker.sh   # Docker container setup
```

## audit/

The **startup-audit** is the single source of truth for reconciling the app state with Binance. It replaces all previous audit/fix/sync scripts.

### startup-audit.ts

Full audit and sync of positions, orders, fees, balance, and PnL events with Binance.

```bash
# Full audit (all checks)
pnpm tsx scripts/audit/startup-audit.ts

# Preview changes without writing
pnpm tsx scripts/audit/startup-audit.ts --dry-run

# Run specific checks only
pnpm tsx scripts/audit/startup-audit.ts --only balance
pnpm tsx scripts/audit/startup-audit.ts --only fees,pnl-events
pnpm tsx scripts/audit/startup-audit.ts --only positions,protection

# Audit a specific wallet
pnpm tsx scripts/audit/startup-audit.ts --wallet-id <id>

# Show help
pnpm tsx scripts/audit/startup-audit.ts --help
```

Available checks:

| Check | What it fixes | Binance API calls |
|-------|--------------|-------------------|
| `positions` | Orphaned DB positions, unknown Binance positions | 0 (uses initial fetch) |
| `pending` | Stale pending entries, untracked LIMIT/algo orders | 0 (uses initial fetch) |
| `protection` | Stale/missing SL/TP IDs, orphan algo orders | 0-N (cancel orphans) |
| `fees` | Fee discrepancies on recent closed trades (last 3 days) | 1 per trade (max 10) |
| `balance` | DB balance vs Binance wallet balance | 0 (uses initial fetch) |

Rate limiting: initial data fetched via `Promise.all` (5 requests), fees check uses 1.5s delay between API calls, respects IP ban detection.

### apply-optimizations.ts

Apply optimized backtest parameters to production strategy JSON files.

```bash
pnpm tsx scripts/audit/apply-optimizations.ts
```

## backtest/

Full-pipeline parameter optimization for trading strategies.

| Script | Description |
|--------|-------------|
| `run-optimization.ts` | Production-parity 3-stage optimization (sensitivity sweep, cross-product, trailing stop) |
| `rank-strategies.ts` | Rank all 105 strategies on BTC/ETH/SOL |
| `rank-strategies-with-filters.ts` | Test each strategy against 6 filter presets |

```bash
pnpm optimize:full
pnpm tsx scripts/backtest/run-optimization.ts
pnpm tsx scripts/backtest/run-optimization.ts --quick
```

## data/

Kline data backfill, repair, and verification.

| Script | Description |
|--------|-------------|
| `backfill-historical.ts` | Backfill historical klines from Binance |
| `backfill-kline-gaps.ts` | Fill gaps in existing kline data |
| `fix-corrupted-klines.ts` | Fix corrupted OHLCV values |
| `fix-gaps.ts` | Repair kline time gaps |
| `refresh-klines.ts` | Refresh stale kline data |
| `verify-recent-klines.ts` | Verify recent klines match exchange data |
| `audit-all-timeframes.ts` | Audit data completeness across timeframes |
| `check-klines.ts` | Summary of kline counts per symbol/interval |
| `check-candle-exists.ts` | Check if specific candle exists in DB |

```bash
pnpm tsx scripts/data/backfill-historical.ts
pnpm tsx scripts/data/verify-recent-klines.ts
```

## trading/

Position sync, order management, and exchange operations.

### Diagnostic & Reporting

| Script | Description |
|--------|-------------|
| `sync-diagnostic.ts` | Full diagnostic: compare DB vs Binance (positions, orders, balance) |
| `diagnose-account.ts` | Account health check (wallets, leverage, margin) |
| `find-ghost-trades.ts` | Find closed trades with anomalies (no exit price) |
| `check-min-notional.ts` | Verify Binance MIN_NOTIONAL for symbols |
| `check-algo-orders.mjs` | List algo orders for a symbol |
| `check-algo-status.mjs` | Check algo execution status |
| `check-all-algo-orders.mjs` | List all algo orders |
| `check-all-orders.mjs` | List all open orders |
| `check-fees.mjs` | Check current fee tier |
| `check-positions.mjs` | List open positions |

### Sync & Fix

| Script | Description |
|--------|-------------|
| `sync-positions.ts` | Sync DB positions with exchange state |
| `fix-sync.ts` | Fix ghost positions, stale orders, balance (`--fix` flag) |
| `fix-missing-tp.ts` | Recreate missing TP algo orders |
| `align-protection-orders.ts` | Realign SL/TP orders with DB state (`--dry-run`) |

### Emergency Operations

| Script | Description |
|--------|-------------|
| `cancel-all-orders.ts` | Cancel all open orders for symbols with positions |
| `cancel-orphan-orders.ts` | Cancel orders for symbols with no open execution |
| `close-all-positions.ts` | Market close all open FUTURES positions |
| `cancel-all-algo-orders.mjs` | Cancel all algo orders |
| `cancel-old-orders.mjs` | Cancel orders older than N hours |

```bash
pnpm tsx scripts/trading/sync-diagnostic.ts
pnpm tsx scripts/trading/diagnose-account.ts
pnpm tsx scripts/trading/fix-sync.ts --fix
node scripts/trading/check-positions.mjs
```

## maintenance/

Database cleanup and reset operations.

| Script | Description |
|--------|-------------|
| `reset-wallet.ts` | Reset wallet balances and clear trade history |
| `audit-klines.ts` | Audit klines against Binance API (with `--fix` option) |
| `clear-klines.ts` | Delete all klines from database |

```bash
pnpm reset-wallet
pnpm audit-klines -- -s BTCUSDT -i 1h --fix
pnpm clear-klines
```

## debug/

Debugging and investigation tools.

| Script | Description |
|--------|-------------|
| `dump-scalping-config.ts` | Print all scalping configs as JSON |
| `check-open-positions.ts` | List all open/pending executions with full state |

## sql/

Raw SQL scripts for one-off migrations.

| Script | Description |
|--------|-------------|
| `backfill-fees.sql` | Backfill missing fee records |
| `migrate-auto-trading.sql` | Auto-trading tables migration |

## CLI Commands (via package.json)

| Command | Description |
|---------|-------------|
| `pnpm backtest` | Run a single backtest |
| `pnpm backtest:validate` | Validate strategy parameters |
| `pnpm backtest:optimize` | CLI parameter optimization |
| `pnpm backtest:walkforward` | Walk-forward analysis |
| `pnpm backtest:montecarlo` | Monte Carlo simulation |
| `pnpm backtest:sensitivity` | Sensitivity analysis |
| `pnpm backtest:compare` | Compare strategies |
| `pnpm backtest:export` | Export backtest results |
| `pnpm backtest:mw` | Multi-watcher backtest |
| `pnpm backtest:volume` | Compare volume filters |
| `pnpm optimize:full` | Full production optimization pipeline |
