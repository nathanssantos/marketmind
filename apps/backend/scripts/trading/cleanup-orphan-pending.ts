import { db } from '../../src/db/index.js';
import { tradeExecutions } from '../../src/db/schema.js';
import { and, eq } from 'drizzle-orm';

async function main() {
  const pending = await db
    .select({ id: tradeExecutions.id, symbol: tradeExecutions.symbol, entryOrderId: tradeExecutions.entryOrderId })
    .from(tradeExecutions)
    .where(and(eq(tradeExecutions.status, 'pending'), eq(tradeExecutions.marketType, 'FUTURES')));

  console.log(`Found ${pending.length} pending FUTURES executions in DB`);

  if (pending.length === 0) {
    console.log('Nothing to clean up.');
    process.exit(0);
  }

  for (const p of pending) {
    console.log(`  [${p.id}] ${p.symbol} entryOrderId=${p.entryOrderId}`);
  }

  const result = await db
    .update(tradeExecutions)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(and(eq(tradeExecutions.status, 'pending'), eq(tradeExecutions.marketType, 'FUTURES')))
    .returning({ id: tradeExecutions.id });

  console.log(`\nCancelled ${result.length} pending executions in DB`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
