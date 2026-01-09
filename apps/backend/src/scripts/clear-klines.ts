import 'dotenv/config';
import { db } from '../db';
import { klines } from '../db/schema';

const clearKlines = async () => {
  console.log('Starting klines cleanup...\n');

  const allKlines = await db.select().from(klines);

  if (allKlines.length === 0) {
    console.log('No klines found in database.');
    process.exit(0);
  }

  console.log(`Found ${allKlines.length.toLocaleString()} kline(s) in database.\n`);

  const groupedByMarket = allKlines.reduce((acc, kline) => {
    const key = kline.marketType;
    if (!acc[key]) acc[key] = [];
    acc[key].push(kline);
    return acc;
  }, {} as Record<string, typeof allKlines>);

  console.log('Breakdown by market type:');
  for (const [marketType, klineList] of Object.entries(groupedByMarket)) {
    console.log(`  - ${marketType}: ${klineList.length.toLocaleString()} klines`);
  }

  console.log('\nDeleting all klines...');
  await db.delete(klines);
  console.log('Done.');

  console.log('\nKlines cleanup complete!');
  process.exit(0);
};

clearKlines().catch((error) => {
  console.error('Error clearing klines:', error);
  process.exit(1);
});
