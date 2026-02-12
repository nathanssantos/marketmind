import { and, desc, eq } from 'drizzle-orm';
import { db } from '../src/db';
import { klines } from '../src/db/schema';

const checkCandle = async (symbol: string, interval: string, timestamp: string) => {
  const result = await db.query.klines.findMany({
    where: and(
      eq(klines.symbol, symbol),
      eq(klines.interval, interval as any),
      eq(klines.openTime, new Date(timestamp))
    ),
  });
  
  console.log(`\n${symbol} ${interval} at ${timestamp}:`);
  console.log(`Found: ${result.length} candles`);
  if (result.length > 0) {
    const k = result[0];
    console.log(`  O=${k.open} H=${k.high} L=${k.low} C=${k.close} V=${k.volume}`);
  }
};

const main = async () => {
  console.log('Checking candle 03:30 in database...\n');
  
  await checkCandle('BTCUSDT', '15m', '2025-12-17T03:30:00.000Z');
  await checkCandle('ETHUSDT', '15m', '2025-12-17T03:30:00.000Z');
  await checkCandle('SOLUSDT', '15m', '2025-12-17T03:30:00.000Z');
  
  console.log('\n\nLast 3 candles for BTCUSDT 15m:');
  const last3 = await db.query.klines.findMany({
    where: and(
      eq(klines.symbol, 'BTCUSDT'),
      eq(klines.interval, '15m')
    ),
    orderBy: [desc(klines.openTime)],
    limit: 3,
  });
  
  last3.forEach(k => {
    console.log(`  ${k.openTime.toISOString()} - C=${k.close} V=${k.volume}`);
  });
  
  process.exit(0);
};

main();
