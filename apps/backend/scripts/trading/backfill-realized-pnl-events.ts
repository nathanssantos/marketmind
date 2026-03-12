import 'dotenv/config';
import { eq, isNotNull } from 'drizzle-orm';
import { db } from '../../src/db';
import { realizedPnlEvents, tradeExecutions } from '../../src/db/schema';

async function main() {
  console.log('Backfilling realized_pnl_events from closed trade_executions...');

  const existingCount = await db.select({ id: realizedPnlEvents.id }).from(realizedPnlEvents).limit(1);
  if (existingCount.length > 0) {
    console.log('WARNING: realized_pnl_events already has data. Skipping to avoid duplicates.');
    console.log('If you want to re-run, truncate the table first: TRUNCATE realized_pnl_events;');
    process.exit(0);
  }

  const closedTrades = await db
    .select()
    .from(tradeExecutions)
    .where(eq(tradeExecutions.status, 'closed'));

  console.log(`Found ${closedTrades.length} closed trade executions`);

  let inserted = 0;
  let skipped = 0;

  for (const trade of closedTrades) {
    if (!trade.closedAt) {
      skipped++;
      continue;
    }

    const pnl = trade.pnl ? parseFloat(trade.pnl) : 0;
    const partialClosePnl = parseFloat(trade.partialClosePnl || '0');
    const finalLegPnl = partialClosePnl !== 0 ? pnl - partialClosePnl : pnl;
    const fees = trade.fees ? parseFloat(trade.fees) : 0;
    const exitPrice = trade.exitPrice ? parseFloat(trade.exitPrice) : 0;
    const quantity = trade.quantity ? parseFloat(trade.quantity) : 0;

    const events: { walletId: string; userId: string; executionId: string; symbol: string; eventType: string; pnl: string; fees: string; quantity: string; price: string; createdAt: Date }[] = [];

    if (partialClosePnl !== 0) {
      const partialDate = new Date(trade.closedAt.getTime() - 60000);
      events.push({
        walletId: trade.walletId,
        userId: trade.userId,
        executionId: trade.id,
        symbol: trade.symbol,
        eventType: 'partial_close',
        pnl: partialClosePnl.toString(),
        fees: '0',
        quantity: '0',
        price: '0',
        createdAt: partialDate,
      });
    }

    events.push({
      walletId: trade.walletId,
      userId: trade.userId,
      executionId: trade.id,
      symbol: trade.symbol,
      eventType: 'full_close',
      pnl: finalLegPnl.toString(),
      fees: fees.toString(),
      quantity: quantity.toString(),
      price: exitPrice.toString(),
      createdAt: trade.closedAt,
    });

    await db.insert(realizedPnlEvents).values(events);
    inserted += events.length;
  }

  console.log(`Done! Inserted ${inserted} events, skipped ${skipped} trades without closedAt`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
