import { USDMClient } from 'binance';
import crypto from 'crypto';
import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
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
    const symbolInfoMap = new Map();
    exchangeInfo.symbols.forEach(s => {
        const lotSize = s.filters.find(f => f.filterType === 'LOT_SIZE');
        const priceFilter = s.filters.find(f => f.filterType === 'PRICE_FILTER');
        symbolInfoMap.set(s.symbol, {
            stepSize: lotSize?.stepSize || '0.001',
            tickSize: priceFilter?.tickSize || '0.01',
        });
    });

    // Get open trade executions from database
    const executions = await pool.query(`
    SELECT * FROM trade_executions WHERE status = 'open'
  `);

    console.log(`Found ${executions.rows.length} open positions in database\n`);

    for (const exec of executions.rows) {
        console.log(`\n📊 ${exec.symbol} ${exec.side}`);
        console.log(`   ID: ${exec.id}`);
        console.log(`   Entry: ${exec.entry_price}`);
        console.log(`   Quantity: ${exec.quantity}`);
        console.log(`   SL: ${exec.stop_loss}`);
        console.log(`   TP: ${exec.take_profit}`);

        const filters = symbolInfoMap.get(exec.symbol);
        if (!filters) {
            console.log(`   ❌ No filter info for ${exec.symbol}`);
            continue;
        }

        // Format quantity
        const stepDecimals = filters.stepSize.includes('.')
            ? filters.stepSize.split('.')[1].replace(/0+$/, '').length
            : 0;
        const formattedQty = parseFloat(exec.quantity).toFixed(stepDecimals);

        // Format prices
        const tickDecimals = filters.tickSize.includes('.')
            ? filters.tickSize.split('.')[1].replace(/0+$/, '').length
            : 0;
        const slPrice = parseFloat(exec.stop_loss).toFixed(tickDecimals);
        const tpPrice = parseFloat(exec.take_profit).toFixed(tickDecimals);

        const closeSide = exec.side === 'LONG' ? 'SELL' : 'BUY';

        // Create Stop Loss algo order
        let slAlgoId = null;
        try {
            console.log(`   Creating SL order (${closeSide} @ ${slPrice})...`);
            const slOrder = await client.submitNewAlgoOrder({
                algoType: 'CONDITIONAL',
                symbol: exec.symbol,
                side: closeSide,
                type: 'STOP_MARKET',
                quantity: formattedQty,
                triggerPrice: slPrice,
                reduceOnly: 'true',
                workingType: 'CONTRACT_PRICE',
            });
            slAlgoId = slOrder.algoId;
            console.log(`   ✅ SL Order created: algoId=${slAlgoId}`);
        } catch (err) {
            console.log(`   ❌ Failed to create SL: ${err.message}`);
            if (err.response?.data) console.log('   Error details:', err.response.data);
        }

        // Create Take Profit algo order
        let tpAlgoId = null;
        try {
            console.log(`   Creating TP order (${closeSide} @ ${tpPrice})...`);
            const tpOrder = await client.submitNewAlgoOrder({
                algoType: 'CONDITIONAL',
                symbol: exec.symbol,
                side: closeSide,
                type: 'TAKE_PROFIT_MARKET',
                quantity: formattedQty,
                triggerPrice: tpPrice,
                reduceOnly: 'true',
                workingType: 'CONTRACT_PRICE',
            });
            tpAlgoId = tpOrder.algoId;
            console.log(`   ✅ TP Order created: algoId=${tpAlgoId}`);
        } catch (err) {
            console.log(`   ❌ Failed to create TP: ${err.message}`);
            if (err.response?.data) console.log('   Error details:', err.response.data);
        }

        // Update database with new algo IDs
        if (slAlgoId || tpAlgoId) {
            await pool.query(`
        UPDATE trade_executions 
        SET 
          stop_loss_algo_id = COALESCE($1, stop_loss_algo_id),
          take_profit_algo_id = COALESCE($2, take_profit_algo_id),
          stop_loss_is_algo = $3,
          take_profit_is_algo = $4,
          updated_at = NOW()
        WHERE id = $5
      `, [
                slAlgoId,
                tpAlgoId,
                slAlgoId ? true : false,
                tpAlgoId ? true : false,
                exec.id,
            ]);
            console.log(`   ✅ Database updated`);
        }
    }

    // Verify
    console.log('\n\n=== VERIFICATION ===\n');

    // Check open algo orders
    try {
        const algoOrders = await client.getOpenAlgoOrders({ algoType: 'CONDITIONAL' });
        console.log('Open Algo Orders:', algoOrders.total || 0);
        if (algoOrders.orders?.length > 0) {
            algoOrders.orders.forEach(o => {
                console.log(`  ${o.symbol} ${o.side} ${o.orderType} @ ${o.triggerPrice} qty=${o.quantity}`);
            });
        }
    } catch (err) {
        console.log('Error checking algo orders:', err.message);
    }

    // Check database
    const finalExecs = await pool.query(`
    SELECT id, symbol, side, stop_loss_algo_id, take_profit_algo_id 
    FROM trade_executions WHERE status = 'open'
  `);
    console.log('\nDatabase state:');
    finalExecs.rows.forEach(e => {
        console.log(`  ${e.symbol} ${e.side}: SL=${e.stop_loss_algo_id}, TP=${e.take_profit_algo_id}`);
    });

    await pool.end();
    console.log('\n✅ Done!');
}

main().catch(console.error);
