import { db } from '../db/index.js';
import { klines } from '../db/schema.js';
import { eq, and, desc, gte, lte } from 'drizzle-orm';

async function checkXrpSpike() {
  const symbol = 'XRPUSDT';
  const interval = '30m';

  const startTime = new Date('2025-12-17T10:00:00Z').getTime();
  const endTime = new Date('2025-12-17T20:00:00Z').getTime();

  console.log('=== Checking XRP spike period (10:00 - 20:00 UTC) ===\n');

  const dbKlines = await db.query.klines.findMany({
    where: and(
      eq(klines.symbol, symbol),
      eq(klines.interval, interval),
      gte(klines.openTime, new Date(startTime)),
      lte(klines.openTime, new Date(endTime))
    ),
    orderBy: [desc(klines.openTime)],
  });

  console.log('DB Klines in range:', dbKlines.length);

  const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=100`);
  const apiKlines = await response.json() as any[];

  console.log('API Klines in range:', apiKlines.length);

  const apiMap = new Map();
  for (const k of apiKlines) {
    apiMap.set(k[0], {
      openTime: k[0],
      open: k[1],
      high: k[2],
      low: k[3],
      close: k[4],
      volume: k[5],
    });
  }

  console.log('\n--- All candles in period (DB vs API) ---\n');

  const dbByTime = new Map();
  for (const dbK of dbKlines) {
    dbByTime.set(dbK.openTime.getTime(), dbK);
  }

  const allTimes = new Set([...apiMap.keys(), ...Array.from(dbByTime.keys())]);
  const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);

  for (const t of sortedTimes) {
    const time = new Date(t).toISOString();
    const dbK = dbByTime.get(t);
    const apiK = apiMap.get(t);

    const dbHigh = dbK ? parseFloat(dbK.high) : null;
    const apiHigh = apiK ? parseFloat(apiK.high) : null;

    const status = [];
    if (!dbK) status.push('✗ NOT IN DB');
    if (!apiK) status.push('✗ NOT IN API');

    if (dbK && apiK) {
      const highDiff = Math.abs(dbHigh! - apiHigh!);
      if (highDiff > 0.001) {
        status.push(`!  HIGH DIFF: ${highDiff.toFixed(4)}`);
      }
    }

    const statusStr = status.length > 0 ? status.join(' | ') : '✓';

    console.log(`${time} | DB High: ${dbHigh?.toFixed(4) ?? 'N/A'} | API High: ${apiHigh?.toFixed(4) ?? 'N/A'} | ${statusStr}`);
  }

  console.log('\n--- Highest prices ---');

  const dbMaxHigh = dbKlines.reduce((max, k) => {
    const h = parseFloat(k.high);
    return h > max.price ? { price: h, time: k.openTime } : max;
  }, { price: 0, time: new Date() });

  let apiMaxHigh = { price: 0, time: 0 };
  for (const k of apiKlines) {
    const h = parseFloat(k[2]);
    if (h > apiMaxHigh.price) {
      apiMaxHigh = { price: h, time: k[0] };
    }
  }

  console.log(`DB Max High:  ${dbMaxHigh.price.toFixed(4)} at ${dbMaxHigh.time.toISOString()}`);
  console.log(`API Max High: ${apiMaxHigh.price.toFixed(4)} at ${new Date(apiMaxHigh.time).toISOString()}`);

  process.exit(0);
}

checkXrpSpike().catch(e => {
  console.error(e);
  process.exit(1);
});
