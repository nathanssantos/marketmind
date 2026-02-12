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

    console.log('=== CHECKING ALGO ORDERS (All Methods) ===\n');

    // Method 1: getOpenAlgoOrders with VP type
    try {
        console.log('1. VP Algo Orders:');
        const vp = await client.getOpenAlgoOrders({ algoType: 'VP' });
        console.log('   Total:', vp.total, 'Orders:', vp.orders?.length || 0);
    } catch (err) {
        console.log('   Error:', err.message);
    }

    // Method 2: getOpenAlgoOrders with TWAP type  
    try {
        console.log('2. TWAP Algo Orders:');
        const twap = await client.getOpenAlgoOrders({ algoType: 'TWAP' });
        console.log('   Total:', twap.total, 'Orders:', twap.orders?.length || 0);
    } catch (err) {
        console.log('   Error:', err.message);
    }

    // Method 3: getOpenAlgoOrders with CONDITIONAL type
    try {
        console.log('3. CONDITIONAL Algo Orders:');
        const cond = await client.getOpenAlgoOrders({ algoType: 'CONDITIONAL' });
        console.log('   Total:', cond.total, 'Orders:', cond.orders?.length || 0);
        console.log('   Full response:', JSON.stringify(cond, null, 2));
    } catch (err) {
        console.log('   Error:', err.message);
    }

    // Method 4: Check open orders (regular)
    console.log('\n4. Regular Open Orders:');
    try {
        const allOrders = await client.getAllOpenOrders();
        console.log('   Total:', allOrders.length);
        allOrders.forEach(o => {
            console.log(`   ${o.symbol} ${o.side} ${o.type} @ ${o.price || o.stopPrice} qty=${o.origQty} status=${o.status}`);
        });
    } catch (err) {
        console.log('   Error:', err.message);
    }

    // Method 5: Check positions
    console.log('\n5. Open Positions:');
    const positions = await client.getPositions();
    const openPositions = positions.filter(p => parseFloat(p.positionAmt) !== 0);
    openPositions.forEach(p => {
        console.log(`   ${p.symbol} ${parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT'} qty=${p.positionAmt} entry=${p.entryPrice}`);
    });

    await pool.end();
}

main().catch(console.error);
