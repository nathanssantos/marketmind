import { and, desc, eq } from 'drizzle-orm';
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
  limit: number = 10
): Promise<BinanceKline[]> => {
  const url = `${BINANCE_API}?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`;
  
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

const compareKlines = (
  dbKline: any,
  binanceKline: BinanceKline
): { match: boolean; differences: string[] } => {
  const differences: string[] = [];
  
  const dbOpen = parseFloat(dbKline.open);
  const dbHigh = parseFloat(dbKline.high);
  const dbLow = parseFloat(dbKline.low);
  const dbClose = parseFloat(dbKline.close);
  const dbVolume = parseFloat(dbKline.volume);
  
  const bnOpen = parseFloat(binanceKline.open);
  const bnHigh = parseFloat(binanceKline.high);
  const bnLow = parseFloat(binanceKline.low);
  const bnClose = parseFloat(binanceKline.close);
  const bnVolume = parseFloat(binanceKline.volume);
  
  const tolerance = 0.000001;
  
  if (Math.abs(dbOpen - bnOpen) > tolerance) {
    differences.push(`Open: DB=${dbOpen} vs Binance=${bnOpen}`);
  }
  if (Math.abs(dbHigh - bnHigh) > tolerance) {
    differences.push(`High: DB=${dbHigh} vs Binance=${bnHigh}`);
  }
  if (Math.abs(dbLow - bnLow) > tolerance) {
    differences.push(`Low: DB=${dbLow} vs Binance=${bnLow}`);
  }
  if (Math.abs(dbClose - bnClose) > tolerance) {
    differences.push(`Close: DB=${dbClose} vs Binance=${bnClose}`);
  }
  if (Math.abs(dbVolume - bnVolume) > tolerance) {
    differences.push(`Volume: DB=${dbVolume} vs Binance=${bnVolume}`);
  }
  
  return { match: differences.length === 0, differences };
};

const verifyRecentKlines = async (symbol: string, interval: string) => {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Verifying ${symbol} ${interval} - Last 10 Candles`);
  console.log('='.repeat(70));
  
  const dbKlines = await db.query.klines.findMany({
    where: and(
      eq(klines.symbol, symbol),
      eq(klines.interval, interval)
    ),
    orderBy: [desc(klines.openTime)],
    limit: 11,
  });
  
  console.log(`\nFound ${dbKlines.length} candles in database`);
  
  const closedDbKlines = dbKlines.slice(1);
  
  if (closedDbKlines.length === 0) {
    console.log('⚠️  No closed candles found in database');
    return;
  }
  
  console.log(`Checking ${closedDbKlines.length} closed candles (excluding current open candle)\n`);
  
  const binanceKlines = await fetchBinanceKlines(symbol, interval, 11);
  const closedBinanceKlines = binanceKlines.slice(0, -1);
  
  console.log(`Fetched ${closedBinanceKlines.length} closed candles from Binance\n`);
  
  let matches = 0;
  let mismatches = 0;
  let missing = 0;
  
  const dbMap = new Map(
    closedDbKlines.map(k => [k.openTime.getTime(), k])
  );
  
  console.log('Comparison Results:\n');
  
  for (let i = 0; i < closedBinanceKlines.length && i < 10; i++) {
    const bnKline = closedBinanceKlines[i];
    const dbKline = dbMap.get(bnKline.openTime);
    
    const timeStr = new Date(bnKline.openTime).toISOString();
    const hoursAgo = ((Date.now() - bnKline.openTime) / (60 * 60 * 1000)).toFixed(1);
    
    if (!dbKline) {
      missing++;
      console.log(`❌ MISSING: ${timeStr} (${hoursAgo}h ago)`);
      console.log(`   Binance: O=${bnKline.open} H=${bnKline.high} L=${bnKline.low} C=${bnKline.close} V=${bnKline.volume}`);
      console.log('');
      continue;
    }
    
    const comparison = compareKlines(dbKline, bnKline);
    
    if (comparison.match) {
      matches++;
      console.log(`✅ MATCH: ${timeStr} (${hoursAgo}h ago)`);
    } else {
      mismatches++;
      console.log(`⚠️  MISMATCH: ${timeStr} (${hoursAgo}h ago)`);
      comparison.differences.forEach(diff => {
        console.log(`   ${diff}`);
      });
    }
    console.log('');
  }
  
  console.log(`${'─'.repeat(70)}`);
  console.log(`Summary: ✅ ${matches} matches | ⚠️  ${mismatches} mismatches | ❌ ${missing} missing`);
  console.log(`${'─'.repeat(70)}`);
};

const main = async () => {
  try {
    console.log('🔍 MarketMind Kline Data Integrity Check');
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log('Checking last 10 closed candles for each asset\n');

    await verifyRecentKlines('BTCUSDT', '15m');
    await verifyRecentKlines('ETHUSDT', '15m');
    await verifyRecentKlines('SOLUSDT', '15m');
    await verifyRecentKlines('XRPUSDT', '30m');

    console.log('\n' + '='.repeat(70));
    console.log('✓ Integrity check complete');
    console.log('='.repeat(70));
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during verification:', error);
    console.error(error);
    process.exit(1);
  }
};

main();
