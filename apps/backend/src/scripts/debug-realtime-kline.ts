import { db } from '../db/index.js';
import { klines } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';

async function debugRealtimeKline() {
  const symbol = 'XRPUSDT';
  const interval = '30m';

  console.log(`\n=== Debug Realtime Kline for ${symbol} ${interval} ===\n`);

  const dbKlines = await db.query.klines.findMany({
    where: and(
      eq(klines.symbol, symbol),
      eq(klines.interval, interval)
    ),
    orderBy: [desc(klines.openTime)],
    limit: 5,
  });

  console.log('=== Last 5 klines in DB ===');
  for (const k of dbKlines) {
    console.log({
      openTime: k.openTime.toISOString(),
      openTimeMs: k.openTime.getTime(),
      close: k.close,
      high: k.high,
      low: k.low,
    });
  }

  const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=5`);
  const apiKlines = await response.json() as any[];

  console.log('\n=== Last 5 klines from API ===');
  for (const k of apiKlines) {
    console.log({
      openTime: new Date(k[0]).toISOString(),
      openTimeMs: k[0],
      close: k[4],
      high: k[2],
      low: k[3],
    });
  }

  const lastDbKline = dbKlines[0];
  const lastApiKline = apiKlines[apiKlines.length - 1];

  if (lastDbKline && lastApiKline) {
    console.log('\n=== Comparison ===');
    console.log('Last DB kline openTime:', lastDbKline.openTime.toISOString(), '(', lastDbKline.openTime.getTime(), ')');
    console.log('Last API kline openTime:', new Date(lastApiKline[0]).toISOString(), '(', lastApiKline[0], ')');

    const timeDiff = lastDbKline.openTime.getTime() - lastApiKline[0];
    console.log('Time difference:', timeDiff, 'ms');

    if (timeDiff !== 0) {
      console.log('!  MISMATCH: DB and API have different latest klines!');
    } else {
      console.log('✓ Latest klines match');
    }
  }

  const now = Date.now();
  const intervalMs = 30 * 60 * 1000;
  const currentCandleOpenTime = Math.floor(now / intervalMs) * intervalMs;

  console.log('\n=== Current Candle Info ===');
  console.log('Current time:', new Date(now).toISOString());
  console.log('Expected current candle openTime:', new Date(currentCandleOpenTime).toISOString(), '(', currentCandleOpenTime, ')');

  const currentCandleInDb = dbKlines.find(k => k.openTime.getTime() === currentCandleOpenTime);
  console.log('Current candle in DB:', currentCandleInDb ? 'YES' : 'NO (expected - not closed yet)');

  process.exit(0);
}

debugRealtimeKline().catch(e => {
  console.error(e);
  process.exit(1);
});
