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

### Related Documentation

- [QUICK_START_GUIDE.md](../../docs/QUICK_START_GUIDE.md)
- [AUTO_TRADING_IMPLEMENTATION.md](../../docs/AUTO_TRADING_IMPLEMENTATION.md)
