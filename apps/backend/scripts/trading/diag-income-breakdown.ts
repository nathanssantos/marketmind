import { eq, sql } from 'drizzle-orm';
import { db } from '../../src/db';
import { incomeEvents, wallets } from '../../src/db/schema';

async function main() {
  const all = await db.select().from(wallets).where(eq(wallets.marketType, 'FUTURES'));
  for (const w of all) {
    const byType = await db
      .select({
        incomeType: incomeEvents.incomeType,
        count: sql<string>`COUNT(*)`,
        total: sql<string>`COALESCE(SUM(${incomeEvents.amount}), 0)`,
      })
      .from(incomeEvents)
      .where(eq(incomeEvents.walletId, w.id))
      .groupBy(incomeEvents.incomeType);

    console.log(`\n=== ${w.name} (${w.id}) ===`);
    console.log(`  initialBalance=${w.initialBalance}`);
    console.log(`  currentBalance=${w.currentBalance}`);
    console.log(`  totalDeposits=${w.totalDeposits}`);
    console.log(`  totalWithdrawals=${w.totalWithdrawals}`);
    console.log(`  createdAt=${w.createdAt?.toISOString()}`);
    console.log(`  income_events by type:`);
    let nonTransferSum = 0;
    let transferSum = 0;
    for (const row of byType) {
      const v = parseFloat(row.total);
      console.log(`    ${row.incomeType.padEnd(22)} count=${row.count.padStart(6)} sum=${v.toFixed(2)}`);
      if (row.incomeType === 'TRANSFER') transferSum += v;
      else nonTransferSum += v;
    }
    const initial = parseFloat(w.initialBalance ?? '0');
    const deposits = parseFloat(w.totalDeposits ?? '0');
    const withdrawals = parseFloat(w.totalWithdrawals ?? '0');
    const db_balance = parseFloat(w.currentBalance ?? '0');
    console.log(`  --- hypotheses ---`);
    console.log(`  H1: initial + sumAll              = ${(initial + nonTransferSum + transferSum).toFixed(2)}`);
    console.log(`  H2: initial + sumNonTransfer + D-W = ${(initial + nonTransferSum + deposits - withdrawals).toFixed(2)}`);
    console.log(`  H3: initial + sumAll + D-W        = ${(initial + nonTransferSum + transferSum + deposits - withdrawals).toFixed(2)}  (current formula)`);
    console.log(`  binance/db balance                 = ${db_balance.toFixed(2)}`);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
