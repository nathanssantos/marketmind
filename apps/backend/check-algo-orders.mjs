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

// Get all open algo orders
const algoOrders = await client.getOpenAlgoOrders({ algoType: 'CONDITIONAL' });
console.log('=== OPEN ALGO ORDERS ===');
algoOrders.orders?.forEach(o => {
    console.log({
        algoId: o.algoId,
        symbol: o.symbol,
        side: o.side,
        type: o.orderType,
        triggerPrice: o.triggerPrice,
        quantity: o.quantity,
        reduceOnly: o.reduceOnly,
        algoStatus: o.algoStatus,
    });
});

await pool.end();
