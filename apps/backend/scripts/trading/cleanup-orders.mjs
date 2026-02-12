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

    console.log('=== CLEANING UP DUPLICATE ORDERS ===\n');

    // Get all algo orders
    const algoOrders = await client.getOpenAlgoOrders({ algoType: 'CONDITIONAL' });

    // Group by symbol and type
    const ordersByKey = new Map();
    for (const order of algoOrders) {
        const key = `${order.symbol}_${order.orderType}`;
        if (!ordersByKey.has(key)) {
            ordersByKey.set(key, []);
        }
        ordersByKey.get(key).push(order);
    }

    // Keep only the most recent (highest algoId) and cancel duplicates
    const ordersToKeep = new Map();
    const ordersToCancel = [];

    for (const [key, orders] of ordersByKey) {
        // Sort by createTime desc
        orders.sort((a, b) => b.createTime - a.createTime);

        // Keep the first (most recent), cancel the rest
        ordersToKeep.set(key, orders[0]);
        for (let i = 1; i < orders.length; i++) {
            ordersToCancel.push(orders[i]);
        }
    }

    console.log(`Orders to keep: ${ordersToKeep.size}`);
    console.log(`Orders to cancel: ${ordersToCancel.length}\n`);

    // Cancel duplicates
    for (const order of ordersToCancel) {
        try {
            console.log(`Cancelling ${order.symbol} ${order.orderType} algoId=${order.algoId}...`);
            await client.cancelAlgoOrder({ algoId: order.algoId });
            console.log(`  ✅ Cancelled`);
        } catch (err) {
            console.log(`  ❌ Error: ${err.message}`);
        }
    }

    // Update database with correct algoIds
    console.log('\n=== UPDATING DATABASE ===\n');

    const executions = await pool.query(`SELECT * FROM trade_executions WHERE status = 'open'`);

    for (const exec of executions.rows) {
        const slKey = `${exec.symbol}_STOP_MARKET`;
        const tpKey = `${exec.symbol}_TAKE_PROFIT_MARKET`;

        const slOrder = ordersToKeep.get(slKey);
        const tpOrder = ordersToKeep.get(tpKey);

        console.log(`${exec.symbol} ${exec.side}:`);
        console.log(`  SL: ${slOrder?.algoId || 'NOT FOUND'}`);
        console.log(`  TP: ${tpOrder?.algoId || 'NOT FOUND'}`);

        await pool.query(`
      UPDATE trade_executions 
      SET 
        stop_loss_algo_id = $1,
        take_profit_algo_id = $2,
        stop_loss_is_algo = $3,
        take_profit_is_algo = $4,
        updated_at = NOW()
      WHERE id = $5
    `, [
            slOrder?.algoId || null,
            tpOrder?.algoId || null,
            slOrder ? true : false,
            tpOrder ? true : false,
            exec.id,
        ]);
        console.log(`  ✅ Database updated`);
    }

    // Final verification
    console.log('\n=== FINAL STATE ===\n');

    const finalAlgoOrders = await client.getOpenAlgoOrders({ algoType: 'CONDITIONAL' });
    console.log(`Algo Orders on Binance: ${finalAlgoOrders.length}`);
    for (const o of finalAlgoOrders) {
        console.log(`  ${o.symbol} ${o.orderType} @ ${o.triggerPrice} qty=${o.quantity} algoId=${o.algoId}`);
    }

    const finalExecs = await pool.query(`
    SELECT id, symbol, side, stop_loss, take_profit, stop_loss_algo_id, take_profit_algo_id 
    FROM trade_executions WHERE status = 'open'
  `);
    console.log('\nDatabase:');
    for (const e of finalExecs.rows) {
        console.log(`  ${e.symbol} ${e.side}:`);
        console.log(`    SL: ${e.stop_loss} (algoId: ${e.stop_loss_algo_id})`);
        console.log(`    TP: ${e.take_profit} (algoId: ${e.take_profit_algo_id})`);
    }

    await pool.end();
    console.log('\n✅ Cleanup complete!');
}

main().catch(console.error);
