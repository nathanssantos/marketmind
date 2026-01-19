import { db } from '../src/db/index.ts';
import { wallets as walletsTable } from '../src/db/schema.ts';
import { eq } from 'drizzle-orm';
import { createBinanceFuturesClient, getIncomeHistory } from '../src/services/binance-futures-client.ts';

async function main() {
  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.id, 'kP_efbmZqtTyEJ4p2LLBx'));
  if (!wallet) {
    console.log('Wallet not found');
    process.exit(1);
  }

  const client = createBinanceFuturesClient(wallet);

  const startTime = new Date('2026-01-19T01:30:00Z').getTime();
  const endTime = new Date('2026-01-19T01:31:00Z').getTime();

  const income = await getIncomeHistory(client, {
    symbol: 'HYPEUSDT',
    incomeType: 'COMMISSION',
    startTime,
    endTime,
    limit: 50,
  });

  console.log('HYPEUSDT Commission fees around trade time:');
  console.log(JSON.stringify(income, null, 2));

  let totalFees = 0;
  for (const item of income) {
    totalFees += Math.abs(parseFloat(item.income));
  }
  console.log('\nTotal fees:', totalFees.toFixed(8), 'USDT');

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
