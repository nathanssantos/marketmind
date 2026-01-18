import { USDMClient } from 'binance';
import crypto from 'crypto';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

function generateId() {
    return crypto.randomBytes(16).toString('base64url');
}

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
    console.log('User ID:', wallet.user_id);

    const client = new USDMClient({
        api_key: apiKey,
        api_secret: apiSecret,
    });

    // Get exchange info for stepSize/tickSize
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

    // Get open positions
    const positions = await client.getPositions();
    const openPositions = positions.filter(p => parseFloat(p.positionAmt) !== 0);

    console.log('\n=== SYNCING POSITIONS ===\n');

    for (const pos of openPositions) {
        const symbol = pos.symbol;
        const quantity = Math.abs(parseFloat(pos.positionAmt));
        const entryPrice = parseFloat(pos.entryPrice);
        const side = parseFloat(pos.positionAmt) > 0 ? 'LONG' : 'SHORT';
        const leverage = parseInt(pos.leverage) || 1;
        const liquidationPrice = pos.liquidationPrice ? parseFloat(pos.liquidationPrice) : null;

        const filters = symbolInfoMap.get(symbol) || { stepSize: '0.001', tickSize: '0.01' };

        // Calculate SL and TP (2% SL, 3% TP for LONG; inverse for SHORT)
        const slPercent = 0.02;
        const tpPercent = 0.03;

        let stopLoss, takeProfit;
        if (side === 'LONG') {
            stopLoss = entryPrice * (1 - slPercent);
            takeProfit = entryPrice * (1 + tpPercent);
        } else {
            stopLoss = entryPrice * (1 + slPercent);
            takeProfit = entryPrice * (1 - tpPercent);
        }

        // Format prices
        const tickDecimals = filters.tickSize.includes('.')
            ? filters.tickSize.split('.')[1].replace(/0+$/, '').length
            : 0;
        stopLoss = parseFloat(stopLoss.toFixed(tickDecimals));
        takeProfit = parseFloat(takeProfit.toFixed(tickDecimals));

        // Format quantity
        const stepDecimals = filters.stepSize.includes('.')
            ? filters.stepSize.split('.')[1].replace(/0+$/, '').length
            : 0;
        const formattedQty = quantity.toFixed(stepDecimals);

        console.log(`\n📊 ${symbol} ${side}`);
        console.log(`   Entry: ${entryPrice}`);
        console.log(`   Quantity: ${formattedQty}`);
        console.log(`   Stop Loss: ${stopLoss} (${(slPercent * 100).toFixed(1)}%)`);
        console.log(`   Take Profit: ${takeProfit} (${(tpPercent * 100).toFixed(1)}%)`);
        console.log(`   Leverage: ${leverage}x`);

        // Create SL order (STOP_MARKET algo order)
        const closeSide = side === 'LONG' ? 'SELL' : 'BUY';

        let slAlgoId = null;
        let tpAlgoId = null;

        try {
            console.log(`\n   Creating Stop Loss order...`);
            const slOrder = await client.submitNewAlgoOrder({
                algoType: 'CONDITIONAL',
                symbol,
                side: closeSide,
                type: 'STOP_MARKET',
                quantity: formattedQty,
                triggerPrice: stopLoss.toString(),
                reduceOnly: 'true',
                workingType: 'CONTRACT_PRICE',
            });
            slAlgoId = slOrder.algoId;
            console.log(`   ✅ SL Order created: algoId=${slAlgoId}`);
        } catch (err) {
            console.log(`   ❌ Failed to create SL: ${err.message}`);
        }

        try {
            console.log(`   Creating Take Profit order...`);
            const tpOrder = await client.submitNewAlgoOrder({
                algoType: 'CONDITIONAL',
                symbol,
                side: closeSide,
                type: 'TAKE_PROFIT_MARKET',
                quantity: formattedQty,
                triggerPrice: takeProfit.toString(),
                reduceOnly: 'true',
                workingType: 'CONTRACT_PRICE',
            });
            tpAlgoId = tpOrder.algoId;
            console.log(`   ✅ TP Order created: algoId=${tpAlgoId}`);
        } catch (err) {
            console.log(`   ❌ Failed to create TP: ${err.message}`);
        }

        // Insert into trade_executions
        const executionId = generateId();
        const now = new Date();

        try {
            await pool.query(`
        INSERT INTO trade_executions (
          id, user_id, wallet_id, symbol, side, 
          entry_price, quantity, stop_loss, take_profit,
          stop_loss_algo_id, take_profit_algo_id,
          stop_loss_is_algo, take_profit_is_algo,
          status, market_type, leverage, liquidation_price,
          opened_at, created_at, updated_at,
          setup_type, position_side,
          highest_price_since_entry, lowest_price_since_entry,
          original_stop_loss
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11,
          $12, $13,
          $14, $15, $16, $17,
          $18, $19, $20,
          $21, $22,
          $23, $24,
          $25
        )
      `, [
                executionId,
                wallet.user_id,
                wallet.id,
                symbol,
                side,
                entryPrice.toString(),
                quantity.toString(),
                stopLoss.toString(),
                takeProfit.toString(),
                slAlgoId,
                tpAlgoId,
                slAlgoId ? true : false,
                tpAlgoId ? true : false,
                'open',
                'FUTURES',
                leverage,
                liquidationPrice?.toString() || null,
                now,
                now,
                now,
                'manual_sync',
                'BOTH',
                entryPrice.toString(),
                entryPrice.toString(),
                stopLoss.toString(),
            ]);

            console.log(`   ✅ Trade execution created: ${executionId}`);
        } catch (err) {
            console.log(`   ❌ Failed to insert trade_execution: ${err.message}`);
        }
    }

    // Verify
    console.log('\n\n=== VERIFICATION ===\n');
    const executions = await pool.query("SELECT id, symbol, side, status, quantity, entry_price, stop_loss, take_profit, stop_loss_algo_id, take_profit_algo_id FROM trade_executions WHERE status = 'open' ORDER BY created_at DESC");

    if (executions.rows.length === 0) {
        console.log('No open executions in database');
    } else {
        executions.rows.forEach(e => {
            console.log(`${e.symbol} ${e.side}:`);
            console.log(`  ID: ${e.id}`);
            console.log(`  Qty: ${e.quantity}`);
            console.log(`  Entry: ${e.entry_price}`);
            console.log(`  SL: ${e.stop_loss} (algoId: ${e.stop_loss_algo_id})`);
            console.log(`  TP: ${e.take_profit} (algoId: ${e.take_profit_algo_id})`);
            console.log('');
        });
    }

    await pool.end();
    console.log('\n✅ Sync complete!');
}

main().catch(console.error);
