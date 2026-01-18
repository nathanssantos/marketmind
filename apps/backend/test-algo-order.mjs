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

    // Get exchange info for formatting
    const exchangeInfo = await client.getExchangeInfo();
    const dotFilters = exchangeInfo.symbols.find(s => s.symbol === 'DOTUSDT').filters;
    const bnbFilters = exchangeInfo.symbols.find(s => s.symbol === 'BNBUSDT').filters;

    console.log('\n=== EXCHANGE INFO ===');
    console.log('DOTUSDT filters:');
    dotFilters.forEach(f => {
        if (f.filterType === 'LOT_SIZE') console.log('  LOT_SIZE:', f);
        if (f.filterType === 'PRICE_FILTER') console.log('  PRICE_FILTER:', f);
        if (f.filterType === 'MIN_NOTIONAL') console.log('  MIN_NOTIONAL:', f);
    });

    console.log('\nBNBUSDT filters:');
    bnbFilters.forEach(f => {
        if (f.filterType === 'LOT_SIZE') console.log('  LOT_SIZE:', f);
        if (f.filterType === 'PRICE_FILTER') console.log('  PRICE_FILTER:', f);
        if (f.filterType === 'MIN_NOTIONAL') console.log('  MIN_NOTIONAL:', f);
    });

    // Test creating a single algo order
    console.log('\n=== TESTING ALGO ORDER CREATION ===\n');

    try {
        console.log('Creating test SL order for DOTUSDT...');
        const result = await client.submitNewAlgoOrder({
            algoType: 'CONDITIONAL',
            symbol: 'DOTUSDT',
            side: 'SELL',
            type: 'STOP_MARKET',
            quantity: '5.4',
            triggerPrice: '2.059',
            reduceOnly: 'true',
            workingType: 'CONTRACT_PRICE',
        });
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (err) {
        console.log('Error:', err.message);
        if (err.response?.data) {
            console.log('Error details:', JSON.stringify(err.response.data, null, 2));
        }
    }

    // Wait a moment and check
    await new Promise(r => setTimeout(r, 1000));

    console.log('\n=== CHECKING OPEN ALGO ORDERS ===\n');
    try {
        const open = await client.getOpenAlgoOrders({ algoType: 'CONDITIONAL' });
        console.log('Response:', JSON.stringify(open, null, 2));
    } catch (err) {
        console.log('Error:', err.message);
    }

    await pool.end();
}

main().catch(console.error);
