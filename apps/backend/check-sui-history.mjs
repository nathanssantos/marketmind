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

    const client = new USDMClient({
        api_key: decrypt(wallet.api_key_encrypted),
        api_secret: decrypt(wallet.api_secret_encrypted),
    });

    console.log('=== SUIUSDT ALGO ORDER HISTORY ===\n');
    
    try {
        // Get historical algo orders for SUIUSDT
        const history = await client.getHistoricalAlgoOrders({
            symbol: 'SUIUSDT',
            algoType: 'CONDITIONAL',
            limit: 20
        });
        
        if (history.orders && history.orders.length > 0) {
            history.orders.forEach(o => {
                console.log({
                    algoId: o.algoId,
                    type: o.orderType,
                    side: o.side,
                    triggerPrice: o.triggerPrice,
                    status: o.algoStatus,
                    createdAt: new Date(o.createTime).toISOString(),
                    updatedAt: new Date(o.updateTime).toISOString(),
                });
            });
        } else {
            console.log('No algo order history found');
        }
    } catch (err) {
        console.log('Error getting history:', err.message);
        
        // Try alternative method - get all open algo orders first
        console.log('\nTrying getAlgoSubOrders...');
        try {
            const subOrders = await client.getAlgoSubOrders({ algoId: 4000000403408570 });
            console.log('Sub orders:', subOrders);
        } catch (e) {
            console.log('getAlgoSubOrders error:', e.message);
        }
    }

    // Check what the database thinks the algo IDs are
    console.log('\n=== DATABASE SUIUSDT ALGO IDs (before fix) ===\n');
    const dbSui = await pool.query(`
        SELECT id, stop_loss, take_profit, stop_loss_algo_id, take_profit_algo_id, 
               created_at, updated_at
        FROM trade_executions 
        WHERE symbol = 'SUIUSDT' 
        ORDER BY created_at DESC 
        LIMIT 3
    `);
    dbSui.rows.forEach(r => {
        console.log(r);
    });

    await pool.end();
}

main().catch(console.error);
