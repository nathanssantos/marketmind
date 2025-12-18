import { db } from '../db/index.js';
import { klines } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';

const SYMBOLS = ['XRPUSDT', 'SOLUSDT', 'ETHUSDT', 'BTCUSDT'];
const INTERVAL = '30m';

async function checkKlines() {
  for (const symbol of SYMBOLS) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`=== ${symbol} ${INTERVAL} ===`);
    console.log(`${'='.repeat(60)}`);

    const dbKlines = await db.query.klines.findMany({
      where: and(
        eq(klines.symbol, symbol),
        eq(klines.interval, INTERVAL)
      ),
      orderBy: [desc(klines.openTime)],
      limit: 50,
    });

    console.log('DB Klines:', dbKlines.length);

    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${INTERVAL}&limit=50`);
    const apiKlines = await response.json() as any[];

    console.log('API Klines:', apiKlines.length);

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

    let mismatches = 0;
    let missing = 0;
    const mismatchDetails: any[] = [];

    for (const dbK of dbKlines.slice(0, 30)) {
      const openTimeMs = dbK.openTime.getTime();
      const apiK = apiMap.get(openTimeMs);

      if (!apiK) {
        missing++;
        continue;
      }

      const dbOpen = parseFloat(dbK.open);
      const dbHigh = parseFloat(dbK.high);
      const dbLow = parseFloat(dbK.low);
      const dbClose = parseFloat(dbK.close);

      const apiOpen = parseFloat(apiK.open);
      const apiHigh = parseFloat(apiK.high);
      const apiLow = parseFloat(apiK.low);
      const apiClose = parseFloat(apiK.close);

      const tolerance = 0.0001;
      const openDiff = Math.abs(dbOpen - apiOpen);
      const highDiff = Math.abs(dbHigh - apiHigh);
      const lowDiff = Math.abs(dbLow - apiLow);
      const closeDiff = Math.abs(dbClose - apiClose);

      if (openDiff > tolerance || highDiff > tolerance || lowDiff > tolerance || closeDiff > tolerance) {
        mismatches++;
        mismatchDetails.push({
          time: new Date(openTimeMs).toISOString(),
          db: { open: dbOpen, high: dbHigh, low: dbLow, close: dbClose },
          api: { open: apiOpen, high: apiHigh, low: apiLow, close: apiClose },
          diff: { open: openDiff, high: highDiff, low: lowDiff, close: closeDiff },
        });
      }
    }

    console.log('\n--- Summary ---');
    console.log('Mismatches:', mismatches);
    console.log('Missing in API:', missing);

    if (mismatchDetails.length > 0) {
      console.log('\n--- Mismatch Details ---');
      for (const m of mismatchDetails.slice(0, 10)) {
        console.log(`\nTime: ${m.time}`);
        console.log(`  DB:  O:${m.db.open} H:${m.db.high} L:${m.db.low} C:${m.db.close}`);
        console.log(`  API: O:${m.api.open} H:${m.api.high} L:${m.api.low} C:${m.api.close}`);
        console.log(`  Diff: O:${m.diff.open.toFixed(6)} H:${m.diff.high.toFixed(6)} L:${m.diff.low.toFixed(6)} C:${m.diff.close.toFixed(6)}`);
      }
    }
  }

  process.exit(0);
}

checkKlines().catch(e => {
  console.error(e);
  process.exit(1);
});
