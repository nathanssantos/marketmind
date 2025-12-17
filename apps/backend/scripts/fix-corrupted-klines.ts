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

const fetchBinanceKline = async (
  symbol: string,
  interval: string,
  timestamp: number
): Promise<BinanceKline | null> => {
  const url = `${BINANCE_API}?symbol=${symbol.toUpperCase()}&interval=${interval}&startTime=${timestamp}&limit=1`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
  }
  
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

const fixCorruptedKline = async (
  symbol: string,
  interval: string,
  timestamp: number,
  description: string
) => {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`Fixing ${symbol} ${interval} - ${description}`);
  console.log(`Timestamp: ${new Date(timestamp).toISOString()}`);
  
  const binanceKline = await fetchBinanceKline(symbol, interval, timestamp);
  
  if (!binanceKline) {
    console.log('❌ Candle not found on Binance');
    return;
  }
  
  const openTime = new Date(timestamp);
  
  const existing = await db.query.klines.findFirst({
    where: and(
      eq(klines.symbol, symbol),
      eq(klines.interval, interval as any),
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
          eq(klines.openTime, openTime)
        )
      );
    
    console.log('\n✅ Updated existing candle');
  } else {
    await db.insert(klines).values({
      symbol,
      interval: interval as any,
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

const main = async () => {
  try {
    console.log('🔧 MarketMind Kline Corruption Fix');
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log('\nFixing corrupted and missing candles...\n');

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
