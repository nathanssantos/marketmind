import Binance from 'binance';
import crypto from 'crypto';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
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

    return { tickSize, stepSize };
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

    for (const trade of trades.rows) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📊 ${trade.symbol}`);
        console.log(`Entry: ${trade.entry_price}`);
        console.log(`SL: ${trade.stop_loss}`);
        console.log(`TP: ${trade.take_profit}`);
        console.log(`Quantity: ${trade.quantity}`);

        if (dryRun) {
            console.log('Would recreate SL and TP orders');
            continue;
        }

        try {
            const { tickSize, stepSize } = await getSymbolPrecision(client, trade.symbol);
            const quantity = parseFloat(trade.quantity);
            const closeSide = trade.side === 'LONG' ? 'SELL' : 'BUY';

            // Create SL order
            console.log('Creating SL algo order...');
            const slOrder = await client.submitNewAlgoOrder({
                algoType: 'CONDITIONAL',
                symbol: trade.symbol,
                side: closeSide,
                type: 'STOP_MARKET',
                triggerPrice: formatPrice(parseFloat(trade.stop_loss), tickSize),
                quantity: formatQty(quantity, stepSize),
                reduceOnly: 'true',
                workingType: 'CONTRACT_PRICE',
            });
            console.log('SL response:', JSON.stringify(slOrder, null, 2));
            console.log(`✅ SL order created: ${slOrder.algoId}`);

            // Create TP order
            console.log('Creating TP algo order...');
            const tpOrder = await client.submitNewAlgoOrder({
                algoType: 'CONDITIONAL',
                symbol: trade.symbol,
                side: closeSide,
                type: 'TAKE_PROFIT_MARKET',
                triggerPrice: formatPrice(parseFloat(trade.take_profit), tickSize),
                quantity: formatQty(quantity, stepSize),
                reduceOnly: 'true',
                workingType: 'CONTRACT_PRICE',
            });
            console.log('TP response:', JSON.stringify(tpOrder, null, 2));
            console.log(`✅ TP order created: ${tpOrder.algoId}`);

            // Update database
            await pool.query(`
        UPDATE trade_executions
        SET stop_loss_algo_id = $1,
            take_profit_algo_id = $2,
            updated_at = NOW()
        WHERE id = $3
      `, [slOrder.algoId, tpOrder.algoId, trade.id]);

            console.log('✅ Database updated');

        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            console.error(error);
        }
    }

    await pool.end();
    console.log('\n✅ Done!');
}

main().catch(console.error);
