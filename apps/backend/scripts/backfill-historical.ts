import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config as dotenvConfig } from 'dotenv';
import { eq, and } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenvConfig({ path: resolve(__dirname, '../.env') });

const { db } = await import('../src/db/index.js');
const { klines } = await import('../src/db/schema.js');

const BINANCE_FUTURES_API = 'https://fapi.binance.com/fapi/v1/klines';
const BATCH_SIZE = 1000;
const RATE_LIMIT_DELAY = 200;

interface KlineData {
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const fetchKlines = async (
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<KlineData[]> => {
  const url = `${BINANCE_FUTURES_API}?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=${BATCH_SIZE}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status}`);
  }

  const data = await response.json();
  return data.map((k: unknown[]) => ({
    openTime: k[0] as number,
    open: k[1] as string,
    high: k[2] as string,
    low: k[3] as string,
    close: k[4] as string,
    volume: k[5] as string,
    closeTime: k[6] as number,
    quoteVolume: k[7] as string,
    trades: k[8] as number,
    takerBuyBaseVolume: k[9] as string,
    takerBuyQuoteVolume: k[10] as string,
  }));
};

const getIntervalMs = (interval: string): number => {
  const map: Record<string, number> = {
    '1m': 60 * 1000,
    '3m': 3 * 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '2h': 2 * 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '8h': 8 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
  };
  return map[interval] || 60 * 1000;
};

const backfillHistorical = async (
  symbol: string,
  interval: string,
  startDate: string,
  endDate: string,
  marketType: 'SPOT' | 'FUTURES'
) => {
  const startTime = new Date(startDate).getTime();
  const endTime = new Date(endDate).getTime();
  const intervalMs = getIntervalMs(interval);

  const expectedCandles = Math.floor((endTime - startTime) / intervalMs);
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Backfilling ${symbol} ${interval} ${marketType}`);
  console.log(`Period: ${startDate} to ${endDate}`);
  console.log(`Expected candles: ~${expectedCandles}`);
  console.log('='.repeat(70));

  let currentStart = startTime;
  let totalInserted = 0;
  let totalSkipped = 0;
  let batchNum = 0;

  while (currentStart < endTime) {
    batchNum++;
    const batchEnd = Math.min(currentStart + BATCH_SIZE * intervalMs, endTime);

    try {
      const klinesData = await fetchKlines(symbol, interval, currentStart, batchEnd);

      if (klinesData.length === 0) {
        console.log(`\n  No data returned for batch ${batchNum}, advancing...`);
        currentStart = batchEnd;
        continue;
      }

      let batchInserted = 0;
      let batchSkipped = 0;

      for (const kline of klinesData) {
        const existing = await db.query.klines.findFirst({
          where: and(
            eq(klines.symbol, symbol),
            eq(klines.interval, interval),
            eq(klines.marketType, marketType),
            eq(klines.openTime, new Date(kline.openTime))
          ),
        });

        if (existing) {
          batchSkipped++;
          continue;
        }

        await db.insert(klines).values({
          symbol,
          interval,
          marketType,
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

        batchInserted++;
      }

      totalInserted += batchInserted;
      totalSkipped += batchSkipped;

      const progress = ((currentStart - startTime) / (endTime - startTime) * 100).toFixed(1);
      process.stdout.write(
        `\r  [${progress}%] Batch ${batchNum}: +${batchInserted} inserted, ${batchSkipped} skipped | Total: ${totalInserted}`
      );

      currentStart = klinesData[klinesData.length - 1].openTime + intervalMs;
      await sleep(RATE_LIMIT_DELAY);
    } catch (error) {
      console.error(`\n  Error in batch ${batchNum}:`, error);
      await sleep(1000);
      currentStart = batchEnd;
    }
  }

  console.log(`\n\n✅ Backfill complete for ${symbol} ${interval}:`);
  console.log(`  Total inserted: ${totalInserted}`);
  console.log(`  Total skipped: ${totalSkipped}`);

  return { inserted: totalInserted, skipped: totalSkipped };
};

const main = async () => {
  console.log('📊 Historical Kline Backfill - Bear Market 2022');
  console.log(`Started at: ${new Date().toISOString()}`);

  const symbol = process.argv[2] || 'BTCUSDT';
  const interval = process.argv[3] || '30m';
  const startDate = process.argv[4] || '2021-11-01';
  const endDate = process.argv[5] || '2022-12-31';
  const marketType = (process.argv[6] || 'FUTURES') as 'SPOT' | 'FUTURES';

  console.log(`\nConfig: ${symbol} ${interval} ${marketType}`);
  console.log(`Period: ${startDate} to ${endDate}`);

  try {
    await backfillHistorical(symbol, interval, startDate, endDate, marketType);
    console.log('\n✅ All done!');
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }

  await db.$client.end();
  process.exit(0);
};

main();
