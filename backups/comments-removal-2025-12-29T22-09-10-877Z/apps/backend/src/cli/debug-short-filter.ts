import { fetchHistoricalKlinesFromAPI } from '../services/binance-historical';
import { calculateEMA } from '@marketmind/indicators';

async function debugShortFilter() {
  console.log('=== Debug SHORT Filter ===\n');

  const start = new Date('2023-11-20');
  const end = new Date('2024-10-01');

  const klines = await fetchHistoricalKlinesFromAPI('SOLUSDT', '4h', start, end);
  const ema200 = calculateEMA(klines as any, 200);

  const shortEntries = [
    { date: '2024-01-25T12:00:00.000Z', price: 86.41 },
    { date: '2024-04-25T00:00:00.000Z', price: 146.03 },
    { date: '2024-05-08T16:00:00.000Z', price: 145.48 },
    { date: '2024-05-11T00:00:00.000Z', price: 143.64 },
    { date: '2024-05-14T12:00:00.000Z', price: 142.92 },
    { date: '2024-06-07T16:00:00.000Z', price: 162.01 },
    { date: '2024-07-03T16:00:00.000Z', price: 140.43 },
    { date: '2024-07-07T20:00:00.000Z', price: 131.64 },
    { date: '2024-07-11T20:00:00.000Z', price: 135.73 },
    { date: '2024-08-11T16:00:00.000Z', price: 145.78 },
  ];

  console.log('Checking each SHORT entry against EMA200:\n');

  for (const entry of shortEntries) {
    const entryTime = new Date(entry.date).getTime();
    const idx = klines.findIndex(k => k.openTime === entryTime);

    if (idx === -1) {
      console.log(`${entry.date}: Kline NOT FOUND`);
      continue;
    }

    const kline = klines[idx];
    const close = parseFloat(kline.close);
    const ema = ema200[idx] ?? null;

    const isBelowEMA = ema !== null && close < ema;
    const status = isBelowEMA ? '✅ ALLOWED' : '❌ SHOULD BE BLOCKED';

    console.log(`${entry.date}:`);
    console.log(`  Close: $${close.toFixed(2)} (expected: $${entry.price.toFixed(2)})`);
    console.log(`  EMA200: $${ema?.toFixed(2) || 'NULL'}`);
    console.log(`  Result: ${status}`);
    console.log();
  }
}

debugShortFilter().catch(console.error);
