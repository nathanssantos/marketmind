import { and, asc, eq, gte, lte } from 'drizzle-orm';
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

const getIntervalMs = (interval: string): number => {
  const unit = interval.slice(-1);
  const value = parseInt(interval.slice(0, -1));
  
  if (unit === 'm') return value * 60 * 1000;
  if (unit === 'h') return value * 60 * 60 * 1000;
  if (unit === 'd') return value * 24 * 60 * 60 * 1000;
  
  throw new Error(`Unknown interval: ${interval}`);
};

const fetchBinanceKlines = async (
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<BinanceKline[]> => {
  const url = `${BINANCE_API}?symbol=${symbol.toUpperCase()}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=1000`;
  
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

const checkGaps = async (symbol: string, interval: string) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Checking ${symbol} ${interval}`);
  console.log('='.repeat(60));

  const now = Date.now();
  const lookbackHours = 168;
  const startTime = now - lookbackHours * 60 * 60 * 1000;

  console.log(`\nFetching Binance data from last ${lookbackHours} hours (${lookbackHours / 24} days)...`);
  const binanceKlines = await fetchBinanceKlines(symbol, interval, startTime, now);
  console.log(`Binance has ${binanceKlines.length} candles`);

  console.log('\nFetching database data...');
  const dbKlines = await db.query.klines.findMany({
    where: and(
      eq(klines.symbol, symbol),
      eq(klines.interval, interval),
      gte(klines.openTime, new Date(startTime)),
      lte(klines.openTime, new Date(now))
    ),
    orderBy: [asc(klines.openTime)],
  });
  console.log(`Database has ${dbKlines.length} candles`);

  const intervalMs = getIntervalMs(interval);
  const expectedCandles = Math.floor((now - startTime) / intervalMs);
  
  console.log(`\nExpected candles in time range: ${expectedCandles}`);
  console.log(`Difference: ${binanceKlines.length - dbKlines.length} candles missing`);

  const dbOpenTimes = new Set(dbKlines.map(k => k.openTime.getTime()));
  const binanceOpenTimes = binanceKlines.map(k => k.openTime);

  const missingInDb = binanceOpenTimes.filter(t => !dbOpenTimes.has(t));
  
  if (missingInDb.length === 0) {
    console.log('\n✅ NO GAPS FOUND - Database is synchronized with Binance');
    return;
  }

  console.log(`\n⚠️  FOUND ${missingInDb.length} MISSING CANDLES`);
  
  let consecutiveGaps: number[][] = [];
  let currentGap: number[] = [missingInDb[0]];

  for (let i = 1; i < missingInDb.length; i++) {
    if (missingInDb[i] - missingInDb[i - 1] === intervalMs) {
      currentGap.push(missingInDb[i]);
    } else {
      consecutiveGaps.push(currentGap);
      currentGap = [missingInDb[i]];
    }
  }
  consecutiveGaps.push(currentGap);

  console.log(`\nFound ${consecutiveGaps.length} gap(s):\n`);
  
  consecutiveGaps.forEach((gap, idx) => {
    const startDate = new Date(gap[0]);
    const endDate = new Date(gap[gap.length - 1]);
    const hoursAgo = ((now - gap[0]) / (60 * 60 * 1000)).toFixed(1);
    
    console.log(`Gap #${idx + 1}: ${gap.length} consecutive candle(s)`);
    console.log(`  From: ${startDate.toISOString()} (${hoursAgo} hours ago)`);
    console.log(`  To:   ${endDate.toISOString()}`);
    
    if (gap.length <= 5) {
      console.log(`  Timestamps: ${gap.join(', ')}`);
    } else {
      console.log(`  First 3: ${gap.slice(0, 3).join(', ')}`);
      console.log(`  Last 3: ${gap.slice(-3).join(', ')}`);
    }
    console.log('');
  });

  const binanceSet = new Set(binanceOpenTimes);
  const extraInDb = Array.from(dbOpenTimes).filter(t => !binanceSet.has(t));
  
  if (extraInDb.length > 0) {
    console.log(`\n⚠️  Found ${extraInDb.length} candles in DB that don't exist in Binance:`);
    extraInDb.slice(0, 5).forEach(t => {
      console.log(`  - ${new Date(t).toISOString()} (${t})`);
    });
    if (extraInDb.length > 5) {
      console.log(`  ... and ${extraInDb.length - 5} more`);
    }
  }

  const firstBinance = new Date(binanceKlines[0].openTime);
  const lastBinance = new Date(binanceKlines[binanceKlines.length - 1].openTime);
  const firstDb = dbKlines[0] ? new Date(dbKlines[0].openTime) : null;
  const lastDb = dbKlines[dbKlines.length - 1] ? new Date(dbKlines[dbKlines.length - 1].openTime) : null;

  console.log('\n📅 Time Range Comparison:');
  console.log(`Binance: ${firstBinance.toISOString()} → ${lastBinance.toISOString()}`);
  console.log(`Database: ${firstDb?.toISOString() || 'N/A'} → ${lastDb?.toISOString() || 'N/A'}`);
};

const main = async () => {
  try {
    console.log('🔍 MarketMind Kline Gap Analysis - Extended Check');
    console.log(`Started at: ${new Date().toISOString()}\n`);

    await checkGaps('BTCUSDT', '15m');
    await checkGaps('ETHUSDT', '15m');
    await checkGaps('SOLUSDT', '15m');
    await checkGaps('XRPUSDT', '30m');

    console.log('\n' + '='.repeat(60));
    console.log('✓ Analysis complete');
    console.log('='.repeat(60));
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during analysis:', error);
    console.error(error);
    process.exit(1);
  }
};

main();
