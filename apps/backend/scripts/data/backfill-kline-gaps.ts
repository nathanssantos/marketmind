import { and, eq } from 'drizzle-orm';
import { db } from '../src/db';
import { klines } from '../src/db/schema';

interface BinanceKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
}

const BINANCE_API = 'https://api.binance.com/api/v3/klines';

const fetchBinanceKlines = async (
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<BinanceKline[]> => {
  const url = `${BINANCE_API}?symbol=${symbol.toUpperCase()}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=1000`;
  
  console.log(`  Fetching from Binance: ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.map((k: any[]) => ({
    openTime: k[0],
    open: k[1],
    high: k[2],
    low: k[3],
    close: k[4],
    volume: k[5],
    closeTime: k[6],
    quoteVolume: k[7],
    trades: k[8],
    takerBuyBaseVolume: k[9],
    takerBuyQuoteVolume: k[10],
  }));
};

const backfillGap = async (
  symbol: string,
  interval: string,
  gapTimestamps: number[]
) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Backfilling ${symbol} ${interval}`);
  console.log(`Gap: ${gapTimestamps.length} candles from ${new Date(gapTimestamps[0]).toISOString()}`);
  console.log('='.repeat(60));

  const startTime = gapTimestamps[0];
  const endTime = gapTimestamps[gapTimestamps.length - 1] + 60 * 60 * 1000;

  const binanceKlines = await fetchBinanceKlines(symbol, interval, startTime, endTime);
  
  const missingKlines = binanceKlines.filter(bk => 
    gapTimestamps.includes(bk.openTime)
  );

  console.log(`\n  Found ${missingKlines.length} candles to insert`);

  let inserted = 0;
  let skipped = 0;

  for (const kline of missingKlines) {
    try {
      const existing = await db.query.klines.findFirst({
        where: and(
          eq(klines.symbol, symbol),
          eq(klines.interval, interval),
          eq(klines.openTime, new Date(kline.openTime))
        ),
      });

      if (existing) {
        skipped++;
        continue;
      }

      await db.insert(klines).values({
        symbol,
        interval,
        openTime: new Date(kline.openTime),
        closeTime: new Date(kline.closeTime),
        open: kline.open,
        high: kline.high,
        low: kline.low,
        close: kline.close,
        volume: kline.volume,
        quoteVolume: kline.quoteVolume,
        trades: kline.trades,
        takerBuyBaseVolume: kline.takerBuyBaseVolume,
        takerBuyQuoteVolume: kline.takerBuyQuoteVolume,
      });

      inserted++;
      
      if (inserted % 10 === 0) {
        process.stdout.write(`\r  Inserted: ${inserted}/${missingKlines.length}`);
      }
    } catch (error) {
      console.error(`\n  Error inserting kline at ${new Date(kline.openTime).toISOString()}:`, error);
    }
  }

  console.log(`\n\n✅ Backfill complete:`);
  console.log(`  Inserted: ${inserted} candles`);
  console.log(`  Skipped (already existed): ${skipped} candles`);
};

const main = async () => {
  try {
    console.log('🔧 MarketMind Kline Gap Backfill');
    console.log(`Started at: ${new Date().toISOString()}\n`);

    console.log('📊 Critical gap found in ETHUSDT 15m');
    console.log('   52 consecutive candles missing from 2025-12-10 04:00 to 16:45\n');

    const ethGapStart = 1765339200000;
    const ethGapEnd = 1765385100000;
    const ethGapTimestamps: number[] = [];
    
    for (let t = ethGapStart; t <= ethGapEnd; t += 15 * 60 * 1000) {
      ethGapTimestamps.push(t);
    }

    await backfillGap('ETHUSDT', '15m', ethGapTimestamps);

    console.log('\n' + '='.repeat(60));
    console.log('✓ Backfill complete - Run check-kline-gaps.ts to verify');
    console.log('='.repeat(60));
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during backfill:', error);
    console.error(error);
    process.exit(1);
  }
};

main();
