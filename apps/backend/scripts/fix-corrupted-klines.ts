import { and, eq, gte, lte } from 'drizzle-orm';
import type { MarketType } from '@marketmind/types';
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

const SPOT_API = 'https://api.binance.com/api/v3/klines';
const FUTURES_API = 'https://fapi.binance.com/fapi/v1/klines';

const fetchBinanceKline = async (
  symbol: string,
  interval: string,
  timestamp: number,
  marketType: MarketType = 'FUTURES'
): Promise<BinanceKline | null> => {
  const baseUrl = marketType === 'FUTURES' ? FUTURES_API : SPOT_API;
  const url = `${baseUrl}?symbol=${symbol.toUpperCase()}&interval=${interval}&startTime=${timestamp}&limit=1`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Binance API error: ${response.status} ${response.statusText}`);

  const data = await response.json();
  if (data.length === 0) return null;

  const k = data[0];
  return {
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
  };
};

const fetchBinanceKlinesRange = async (
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number,
  marketType: MarketType = 'FUTURES'
): Promise<BinanceKline[]> => {
  const baseUrl = marketType === 'FUTURES' ? FUTURES_API : SPOT_API;
  const url = `${baseUrl}?symbol=${symbol.toUpperCase()}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=500`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Binance API error: ${response.status} ${response.statusText}`);

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

const fixCorruptedKline = async (
  symbol: string,
  interval: string,
  timestamp: number,
  description: string,
  marketType: MarketType = 'FUTURES'
) => {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`Fixing ${symbol} ${interval} ${marketType} - ${description}`);
  console.log(`Timestamp: ${new Date(timestamp).toISOString()}`);

  const binanceKline = await fetchBinanceKline(symbol, interval, timestamp, marketType);

  if (!binanceKline) {
    console.log('❌ Candle not found on Binance');
    return;
  }

  const openTime = new Date(timestamp);

  const existing = await db.query.klines.findFirst({
    where: and(
      eq(klines.symbol, symbol),
      eq(klines.interval, interval as any),
      eq(klines.marketType, marketType),
      eq(klines.openTime, openTime)
    ),
  });

  if (existing) {
    console.log('\nBefore (DB):');
    console.log(`  O=${existing.open} H=${existing.high} L=${existing.low} C=${existing.close} V=${existing.volume}`);
    console.log('\nCorrect (Binance):');
    console.log(`  O=${binanceKline.open} H=${binanceKline.high} L=${binanceKline.low} C=${binanceKline.close} V=${binanceKline.volume}`);

    await db
      .update(klines)
      .set({
        open: binanceKline.open,
        high: binanceKline.high,
        low: binanceKline.low,
        close: binanceKline.close,
        volume: binanceKline.volume,
        quoteVolume: binanceKline.quoteVolume,
        trades: binanceKline.trades,
        takerBuyBaseVolume: binanceKline.takerBuyBaseVolume,
        takerBuyQuoteVolume: binanceKline.takerBuyQuoteVolume,
        closeTime: new Date(binanceKline.closeTime),
      })
      .where(
        and(
          eq(klines.symbol, symbol),
          eq(klines.interval, interval as any),
          eq(klines.marketType, marketType),
          eq(klines.openTime, openTime)
        )
      );

    console.log('\n✅ Updated existing candle');
  } else {
    await db.insert(klines).values({
      symbol,
      interval: interval as any,
      marketType,
      openTime: new Date(binanceKline.openTime),
      closeTime: new Date(binanceKline.closeTime),
      open: binanceKline.open,
      high: binanceKline.high,
      low: binanceKline.low,
      close: binanceKline.close,
      volume: binanceKline.volume,
      quoteVolume: binanceKline.quoteVolume,
      trades: binanceKline.trades,
      takerBuyBaseVolume: binanceKline.takerBuyBaseVolume,
      takerBuyQuoteVolume: binanceKline.takerBuyQuoteVolume,
    });

    console.log('\n✅ Inserted missing candle');
  }
};

const fixKlinesInRange = async (
  symbol: string,
  interval: string,
  startTime: Date,
  endTime: Date,
  marketType: MarketType = 'FUTURES'
) => {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`Fixing ${symbol} ${interval} ${marketType} range`);
  console.log(`From: ${startTime.toISOString()}`);
  console.log(`To:   ${endTime.toISOString()}`);

  const existingKlines = await db.query.klines.findMany({
    where: and(
      eq(klines.symbol, symbol),
      eq(klines.interval, interval as any),
      eq(klines.marketType, marketType),
      gte(klines.openTime, startTime),
      lte(klines.openTime, endTime)
    ),
    orderBy: (klines, { asc }) => [asc(klines.openTime)],
  });

  console.log(`\nFound ${existingKlines.length} klines in database`);

  const binanceKlines = await fetchBinanceKlinesRange(
    symbol,
    interval,
    startTime.getTime(),
    endTime.getTime(),
    marketType
  );

  console.log(`Fetched ${binanceKlines.length} klines from Binance`);

  let corruptedCount = 0;
  let fixedCount = 0;

  for (const dbKline of existingKlines) {
    const binanceKline = binanceKlines.find((bk) => bk.openTime === dbKline.openTime.getTime());
    if (!binanceKline) continue;

    const priceDiff = Math.abs(parseFloat(dbKline.close) - parseFloat(binanceKline.close));
    const pctDiff = (priceDiff / parseFloat(binanceKline.close)) * 100;

    if (pctDiff > 0.01) {
      corruptedCount++;
      console.log(`\n⚠️  Corrupted: ${dbKline.openTime.toISOString()}`);
      console.log(`   DB: ${dbKline.close} | Binance: ${binanceKline.close} | Diff: ${pctDiff.toFixed(4)}%`);
    }
  }

  if (corruptedCount === 0) {
    console.log('\n✅ No corrupted klines found - data matches Binance');
    return;
  }

  console.log(`\n🗑️  Deleting ${existingKlines.length} klines in range...`);
  await db.delete(klines).where(
    and(
      eq(klines.symbol, symbol),
      eq(klines.interval, interval as any),
      eq(klines.marketType, marketType),
      gte(klines.openTime, startTime),
      lte(klines.openTime, endTime)
    )
  );

  console.log('📥 Inserting correct klines from Binance...');
  for (const bk of binanceKlines) {
    await db.insert(klines).values({
      symbol,
      interval: interval as any,
      marketType,
      openTime: new Date(bk.openTime),
      closeTime: new Date(bk.closeTime),
      open: bk.open,
      high: bk.high,
      low: bk.low,
      close: bk.close,
      volume: bk.volume,
      quoteVolume: bk.quoteVolume,
      trades: bk.trades,
      takerBuyBaseVolume: bk.takerBuyBaseVolume,
      takerBuyQuoteVolume: bk.takerBuyQuoteVolume,
    });
    fixedCount++;
  }

  console.log(`\n✅ Fixed ${fixedCount} klines (${corruptedCount} were corrupted)`);
};

const main = async () => {
  try {
    console.log('🔧 MarketMind Kline Corruption Fix');
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log('\nFixing corrupted and missing candles...\n');

    await fixKlinesInRange(
      'BTCUSDT',
      '30m',
      new Date('2026-01-17T09:00:00Z'),
      new Date('2026-01-17T12:30:00Z'),
      'FUTURES'
    );

    const corruptedTime = 1765938600000;
    const missingTime = 1765942200000;

    await fixCorruptedKline('BTCUSDT', '15m', corruptedTime, 'Corrupted candle 02:30');
    await fixCorruptedKline('BTCUSDT', '15m', missingTime, 'Missing candle 03:30');

    await fixCorruptedKline('ETHUSDT', '15m', corruptedTime, 'Corrupted candle 02:30');
    await fixCorruptedKline('ETHUSDT', '15m', missingTime, 'Missing candle 03:30');

    await fixCorruptedKline('SOLUSDT', '15m', corruptedTime, 'Corrupted candle 02:30');
    await fixCorruptedKline('SOLUSDT', '15m', missingTime, 'Missing candle 03:30');

    console.log('\n' + '='.repeat(70));
    console.log('✓ Fix complete - Run verify-recent-klines.ts to confirm');
    console.log('='.repeat(70));

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during fix:', error);
    console.error(error);
    process.exit(1);
  }
};

main();
