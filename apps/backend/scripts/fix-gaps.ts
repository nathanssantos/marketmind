import type { Interval, MarketType } from '@marketmind/types';
import { INTERVAL_MS } from '@marketmind/types';
import { and, asc, eq, gte } from 'drizzle-orm';
import { db } from '../src/db';
import { klines } from '../src/db/schema';

const BINANCE_SPOT_API = 'https://api.binance.com/api/v3/klines';
const BINANCE_FUTURES_API = 'https://fapi.binance.com/fapi/v1/klines';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Gap {
  start: number;
  end: number;
  count: number;
}

const detectGaps = async (
  symbol: string,
  interval: Interval,
  marketType: MarketType,
  lookbackPeriods: number
): Promise<Gap[]> => {
  const intervalMs = INTERVAL_MS[interval];
  const now = Date.now();
  const startTime = now - intervalMs * lookbackPeriods;

  const dbKlines = await db.query.klines.findMany({
    where: and(
      eq(klines.symbol, symbol),
      eq(klines.interval, interval),
      eq(klines.marketType, marketType),
      gte(klines.openTime, new Date(startTime))
    ),
    orderBy: [asc(klines.openTime)],
  });

  console.log(`  Found ${dbKlines.length} klines in database for last ${lookbackPeriods} periods`);

  if (dbKlines.length === 0) {
    return [{ start: startTime, end: now, count: lookbackPeriods }];
  }

  const gaps: Gap[] = [];

  const firstKline = dbKlines[0];
  if (firstKline && firstKline.openTime.getTime() > startTime + intervalMs) {
    const missingAtStart = Math.floor((firstKline.openTime.getTime() - startTime) / intervalMs);
    if (missingAtStart > 0) {
      gaps.push({ start: startTime, end: firstKline.openTime.getTime() - intervalMs, count: missingAtStart });
    }
  }

  for (let i = 1; i < dbKlines.length; i++) {
    const prevKline = dbKlines[i - 1];
    const currKline = dbKlines[i];
    if (!prevKline || !currKline) continue;

    const prevTime = prevKline.openTime.getTime();
    const currTime = currKline.openTime.getTime();
    const expectedDiff = intervalMs;
    const actualDiff = currTime - prevTime;

    if (actualDiff > expectedDiff * 1.5) {
      const missingCount = Math.floor(actualDiff / intervalMs) - 1;
      gaps.push({ start: prevTime + intervalMs, end: currTime - intervalMs, count: missingCount });
    }
  }

  const lastKline = dbKlines[dbKlines.length - 1];
  if (lastKline) {
    const lastTime = lastKline.openTime.getTime();
    const expectedLatestTime = Math.floor(now / intervalMs) * intervalMs;
    const missingAtEnd = Math.floor((expectedLatestTime - lastTime) / intervalMs) - 1;
    if (missingAtEnd > 1) {
      gaps.push({ start: lastTime + intervalMs, end: expectedLatestTime, count: missingAtEnd });
    }
  }

  return gaps;
};

const fetchBinanceKlines = async (
  symbol: string,
  interval: Interval,
  startTime: number,
  endTime: number,
  marketType: MarketType
): Promise<any[]> => {
  const baseUrl = marketType === 'FUTURES' ? BINANCE_FUTURES_API : BINANCE_SPOT_API;
  const allKlines: any[] = [];
  let currentStart = startTime;
  const intervalMs = INTERVAL_MS[interval];

  while (currentStart < endTime) {
    const url = `${baseUrl}?symbol=${symbol}&interval=${interval}&startTime=${currentStart}&endTime=${endTime}&limit=1000`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Binance API error: ${response.status}`);

    const data = await response.json();
    if (data.length === 0) break;

    allKlines.push(...data);
    currentStart = data[data.length - 1][0] + intervalMs;
    await sleep(100);
  }

  return allKlines;
};

const fillGap = async (
  symbol: string,
  interval: Interval,
  marketType: MarketType,
  gap: Gap
): Promise<number> => {
  console.log(`  Filling gap: ${new Date(gap.start).toISOString()} → ${new Date(gap.end).toISOString()} (${gap.count} candles)`);

  const binanceKlines = await fetchBinanceKlines(symbol, interval, gap.start, gap.end, marketType);
  console.log(`    Fetched ${binanceKlines.length} candles from Binance`);

  let inserted = 0;

  for (const k of binanceKlines) {
    try {
      await db
        .insert(klines)
        .values({
          symbol,
          interval,
          marketType,
          openTime: new Date(k[0]),
          open: k[1],
          high: k[2],
          low: k[3],
          close: k[4],
          volume: k[5],
          closeTime: new Date(k[6]),
          quoteVolume: k[7],
          trades: k[8],
          takerBuyBaseVolume: k[9] || '0',
          takerBuyQuoteVolume: k[10] || '0',
        })
        .onConflictDoNothing();
      inserted++;
    } catch {
      // Ignore duplicates
    }
  }

  console.log(`    Inserted ${inserted} candles`);
  return inserted;
};

const main = async () => {
  const symbol = process.argv[2] || 'BTCUSDT';
  const interval = (process.argv[3] || '2h') as Interval;
  const marketType = (process.argv[4] || 'FUTURES') as MarketType;
  const lookbackPeriods = parseInt(process.argv[5] || '500', 10);

  console.log('═'.repeat(60));
  console.log('🔧 MarketMind Gap Fixer');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('═'.repeat(60));
  console.log(`\nSymbol: ${symbol}`);
  console.log(`Interval: ${interval}`);
  console.log(`Market Type: ${marketType}`);
  console.log(`Lookback Periods: ${lookbackPeriods}`);

  console.log('\n📊 Detecting gaps...');
  const gaps = await detectGaps(symbol, interval, marketType, lookbackPeriods);

  if (gaps.length === 0) {
    console.log('\n✅ No gaps detected! Data is complete.');
    process.exit(0);
  }

  console.log(`\n⚠️  Found ${gaps.length} gap(s):`);
  gaps.forEach((g, i) => {
    console.log(`  ${i + 1}. ${new Date(g.start).toISOString()} → ${new Date(g.end).toISOString()} (${g.count} candles)`);
  });

  console.log('\n🔄 Filling gaps...');
  let totalInserted = 0;

  for (const gap of gaps) {
    const inserted = await fillGap(symbol, interval, marketType, gap);
    totalInserted += inserted;
  }

  console.log('\n═'.repeat(60));
  console.log(`✅ Done! Inserted ${totalInserted} candles total.`);
  console.log('═'.repeat(60));

  process.exit(0);
};

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
