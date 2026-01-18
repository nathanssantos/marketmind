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

    // List all algo orders
    console.log('\n=== ALL OPEN ALGO ORDERS ON BINANCE ===\n');
    const algoOrders = await client.getOpenAlgoOrders({ algoType: 'CONDITIONAL' });
    console.log('Total:', algoOrders.total);

    if (algoOrders.orders && algoOrders.orders.length > 0) {
        algoOrders.orders.forEach(o => {
            console.log(`${o.symbol} ${o.side} ${o.orderType} @ ${o.triggerPrice} qty=${o.quantity} algoId=${o.algoId}`);
        });

        // Cancel old orders (the ones with old SL/TP values)
        const oldAlgoIds = [
            4000000386587110, // old DOTUSDT SL
            4000000386605270, // old DOTUSDT TP
            4000000386632400, // old BNBUSDT SL
            4000000386633560, // old BNBUSDT TP
        ];

        console.log('\n=== CANCELLING OLD ORDERS ===\n');

        for (const algoId of oldAlgoIds) {
            try {
                console.log(`Cancelling algoId ${algoId}...`);
                await client.cancelAlgoOrder({ algoId });
                console.log(`  ✅ Cancelled`);
            } catch (err) {
                console.log(`  ⚠️  ${err.message}`);
            }
        }

        // Verify
        console.log('\n=== REMAINING ALGO ORDERS ===\n');
        const remaining = await client.getOpenAlgoOrders({ algoType: 'CONDITIONAL' });
        console.log('Total:', remaining.total);
        if (remaining.orders && remaining.orders.length > 0) {
            remaining.orders.forEach(o => {
                console.log(`${o.symbol} ${o.side} ${o.orderType} @ ${o.triggerPrice} qty=${o.quantity} algoId=${o.algoId}`);
            });
        }
    } else {
        console.log('No open algo orders found');
    }

    await pool.end();
}

main().catch(console.error);
