-- Reset paper trading wallet

-- 1. Delete all trade executions for paper wallet
DELETE FROM trade_executions WHERE wallet_id = '-pX1HyCie-t6rHp69Wpef';

-- 2. Delete all setup detections (optional, to clean up old detections)
-- DELETE FROM setup_detections WHERE created_at < NOW() - INTERVAL '1 day';

-- 3. Delete all active watchers for this wallet
DELETE FROM active_watchers WHERE wallet_id = '-pX1HyCie-t6rHp69Wpef';

-- 4. Delete all orders for this wallet
DELETE FROM orders WHERE wallet_id = '-pX1HyCie-t6rHp69Wpef';

-- 5. Show final state
SELECT 
  'trade_executions' as table_name, 
  COUNT(*) as count 
FROM trade_executions 
WHERE wallet_id = '-pX1HyCie-t6rHp69Wpef'
UNION ALL
SELECT 
  'active_watchers', 
  COUNT(*) 
FROM active_watchers 
WHERE wallet_id = '-pX1HyCie-t6rHp69Wpef'
UNION ALL
SELECT 
  'orders', 
  COUNT(*) 
FROM orders 
WHERE wallet_id = '-pX1HyCie-t6rHp69Wpef';

SELECT 'Wallet reset complete!' as status;
