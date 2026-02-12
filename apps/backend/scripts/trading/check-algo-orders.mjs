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

// Check positions
const positions = await client.getPositions();
const activePositions = positions.filter(p => parseFloat(p.positionAmt) !== 0);
console.log('=== ACTIVE POSITIONS ===');
activePositions.forEach(p => {
    console.log({
        symbol: p.symbol,
        positionAmt: p.positionAmt,
        entryPrice: p.entryPrice,
        markPrice: p.markPrice,
        unrealizedProfit: p.unrealizedProfit,
    });
});

// Get all open algo orders
const algoOrders = await client.getOpenAlgoOrders({ algoType: 'CONDITIONAL' });
console.log('\n=== OPEN ALGO ORDERS ===');
console.log('Total orders:', algoOrders.orders?.length ?? 0);
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

// Check algo order history for DOTUSDT
console.log('\n=== ALGO ORDER HISTORY (DOTUSDT, last 5) ===');
try {
    const historyDOT = await client.getAllAlgoOrders({ algoType: 'CONDITIONAL', symbol: 'DOTUSDT' });
    historyDOT.orders?.slice(0, 5).forEach(o => {
        console.log({
            algoId: o.algoId,
            symbol: o.symbol,
            type: o.orderType,
            triggerPrice: o.triggerPrice,
            algoStatus: o.algoStatus,
        });
    });
} catch (e) {
    console.log('Error:', e.message);
}

// Check algo order history for BNBUSDT  
console.log('\n=== ALGO ORDER HISTORY (BNBUSDT, last 5) ===');
try {
    const historyBNB = await client.getAllAlgoOrders({ algoType: 'CONDITIONAL', symbol: 'BNBUSDT' });
    historyBNB.orders?.slice(0, 5).forEach(o => {
        console.log({
            algoId: o.algoId,
            symbol: o.symbol,
            type: o.orderType,
            triggerPrice: o.triggerPrice,
            algoStatus: o.algoStatus,
        });
    });
} catch (e) {
    console.log('Error:', e.message);
}

await pool.end();
