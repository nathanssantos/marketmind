# Database Migration Scripts

## Auto-Trading Backend Migration

### Quick Start

```bash
# Option 1: Using Drizzle (Recommended)
cd apps/backend
npm run db:push

# Option 2: Using SQL Script
psql -U your_username -d marketmind -f scripts/migrate-auto-trading.sql
```

### What Gets Created

#### Tables
1. **auto_trading_config** - Auto-trading configuration per wallet
2. **trade_executions** - Trade execution history
3. **price_cache** - Real-time price caching

#### Indices
- User/wallet lookups (fast queries)
- Status filtering (open/closed trades)
- Date range queries (performance analytics)
- Setup type filtering (setup statistics)

### Verify Migration

```sql
-- Check tables exist
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('auto_trading_config', 'trade_executions', 'price_cache');

-- Check row counts
SELECT
    'auto_trading_config' as table_name, COUNT(*) as rows FROM auto_trading_config
UNION ALL
SELECT 'trade_executions', COUNT(*) FROM trade_executions
UNION ALL
SELECT 'price_cache', COUNT(*) FROM price_cache;
```

### Rollback (if needed)

```sql
DROP TABLE IF EXISTS price_cache CASCADE;
DROP TABLE IF EXISTS trade_executions CASCADE;
DROP TABLE IF EXISTS auto_trading_config CASCADE;
```

### Troubleshooting

#### Migration fails with "relation does not exist"
- Make sure `users`, `wallets`, and `orders` tables exist first
- Run the main migration script first

#### Permission denied
```bash
# Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_username;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_username;
```

### After Migration

1. Restart backend server
2. Check logs for services startup:
   ```
   📈 Position monitor service started
   💹 Binance price stream service started
   ```
3. Test creating auto-trading config via tRPC

---

## Backtesting Scripts

### Multi-Timeframe Backtest

The main backtest script that runs backtests across multiple timeframes and generates a comparative report.

```bash
pnpm backtest:multi [options]
```

#### Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--rr-long` | `-l` | 1.0 | Min R:R ratio for LONG positions |
| `--rr-short` | `-s` | 0.8 | Min R:R ratio for SHORT positions |
| `--fib-long` | | 2 | Fibonacci target level for LONG (1, 1.272, 1.618, 2, 2.618) |
| `--fib-short` | | 1.272 | Fibonacci target level for SHORT |
| `--entry-limit` | `-e` | 78.6 | Max % progress in Fib range for entry |
| `--symbol` | | BTCUSDT | Trading symbol |
| `--leverage` | | 1 | Leverage multiplier |
| `--timeframes` | `-t` | 15m,30m,1h,2h,4h,6h,8h,12h,1d | Comma-separated timeframes |
| `--start-date` | | 2023-01-23 | Backtest start date (YYYY-MM-DD) |
| `--end-date` | | 2026-01-23 | Backtest end date (YYYY-MM-DD) |
| `--capital` | `-c` | 10000 | Initial capital in USD |
| `--help` | `-h` | | Show help message |

#### Examples

```bash
# Run with custom R:R ratios
pnpm backtest:multi --rr-long 1.5 --rr-short 1.0

# Conservative Fibonacci targets
pnpm backtest:multi --fib-long 1.618 --fib-short 1

# Stricter entry limit
pnpm backtest:multi --entry-limit 50 --fib-long 1.618

# Different symbol and leverage
pnpm backtest:multi --symbol ETHUSDT --leverage 2

# Specific timeframes and date range
pnpm backtest:multi -t "1h,4h,1d" --start-date 2024-01-01 --end-date 2025-01-01

# Custom capital
pnpm backtest:multi -c 50000 --leverage 3
```

#### Output

The script outputs:
1. Progress logs for each timeframe
2. Summary table with metrics per timeframe
3. Best performing timeframes ranked by PnL and Sharpe ratio

### Batch Backtest Comparison

Runs multiple backtest configurations and generates a comparison report.

```bash
pnpm backtest:batch
```

#### Configurations Tested

| Name | R:R Long | R:R Short | Fib Long | Fib Short | Entry Limit |
|------|----------|-----------|----------|-----------|-------------|
| baseline | 1.0 | 0.8 | 2 | 1.272 | 78.6% |
| entry-38 | 1.0 | 0.8 | 2 | 1.272 | 38.2% |
| entry-50 | 1.0 | 0.8 | 2 | 1.272 | 50% |
| entry-62 | 1.0 | 0.8 | 2 | 1.272 | 61.8% |
| rr-strict | 1.5 | 1.2 | 2 | 1.272 | 78.6% |
| rr-permissive | 0.5 | 0.5 | 2 | 1.272 | 78.6% |
| fib-conservative | 1.0 | 0.8 | 1.618 | 1 | 78.6% |
| fib-aggressive | 1.0 | 0.8 | 2.618 | 1.618 | 78.6% |
| scalper | 0.5 | 0.5 | 1.618 | 1 | 50% |
| swing | 1.5 | 1.0 | 2.618 | 1.618 | 38.2% |
| balanced | 0.8 | 0.6 | 1.618 | 1.272 | 61.8% |

#### Output

Results are saved to `/tmp/backtest-comparison-TIMESTAMP/`:
- Individual log files per configuration
- `comparison_summary.txt` - Aggregated results
- `results.csv` - CSV export for further analysis

### Other Backtest Scripts

| Script | Description |
|--------|-------------|
| `pnpm backtest:fib-entry` | Compare different Fibonacci entry limits |
| `pnpm backtest:fib-target` | Compare different Fibonacci target levels |
| `pnpm backtest:validate` | Validate strategy parameters |
| `pnpm backtest:optimize` | Run parameter optimization |
| `pnpm backtest:walkforward` | Walk-forward analysis |
| `pnpm backtest:montecarlo` | Monte Carlo simulation |
| `pnpm backtest:sensitivity` | Sensitivity analysis |
| `pnpm backtest:compare` | Compare multiple strategies |
| `pnpm backtest:export` | Export backtest results |

### Related Documentation

- [QUICK_START_GUIDE.md](../../docs/QUICK_START_GUIDE.md)
- [AUTO_TRADING_IMPLEMENTATION.md](../../docs/AUTO_TRADING_IMPLEMENTATION.md)
