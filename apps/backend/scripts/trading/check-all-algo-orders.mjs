import { USDMClient } from 'binance';
import crypto from 'crypto';
import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
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

    console.log('\n=== ALGO ORDER HISTORY (last 20) ===\n');

    try {
        // Try to get algo order history for each symbol
        for (const symbol of ['DOTUSDT', 'BNBUSDT']) {
            console.log(`\n${symbol}:`);
            const history = await client.getHistoricalAlgoOrders({
                symbol,
                algoType: 'CONDITIONAL',
                limit: 10
            });

            if (history.orders && history.orders.length > 0) {
                history.orders.forEach(o => {
                    console.log(`  algoId=${o.algoId} ${o.orderType} ${o.side} @ ${o.triggerPrice} status=${o.algoStatus}`);
                });
            } else {
                console.log('  No history found');
            }
        }
    } catch (err) {
        console.log('Error:', err.message);
    }

    console.log('\n=== OPEN ALGO ORDERS ===\n');
    try {
        const open = await client.getOpenAlgoOrders({ algoType: 'CONDITIONAL' });
        console.log('Total open:', open.total || 0);
        if (open.orders) {
            open.orders.forEach(o => {
                console.log(`  ${o.symbol} ${o.side} ${o.orderType} @ ${o.triggerPrice} algoId=${o.algoId}`);
            });
        }
    } catch (err) {
        console.log('Error:', err.message);
    }

    console.log('\n=== OPEN REGULAR ORDERS ===\n');
    try {
        const orders = await client.getAllOpenOrders();
        console.log('Total regular orders:', orders.length);
        orders.forEach(o => {
            console.log(`  ${o.symbol} ${o.side} ${o.type} @ ${o.price || o.stopPrice} status=${o.status}`);
        });
    } catch (err) {
        console.log('Error:', err.message);
    }

    await pool.end();
}

main().catch(console.error);
