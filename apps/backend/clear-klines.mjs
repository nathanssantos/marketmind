import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: 'postgresql://marketmind:marketmind123@localhost:5432/marketmind',
});

const db = drizzle(pool);

async function clearKlines() {
    try {
        console.log('🗑️  Deleting all klines...');
        const result = await db.execute(sql`DELETE FROM klines`);
        console.log(`✅ Deleted ${result.rowCount} klines`);
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await pool.end();
    }
}

clearKlines();
