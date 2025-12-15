-- Quick validation queries for new features
-- Run: psql $DATABASE_URL -f scripts/validate-new-features.sql

\echo '🔍 Validating New Features'
\echo '=========================='
\echo ''

-- Check if new tables exist
\echo '📊 Tables:'
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'strategy_performance')
    THEN '✅' ELSE '❌' END || ' strategy_performance',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trade_cooldowns')
    THEN '✅' ELSE '❌' END || ' trade_cooldowns';

\echo ''
\echo '📈 Strategy Performance Table:'
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT strategy_id) as unique_strategies,
  COUNT(DISTINCT symbol) as unique_symbols
FROM strategy_performance;

\echo ''
\echo '⏰ Trade Cooldowns:'
SELECT 
  COUNT(*) as active_cooldowns,
  COUNT(CASE WHEN cooldown_until > NOW() THEN 1 END) as valid_cooldowns,
  COUNT(CASE WHEN cooldown_until <= NOW() THEN 1 END) as expired_cooldowns
FROM trade_cooldowns;

\echo ''
\echo '💼 Trade Executions (for performance tracking):'
SELECT 
  setup_type,
  symbol,
  COUNT(*) as total_trades,
  COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_trades,
  COUNT(CASE WHEN status = 'open' THEN 1 END) as open_trades
FROM trade_executions
GROUP BY setup_type, symbol
ORDER BY total_trades DESC
LIMIT 10;

\echo ''
\echo '✅ Validation Complete!'
