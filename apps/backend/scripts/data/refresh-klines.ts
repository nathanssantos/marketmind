import type { Interval } from '@marketmind/types';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../src/db/schema';
import { fetchHistoricalKlinesFromAPI } from '../src/services/binance-historical';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://nathan@localhost:5432/marketmind';

const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT'];
const intervals: Interval[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function refreshKlines() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool, { schema });

  console.log('🔄 Starting klines refresh...\n');

  for (const symbol of symbols) {
    console.log(`\n📊 Processing ${symbol}...`);
    
    for (const interval of intervals) {
      try {
        console.log(`  ⏱️  Interval: ${interval}`);
        
        console.log(`    🗑️  Deleting old data...`);
        const deleted = await db.delete(schema.klines)
          .where(and(
            eq(schema.klines.symbol, symbol),
            eq(schema.klines.interval, interval),
            eq(schema.klines.marketType, 'SPOT')
          ));
        
        console.log(`    ✅ Deleted old records`);
        
        const now = new Date();
        const daysToFetch: Record<Interval, number> = {
          '1s': 1,
          '1m': 7,
          '3m': 7,
          '5m': 14,
          '15m': 30,
          '30m': 60,
          '1h': 90,
          '2h': 120,
          '4h': 180,
          '6h': 180,
          '8h': 180,
          '12h': 365,
          '1d': 730,
          '3d': 1095,
          '1w': 1095,
          '1M': 1095,
        };
        
        const days = daysToFetch[interval] || 30;
        const startTime = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        
        console.log(`    📥 Fetching ${days} days of data from Binance...`);
        const klines = await fetchHistoricalKlinesFromAPI(symbol, interval, startTime, now);
        
        console.log(`    💾 Inserting ${klines.length} klines...`);
        
        if (klines.length > 0) {
          for (const k of klines) {
            await db.insert(schema.klines).values({
              symbol,
              interval,
              marketType: 'SPOT',
              openTime: new Date(k.openTime),
              open: k.open,
              high: k.high,
              low: k.low,
              close: k.close,
              volume: k.volume,
              closeTime: new Date(k.closeTime),
              quoteVolume: k.quoteVolume,
              trades: k.trades,
              takerBuyBaseVolume: k.takerBuyBaseVolume || '0',
              takerBuyQuoteVolume: k.takerBuyQuoteVolume || '0',
            }).onConflictDoNothing();
          }
          
          console.log(`    ✅ Inserted ${klines.length} klines for ${symbol} ${interval}`);
        } else {
          console.log(`    ⚠️  No data received from API`);
        }
        
        await sleep(500);
        
      } catch (error) {
        console.error(`    ❌ Error processing ${symbol} ${interval}:`, error);
      }
    }
  }

  await pool.end();
  console.log('\n✅ Klines refresh completed!');
}

refreshKlines().catch(console.error);
