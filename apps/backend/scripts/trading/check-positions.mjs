import { USDMClient } from 'binance';
import crypto from 'crypto';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

async function main() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    const wallets = await pool.query("SELECT * FROM wallets WHERE wallet_type = 'live' LIMIT 1");
    const wallet = wallets.rows[0];

    if (!wallet) {
        console.log('No live wallet found');
        await pool.end();
        return;
    }

    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

    function decrypt(text) {
        const [ivHex, encrypted] = text.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    const apiKey = decrypt(wallet.api_key_encrypted);
    const apiSecret = decrypt(wallet.api_secret_encrypted);

    console.log('Wallet:', wallet.name, wallet.id);
    console.log('Market Type:', wallet.market_type);

    const client = new USDMClient({
        api_key: apiKey,
        api_secret: apiSecret,
    });

    const positions = await client.getPositions();
    const openPositions = positions.filter(p => parseFloat(p.positionAmt) !== 0);

    console.log('\n=== OPEN POSITIONS ON BINANCE ===');
    openPositions.forEach(p => {
        console.log({
            symbol: p.symbol,
            side: parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT',
            quantity: p.positionAmt,
            entryPrice: p.entryPrice,
            markPrice: p.markPrice,
            unrealizedPnL: p.unRealizedProfit,
            leverage: p.leverage,
        });
    });

    if (openPositions.length === 0) {
        console.log('No open positions');
    }

    const executions = await pool.query("SELECT id, symbol, side, status, quantity, entry_price, stop_loss_order_id, take_profit_order_id, created_at FROM trade_executions WHERE status = 'open' ORDER BY created_at DESC LIMIT 10");

    console.log('\n=== TRADE EXECUTIONS IN DATABASE (status=open) ===');
    if (executions.rows.length === 0) {
        console.log('No open executions in database');
    } else {
        executions.rows.forEach(e => console.log(e));
    }

    await pool.end();
}

main().catch(console.error);
