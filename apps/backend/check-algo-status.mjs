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

// Check specific algo order by ID
const algoIds = [4000000386511286, 4000000386511318, 4000000386511346, 4000000386511385];

console.log('=== CHECKING ALGO ORDER STATUS ===\n');

for (const algoId of algoIds) {
    try {
        const order = await client.getAlgoOrderById({ algoId });
        console.log(`AlgoId ${algoId}:`, {
            symbol: order.symbol,
            side: order.side,
            type: order.orderType,
            status: order.algoStatus,
            triggerPrice: order.triggerPrice,
            quantity: order.quantity,
        });
    } catch (err) {
        console.log(`AlgoId ${algoId}: Error - ${err.message}`);
    }
}

// Also check historical algo orders
console.log('\n=== HISTORICAL ALGO ORDERS (last 24h) ===\n');
try {
    const history = await client.getHistoricalAlgoOrders({
        algoType: 'CONDITIONAL',
        startTime: Date.now() - 24 * 60 * 60 * 1000,
        endTime: Date.now(),
    });
    history.orders?.forEach(o => {
        console.log({
            algoId: o.algoId,
            symbol: o.symbol,
            side: o.side,
            type: o.orderType,
            status: o.algoStatus,
            triggerPrice: o.triggerPrice,
        });
    });
} catch (err) {
    console.log('Error getting history:', err.message);
}

await pool.end();
