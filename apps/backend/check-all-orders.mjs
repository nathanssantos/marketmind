import { USDMClient } from 'binance';
import crypto from 'crypto';
import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const wallets = await pool.query("SELECT * FROM wallets WHERE wallet_type = 'live' LIMIT 1");
const wallet = wallets.rows[0];

const algorithm = 'aes-256-cbc';
const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
function decrypt(text) {
    const [ivHex, encrypted] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let d = decipher.update(encrypted, 'hex', 'utf8');
    d += decipher.final('utf8');
    return d;
}

const client = new USDMClient({
    api_key: decrypt(wallet.api_key_encrypted),
    api_secret: decrypt(wallet.api_secret_encrypted),
});

// Check specific algo order by ID using the correct method
const algoIds = [4000000386511286, 4000000386511318, 4000000386511346, 4000000386511385];

console.log('=== CHECKING ALGO ORDER STATUS ===\n');

for (const algoId of algoIds) {
    try {
        const order = await client.getAlgoSubOrders({ algoId });
        console.log(`AlgoId ${algoId}:`, JSON.stringify(order, null, 2));
    } catch (err) {
        console.log(`AlgoId ${algoId}: Error - ${err.message}`);
    }
}

// Check all open algo orders
console.log('\n=== ALL OPEN ALGO ORDERS ===\n');
try {
    const openOrders = await client.getOpenAlgoOrders({ algoType: 'CONDITIONAL' });
    console.log('Total:', openOrders.total);
    console.log('Orders:', JSON.stringify(openOrders.orders, null, 2));
} catch (err) {
    console.log('Error:', err.message);
}

// Check open orders (regular)
console.log('\n=== REGULAR OPEN ORDERS ===\n');
try {
    const dotOrders = await client.getAllOpenOrders({ symbol: 'DOTUSDT' });
    console.log('DOTUSDT:', dotOrders);
    const bnbOrders = await client.getAllOpenOrders({ symbol: 'BNBUSDT' });
    console.log('BNBUSDT:', bnbOrders);
} catch (err) {
    console.log('Error:', err.message);
}

await pool.end();
