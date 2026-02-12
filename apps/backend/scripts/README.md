# Backend Scripts

Organized utility scripts for the MarketMind backend.

## Directory Structure

```
scripts/
├── backtest/          # Backtest optimization
├── data/              # Kline data management
├── trading/           # Position & order management
├── audit/             # Trade fee auditing & reconciliation
├── maintenance/       # Database maintenance
├── debug/             # Debugging tools
├── sql/               # Raw SQL migrations
└── ensure-docker.sh   # Docker container setup
```

## backtest/

Full-pipeline parameter optimization for trading strategies.

| Script | Description |
|--------|-------------|
| `run-optimization.ts` | Production-parity 3-stage optimization (sensitivity sweep, cross-product, trailing stop) |

```bash
# Run the full optimization pipeline
pnpm optimize:full

# Or directly
pnpm tsx scripts/backtest/run-optimization.ts
```

The optimization script runs 3 stages:
1. **Stage 1** - Parameter sensitivity sweeps (Fibonacci targets, entry progress, R:R ratios)
2. **Stage 2** - Cross-product of top parameters from Stage 1
3. **Stage 3** - Trailing stop optimization on top Stage 2 configs

Features: progress resume, SIGINT/SIGTERM handling, ETA display, kline gap warnings, per-symbol stats.

Output saved to `/tmp/prod-parity-optimization-run/`:
- `summary.txt` - Human-readable report with recommendations
- `full-results.csv` - All backtest results
- `trailing-stop-results.csv` - Stage 3 trailing stop results
- `optimal-config.json` - Best config parameters
- `progress.json` - Resume checkpoint

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

| Script | Description |
|--------|-------------|
| `sync-positions.ts` | Sync DB positions with exchange |
| `sync-diagnostic.ts` | Diagnose sync discrepancies |
| `diagnose-account.ts` | Full account diagnostic report |
| `close-dust.ts` | Close dust positions |
| `check-dust-order.ts` | Check for dust order issues |
| `check-min-notional.ts` | Verify minimum notional requirements |
| `fix-sync.ts` | Fix position sync issues |
| `verify-protection-orders.ts` | Verify SL/TP orders are in place |
| `cancel-all-algo-orders.mjs` | Cancel all algorithmic orders |
| `cancel-old-orders.mjs` | Cancel stale orders |
| `check-algo-orders.mjs` | Check algo order status |
| `check-algo-status.mjs` | Check algo execution status |
| `check-all-algo-orders.mjs` | List all algo orders |
| `check-all-orders.mjs` | List all open orders |
| `check-fees.mjs` | Check current fee tier |
| `check-positions.mjs` | List open positions |
| `cleanup-orders.mjs` | Clean up orphaned orders |
| `cleanup-duplicate-orders.mjs` | Remove duplicate orders |
| `recreate-protection-orders.mjs` | Recreate SL/TP protection orders |
| `recreate-sl-tp.mjs` | Recreate stop-loss and take-profit |
| `fix-tp-orders.mjs` | Fix take-profit order issues |
| `recalc-fibonacci-tp.mjs` | Recalculate Fibonacci take-profit levels |
| `update-sl-tp-fibonacci.mjs` | Update SL/TP with Fibonacci levels |

```bash
pnpm tsx scripts/trading/sync-positions.ts
pnpm tsx scripts/trading/diagnose-account.ts
node scripts/trading/check-positions.mjs
```

## audit/

Trade fee auditing, order reconciliation, and optimization application.

| Script | Description |
|--------|-------------|
| `fix-trade-fees.ts` | Correct trade fee records |
| `audit-trade-fees.ts` | Audit trade fees against exchange |
| `audit-binance-orders.ts` | Reconcile orders with Binance |
| `apply-optimizations.ts` | Apply optimized parameters to production config |

```bash
pnpm tsx scripts/audit/audit-trade-fees.ts
pnpm tsx scripts/audit/apply-optimizations.ts
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
| `debug-fibonacci.mjs` | Debug Fibonacci level calculations |
| `debug-orders.mjs` | Debug order execution flow |

```bash
node scripts/debug/debug-fibonacci.mjs
```

## sql/

Raw SQL scripts for one-off migrations.

| Script | Description |
|--------|-------------|
| `backfill-fees.sql` | Backfill missing fee records |
| `migrate-auto-trading.sql` | Auto-trading tables migration |

```bash
psql -U postgres -d marketmind -f scripts/sql/migrate-auto-trading.sql
```

## CLI Commands (via package.json)

These commands use the CLI interface in `src/cli/`:

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
