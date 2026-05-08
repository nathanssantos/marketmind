import { db } from '../../src/db/index.js';
import { tradeExecutions } from '../../src/db/schema.js';
import { and, eq, isNull } from 'drizzle-orm';

const before = await db.query.tradeExecutions.findMany({
  where: and(
    eq(tradeExecutions.status, 'closed'),
    isNull(tradeExecutions.exitPrice),
  ),
});

console.log(`Found ${before.length} closed execs with NULL exit_price (orphan/SYNC_INCOMPLETE candidates):`);
for (const e of before) {
  console.log(`  ${e.id} ${e.symbol} ${e.side} qty=${e.quantity} entry=${e.entryPrice} pnl=${e.pnl} closedAt=${e.closedAt?.toISOString()} exitReason=${e.exitReason}`);
}

if (before.length === 0) {
  console.log('Nothing to clean.');
  process.exit(0);
}

const updated = await db
  .update(tradeExecutions)
  .set({
    pnl: null,
    pnlPercent: null,
    exitReason: 'SYNC_INCOMPLETE_CLEARED',
    updatedAt: new Date(),
  })
  .where(
    and(
      eq(tradeExecutions.status, 'closed'),
      isNull(tradeExecutions.exitPrice),
    ),
  )
  .returning({ id: tradeExecutions.id });

console.log(`\nCleared pnl on ${updated.length} orphan execs.`);
process.exit(0);
