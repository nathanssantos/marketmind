import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import { sql } from 'drizzle-orm';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/marketmind',
});

const db = drizzle(pool);

async function checkKlines() {
  try {
    const result = await db.execute(sql`
      SELECT 
        symbol,
        interval,
        COUNT(*) as count,
        MIN(open_time) as first_time,
        MAX(open_time) as last_time
      FROM klines 
      WHERE symbol = 'BTCUSDT'
      GROUP BY symbol, interval
      ORDER BY symbol, interval
    `);
    
    console.log('Klines in database:');
    console.table(result.rows);
    
    if (result.rows.length === 0) {
      console.log('\n⚠️  No klines found in database!');
      console.log('Make sure to start the app and let it collect data first.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkKlines();
