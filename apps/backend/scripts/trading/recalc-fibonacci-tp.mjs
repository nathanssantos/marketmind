import Binance from 'binance';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function calculateFibonacciForTrade(symbol, entryTimestamp, direction) {
    const client = new Binance.USDMClient({
        api_key: process.env.BINANCE_API_KEY,
        api_secret: process.env.BINANCE_API_SECRET,
    });

    const endTime = entryTimestamp + 3600000;
    const startTime = entryTimestamp - (100 * 30 * 60 * 1000);

    console.log(`\n📊 Fetching klines for ${symbol}`);
    console.log(`Entry timestamp: ${entryTimestamp} (${new Date(entryTimestamp).toISOString()})`);

    const klines = await client.getKlines({
        symbol,
        interval: '30m',
        startTime,
        endTime,
        limit: 150,
    });

    console.log(`Got ${klines.length} klines`);

    const entryIndex = klines.findIndex(k => k[0] === entryTimestamp);
    console.log(`Entry kline index: ${entryIndex}`);

    if (entryIndex === -1) {
        console.log('Entry kline not found, using closest');
        return null;
    }

    const lookback = 100;
    const startIdx = Math.max(0, entryIndex - lookback);
    const endIdx = entryIndex;

    if (endIdx - startIdx < 20) {
        console.log('Not enough klines for Fibonacci');
        return null;
    }

    let swingLow = { price: Infinity, index: -1 };
    let swingHigh = { price: -Infinity, index: -1 };

    for (let i = startIdx; i <= endIdx; i++) {
        const low = parseFloat(klines[i][3]);
        const high = parseFloat(klines[i][2]);

        if (low < swingLow.price) {
            swingLow = { price: low, index: i };
        }
        if (high > swingHigh.price) {
            swingHigh = { price: high, index: i };
        }
    }

    console.log(`Swing Low: ${swingLow.price} at index ${swingLow.index}`);
    console.log(`Swing High: ${swingHigh.price} at index ${swingHigh.index}`);

    const range = swingHigh.price - swingLow.price;
    console.log(`Range: ${range}`);

    let tp200;
    if (direction === 'LONG') {
        tp200 = swingHigh.price + range;
    } else {
        tp200 = swingLow.price - range;
    }

    console.log(`TP 200%: ${tp200}`);

    return {
        swingLow: swingLow.price,
        swingHigh: swingHigh.price,
        range,
        tp200,
    };
}

async function main() {
    const trades = await pool.query(`
    SELECT id, symbol, side, trigger_kline_open_time, entry_price, stop_loss, take_profit
    FROM trade_executions 
    WHERE status = 'open'
  `);

    console.log(`Found ${trades.rows.length} open trades`);

    for (const trade of trades.rows) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Processing: ${trade.symbol} (${trade.id})`);
        console.log(`Current TP: ${trade.take_profit}`);

        const direction = trade.side === 'LONG' ? 'LONG' : 'SHORT';
        const entryTimestamp = Number(trade.trigger_kline_open_time);

        const fib = await calculateFibonacciForTrade(trade.symbol, entryTimestamp, direction);

        if (fib) {
            console.log(`\nNew TP should be: ${fib.tp200}`);
            console.log(`Old TP was: ${trade.take_profit}`);
            console.log(`Difference: ${(fib.tp200 - parseFloat(trade.take_profit)).toFixed(4)}`);
        }
    }

    await pool.end();
}

main().catch(console.error);
