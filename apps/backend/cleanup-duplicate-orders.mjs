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

    // Correct orders with Fibonacci values
    const correctOrders = {
        DOTUSDT: {
            sl: { price: '2.059', keep: null },  // will find the correct one
            tp: { price: '2.52', keep: null }
        },
        BNBUSDT: {
            sl: { price: '926.82', keep: null },
            tp: { price: '1033.93', keep: null }
        }
    };

    console.log('\n=== GETTING ALL OPEN ALGO ORDERS ===\n');

    const open = await client.getOpenAlgoOrders({ algoType: 'CONDITIONAL' });
    console.log(`Found ${open.length} open algo orders\n`);

    // Sort by createTime descending (newest first)
    const sorted = open.sort((a, b) => b.createTime - a.createTime);

    const toCancel = [];

    for (const order of sorted) {
        const symbol = order.symbol;
        const isStopLoss = order.orderType === 'STOP_MARKET';
        const orderType = isStopLoss ? 'SL' : 'TP';
        const priceKey = isStopLoss ? 'sl' : 'tp';

        if (!correctOrders[symbol]) {
            console.log(`Unknown symbol ${symbol}, marking for cancellation: algoId=${order.algoId}`);
            toCancel.push(order);
            continue;
        }

        const expectedPrice = correctOrders[symbol][priceKey].price;
        const actualPrice = order.triggerPrice;

        if (actualPrice === expectedPrice && !correctOrders[symbol][priceKey].keep) {
            // This is a correct order with Fibonacci price - keep the newest one
            correctOrders[symbol][priceKey].keep = order.algoId;
            console.log(`✅ KEEP ${symbol} ${orderType} @ ${actualPrice} (algoId=${order.algoId}) - Fibonacci value`);
        } else if (actualPrice === expectedPrice) {
            // Duplicate of correct order
            console.log(`🗑️  CANCEL duplicate ${symbol} ${orderType} @ ${actualPrice} (algoId=${order.algoId})`);
            toCancel.push(order);
        } else {
            // Wrong price (old value)
            console.log(`🗑️  CANCEL old ${symbol} ${orderType} @ ${actualPrice} (algoId=${order.algoId}) - should be ${expectedPrice}`);
            toCancel.push(order);
        }
    }

    console.log(`\n=== CANCELLING ${toCancel.length} ORDERS ===\n`);

    for (const order of toCancel) {
        try {
            await client.cancelAlgoOrder({ algoId: order.algoId });
            console.log(`✅ Cancelled algoId=${order.algoId}`);
        } catch (err) {
            console.log(`❌ Failed to cancel algoId=${order.algoId}: ${err.message}`);
        }
    }

    // Update database with correct algo IDs
    console.log('\n=== UPDATING DATABASE ===\n');

    for (const [symbol, orders] of Object.entries(correctOrders)) {
        const slAlgoId = orders.sl.keep;
        const tpAlgoId = orders.tp.keep;

        if (slAlgoId || tpAlgoId) {
            await pool.query(`
                UPDATE trade_executions 
                SET 
                    stop_loss_algo_id = COALESCE($1, stop_loss_algo_id),
                    take_profit_algo_id = COALESCE($2, take_profit_algo_id),
                    stop_loss_is_algo = true,
                    take_profit_is_algo = true,
                    updated_at = NOW()
                WHERE symbol = $3 AND status = 'open'
            `, [slAlgoId, tpAlgoId, symbol]);
            console.log(`✅ Updated ${symbol}: SL=${slAlgoId}, TP=${tpAlgoId}`);
        }
    }

    // Verify
    console.log('\n=== VERIFICATION ===\n');

    const remaining = await client.getOpenAlgoOrders({ algoType: 'CONDITIONAL' });
    console.log(`Remaining algo orders: ${remaining.length}`);
    remaining.forEach(o => {
        console.log(`  ${o.symbol} ${o.orderType === 'STOP_MARKET' ? 'SL' : 'TP'} @ ${o.triggerPrice} (algoId=${o.algoId})`);
    });

    const dbState = await pool.query(`
        SELECT symbol, stop_loss, take_profit, stop_loss_algo_id, take_profit_algo_id 
        FROM trade_executions WHERE status = 'open'
    `);
    console.log('\nDatabase:');
    dbState.rows.forEach(r => {
        console.log(`  ${r.symbol}: SL=${r.stop_loss} (${r.stop_loss_algo_id}), TP=${r.take_profit} (${r.take_profit_algo_id})`);
    });

    await pool.end();
    console.log('\n✅ Cleanup complete!');
}

main().catch(console.error);
