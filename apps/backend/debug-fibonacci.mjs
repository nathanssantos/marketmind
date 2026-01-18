import { calculateFibonacciProjection } from '@marketmind/indicators';
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

function convertBinanceKline(k) {
    return {
        openTime: k[0],
        open: k[1],
        high: k[2],
        low: k[3],
        close: k[4],
        volume: k[5],
        closeTime: k[6],
        quoteAssetVolume: k[7],
        trades: k[8],
        takerBuyBaseAssetVolume: k[9],
        takerBuyQuoteAssetVolume: k[10],
    };
}

async function main() {
    const wallet = await pool.query("SELECT id, api_key_encrypted, api_secret_encrypted FROM wallets WHERE wallet_type = 'live' LIMIT 1");
    const apiKey = decrypt(wallet.rows[0].api_key_encrypted);
    const apiSecret = decrypt(wallet.rows[0].api_secret_encrypted);

    const client = new Binance.USDMClient({ api_key: apiKey, api_secret: apiSecret });

    const trades = await pool.query(`
    SELECT id, symbol, side, trigger_kline_open_time, entry_price, quantity
    FROM trade_executions WHERE status = 'open'
  `);

    for (const trade of trades.rows) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📊 ${trade.symbol}`);

        const triggerTime = Number(trade.trigger_kline_open_time);
        console.log(`Trigger time: ${triggerTime} (${new Date(triggerTime).toISOString()})`);

        const rawKlines = await client.getKlines({
            symbol: trade.symbol,
            interval: '30m',
            startTime: triggerTime - (150 * 30 * 60 * 1000),
            endTime: triggerTime + (30 * 60 * 1000),
            limit: 200,
        });

        const klines = rawKlines.map(convertBinanceKline);
        console.log(`Fetched ${klines.length} klines`);

        const entryIndex = klines.findIndex(k => k.openTime === triggerTime);
        console.log(`Entry index: ${entryIndex}`);

        if (entryIndex === -1) {
            console.log('❌ Entry kline not found!');
            continue;
        }

        const direction = trade.side;
        const projection = calculateFibonacciProjection(klines, entryIndex, 100, direction);

        if (!projection) {
            console.log('❌ Fibonacci projection failed!');
            continue;
        }

        console.log(`\nFibonacci Projection:`);
        console.log(`  Swing Low: ${projection.swingLow.price} (index: ${projection.swingLow.index})`);
        console.log(`  Swing High: ${projection.swingHigh.price} (index: ${projection.swingHigh.index})`);
        console.log(`  Range: ${projection.range}`);

        console.log(`\nLevels:`);
        projection.levels.forEach(l => {
            console.log(`  ${l.label}: ${l.price.toFixed(6)}`);
        });

        const level200 = projection.levels.find(l => Math.abs(l.level - 2) < 0.001);
        const tp = level200?.price;

        const slBuffer = projection.range * 0.02;
        const sl = direction === 'LONG'
            ? projection.swingLow.price - slBuffer
            : projection.swingHigh.price + slBuffer;

        console.log(`\n✅ Calculated values:`);
        console.log(`  SL: ${sl.toFixed(6)} (swing low ${projection.swingLow.price} - buffer ${slBuffer.toFixed(6)})`);
        console.log(`  TP: ${tp?.toFixed(6)} (200% level)`);
        console.log(`  Entry: ${trade.entry_price}`);
    }

    await pool.end();
}

main().catch(console.error);
