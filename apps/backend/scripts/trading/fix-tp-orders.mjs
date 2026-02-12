import Binance from 'binance';
import crypto from 'crypto';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

function decrypt(encryptedText) {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

async function getWalletCredentials(walletId) {
    const result = await pool.query(`
    SELECT api_key_encrypted, api_secret_encrypted 
    FROM wallets WHERE id = $1
  `, [walletId]);

    if (!result.rows[0]) throw new Error('Wallet not found');

    const apiKey = decrypt(result.rows[0].api_key_encrypted);
    const apiSecret = decrypt(result.rows[0].api_secret_encrypted);

    return { apiKey, apiSecret };
}

async function getSymbolPrecision(client, symbol) {
    const info = await client.getExchangeInfo();
    const symbolInfo = info.symbols.find(s => s.symbol === symbol);
    if (!symbolInfo) throw new Error(`Symbol ${symbol} not found`);

    const priceFilter = symbolInfo.filters.find(f => f.filterType === 'PRICE_FILTER');
    const lotSize = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE');

    const tickSize = parseFloat(priceFilter.tickSize);
    const stepSize = parseFloat(lotSize.stepSize);

    const pricePrecision = Math.round(-Math.log10(tickSize));
    const qtyPrecision = Math.round(-Math.log10(stepSize));

    return { pricePrecision, qtyPrecision, tickSize, stepSize };
}

function formatPrice(price, tickSize) {
    const precision = Math.round(-Math.log10(tickSize));
    return parseFloat(price.toFixed(precision)).toString();
}

function formatQty(qty, stepSize) {
    const precision = Math.round(-Math.log10(stepSize));
    return parseFloat(qty.toFixed(precision)).toString();
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    console.log(dryRun ? '🔍 DRY RUN MODE' : '🚀 EXECUTING CHANGES');

    const trades = await pool.query(`
    SELECT te.id, te.symbol, te.side, te.entry_price, te.stop_loss, te.take_profit,
           te.stop_loss_algo_id, te.take_profit_algo_id, te.quantity, te.wallet_id
    FROM trade_executions te
    WHERE te.status = 'open'
  `);

    if (trades.rows.length === 0) {
        console.log('No open trades found');
        return;
    }

    const walletId = trades.rows[0].wallet_id;
    const { apiKey, apiSecret } = await getWalletCredentials(walletId);

    const client = new Binance.USDMClient({
        api_key: apiKey,
        api_secret: apiSecret,
    });

    const corrections = [
        { symbol: 'DOTUSDT', newTP: 2.40 },
        { symbol: 'BNBUSDT', newTP: 991.94 },
    ];

    for (const trade of trades.rows) {
        const correction = corrections.find(c => c.symbol === trade.symbol);
        if (!correction) {
            console.log(`⏭️ No correction for ${trade.symbol}`);
            continue;
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log(`📊 ${trade.symbol}`);
        console.log(`Old TP: ${trade.take_profit}`);
        console.log(`New TP: ${correction.newTP}`);
        console.log(`TP Algo ID: ${trade.take_profit_algo_id}`);

        if (dryRun) {
            console.log('Would cancel old TP and create new one');
            continue;
        }

        try {
            console.log('Checking if old TP order exists...');
            try {
                await client.cancelAlgoOrder({ algoId: Number(trade.take_profit_algo_id) });
                console.log('✅ Old TP Cancelled');
            } catch (e) {
                console.log('⚠️ Old TP already cancelled or not found');
            }

            const { tickSize, stepSize } = await getSymbolPrecision(client, trade.symbol);
            const quantity = parseFloat(trade.quantity);
            const side = trade.side === 'LONG' ? 'SELL' : 'BUY';

            console.log('Creating new TP algo order...');
            const newOrder = await client.submitNewAlgoOrder({
                algoType: 'CONDITIONAL',
                symbol: trade.symbol,
                side,
                type: 'TAKE_PROFIT_MARKET',
                triggerPrice: formatPrice(correction.newTP, tickSize),
                quantity: formatQty(quantity, stepSize),
                reduceOnly: 'true',
                workingType: 'CONTRACT_PRICE',
            });

            console.log(`✅ New TP order created: ${newOrder.algoId}`);

            await pool.query(`
        UPDATE trade_executions
        SET take_profit = $1,
            take_profit_algo_id = $2,
            updated_at = NOW()
        WHERE id = $3
      `, [correction.newTP, newOrder.algoId, trade.id]);

            console.log('✅ Database updated');

        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
        }
    }

    await pool.end();
    console.log('\n✅ Done!');
}

main().catch(console.error);
