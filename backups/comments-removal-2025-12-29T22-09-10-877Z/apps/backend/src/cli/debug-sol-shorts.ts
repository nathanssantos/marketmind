import { fetchHistoricalKlinesFromAPI } from '../services/binance-historical';
import { calculateEMA } from '@marketmind/indicators';

async function debugSolShorts() {
  console.log('=== Debug SOL SHORT Trades ===\n');

  const start = new Date('2023-11-20');
  const end = new Date('2024-10-01');

  console.log('Fetching SOL data with warmup...');
  const klines = await fetchHistoricalKlinesFromAPI('SOLUSDT', '4h', start, end);

  console.log(`Total klines: ${klines.length}`);

  const ema200 = calculateEMA(klines as any, 200);

  console.log(`EMA200 first valid at index: ${ema200.findIndex(v => v !== null)}`);

  const shortTrades = [
    { entry: 86.41, date: '2024-01-XX', note: 'Trade #3 from results' },
    { entry: 189.13, date: '2024-0X-XX', note: 'Trade #9 from results' },
    { entry: 184.81, date: '2024-0X-XX', note: 'Trade #10 from results' },
  ];

  console.log('\n=== Checking SHORT entries ===');

  for (let i = 250; i < klines.length; i++) {
    const kline = klines[i];
    const close = parseFloat(kline.close);
    const ema = ema200[i] ?? null;

    for (const trade of shortTrades) {
      if (Math.abs(close - trade.entry) < 0.5) {
        const date = new Date(kline.openTime).toISOString();
        const isBelowEMA = ema !== null && close < ema;
        console.log(`\n${trade.note}:`);
        console.log(`  Date: ${date}`);
        console.log(`  Close: $${close.toFixed(2)}`);
        console.log(`  EMA200: $${ema?.toFixed(2) || 'NULL'}`);
        console.log(`  Below EMA200: ${isBelowEMA ? 'YES (SHORT allowed)' : 'NO (SHORT should be blocked)'}`);
      }
    }
  }

  console.log('\n=== Sample of price vs EMA200 during 2024 ===');

  const userStartIdx = klines.findIndex(k => k.openTime >= new Date('2024-01-01').getTime());
  console.log(`User start date (2024-01-01) is at index: ${userStartIdx}`);

  for (let i = userStartIdx; i < Math.min(userStartIdx + 20, klines.length); i++) {
    const k = klines[i];
    const close = parseFloat(k.close);
    const ema = ema200[i] ?? null;
    const date = new Date(k.openTime).toISOString().slice(0, 10);
    const trend = ema !== null ? (close > ema ? 'BULL' : 'BEAR') : 'N/A';
    console.log(`${date}: Close=$${close.toFixed(2)}, EMA200=$${ema?.toFixed(2) ?? 'NULL'}, Trend=${trend}`);
  }

  console.log('\n=== Count days above/below EMA200 in trading period ===');
  let above = 0, below = 0, nullCount = 0;
  for (let i = userStartIdx; i < klines.length; i++) {
    const close = parseFloat(klines[i].close);
    const ema = ema200[i] ?? null;
    if (ema === null) nullCount++;
    else if (close > ema) above++;
    else below++;
  }
  console.log(`Above EMA200: ${above} bars (LONG allowed)`);
  console.log(`Below EMA200: ${below} bars (SHORT allowed)`);
  console.log(`EMA200 NULL: ${nullCount} bars (filter bypassed!)`);
}

debugSolShorts().catch(console.error);
