import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '../../src/db';
import { incomeEvents, tradeExecutions, wallets } from '../../src/db/schema';
import { isPaperWallet } from '../../src/services/binance-client';
import { synthesizePaperClose } from '../../src/services/income-events';

async function main() {
  const allWallets = await db.select().from(wallets);
  const paper = allWallets.filter(isPaperWallet);

  console.log(`[synth] ${paper.length} paper wallets`);

  let totalExecs = 0;
  let totalSynthesized = 0;

  for (const wallet of paper) {
    const closed = await db
      .select()
      .from(tradeExecutions)
      .where(and(eq(tradeExecutions.walletId, wallet.id), eq(tradeExecutions.status, 'closed')));

    console.log(`[synth] ${wallet.name}: ${closed.length} closed executions`);

    for (const exec of closed) {
      const existing = await db
        .select({ id: incomeEvents.id })
        .from(incomeEvents)
        .where(and(eq(incomeEvents.executionId, exec.id), or(eq(incomeEvents.incomeType, 'REALIZED_PNL'), isNull(incomeEvents.executionId))))
        .limit(1);
      if (existing.length > 0) continue;

      const grossPnl = parseFloat(exec.pnl ?? '0') + parseFloat(exec.fees ?? '0') - parseFloat(exec.accumulatedFunding ?? '0');
      const totalFees = parseFloat(exec.fees ?? '0');
      const funding = parseFloat(exec.accumulatedFunding ?? '0');

      const inserted = await synthesizePaperClose({
        walletId: wallet.id,
        userId: exec.userId,
        executionId: exec.id,
        symbol: exec.symbol,
        grossPnl,
        totalFees,
        accumulatedFunding: funding,
        closedAt: exec.closedAt ?? new Date(),
      });

      totalExecs++;
      totalSynthesized += inserted;
    }
  }

  console.log(`\n[synth] done: ${totalExecs} executions processed, ${totalSynthesized} income_events rows written`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[synth] fatal:', err);
  process.exit(1);
});
