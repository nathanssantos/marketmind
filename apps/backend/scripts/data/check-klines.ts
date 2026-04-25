import type { MarketType } from '@marketmind/types';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkKlines() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  const db = drizzle(pool);
  
  // Get active watchers
  const watchers = await db.execute(sql`
    SELECT symbol, interval, market_type 
    FROM active_watchers 
    ORDER BY symbol, interval, market_type
  `);
  
  console.log('\n=== Active Watchers ===');
  console.log(watchers.rows);
  
  // Get klines count per symbol/interval/marketType
  const klineCounts = await db.execute(sql`
    SELECT 
      symbol, 
      interval, 
      market_type,
      COUNT(*) as count,
      MIN(open_time) as oldest,
      MAX(open_time) as newest
    FROM klines 
    GROUP BY symbol, interval, market_type 
    ORDER BY symbol, interval, market_type
  `);
  
  console.log('\n=== Klines Count per Symbol/Interval/MarketType ===');
  for (const row of klineCounts.rows) {
    console.log(`${row.symbol} ${row.interval} ${row.market_type}: ${row.count} candles (${row.oldest} to ${row.newest})`);
  }
  
  // Total klines
  const total = await db.execute(sql`SELECT COUNT(*) as total FROM klines`);
  console.log(`\nTotal klines in database: ${total.rows[0].total}`);
  
  await pool.end();
}

checkKlines().catch(console.error);
