import 'dotenv/config';
import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '../../src/db';
import { realizedPnlEvents, tradeExecutions } from '../../src/db/schema';

const APPLY = process.argv.includes('--apply');

type PlanRow = {
  executionId: string;
  walletId: string;
  userId: string;
  symbol: string;
  pnl: string;
  fees: string;
  quantity: string;
  price: string;
  createdAt: Date;
  reason: 'no-events' | 'partial-only';
};

async function backfill(): Promise<void> {
  console.log('='.repeat(70));
  console.log('  BACKFILL: realized_pnl_events <- trade_executions');
  console.log('='.repeat(70));
  console.log(`  Mode: ${APPLY ? 'APPLY (writing to DB)' : 'DRY-RUN (no writes)'}`);
  console.log(`  Started: ${new Date().toISOString()}\n`);

  const closedExecs = await db
    .select()
    .from(tradeExecutions)
    .where(
      and(
        eq(tradeExecutions.status, 'closed'),
        isNotNull(tradeExecutions.pnl),
        isNotNull(tradeExecutions.closedAt),
      ),
    );
  console.log(`[backfill] Closed executions with PnL+closedAt: ${closedExecs.length}`);

  const allEvents = await db.select().from(realizedPnlEvents);
  const eventsByExecId = new Map<string, typeof allEvents>();
  for (const evt of allEvents) {
    const list = eventsByExecId.get(evt.executionId) ?? [];
    list.push(evt);
    eventsByExecId.set(evt.executionId, list);
  }
  console.log(`[backfill] Existing events: ${allEvents.length} across ${eventsByExecId.size} unique executions`);

  const plan: PlanRow[] = [];

  for (const exec of closedExecs) {
    const events = eventsByExecId.get(exec.id) ?? [];
    const hasFullClose = events.some((e) => e.eventType === 'full_close');
    if (hasFullClose) continue;

    const execPnl = parseFloat(exec.pnl ?? '0');
    const partialSum = events
      .filter((e) => e.eventType === 'partial_close')
      .reduce((s, e) => s + parseFloat(e.pnl ?? '0'), 0);
    const fullClosePnl = execPnl - partialSum;

    plan.push({
      executionId: exec.id,
      walletId: exec.walletId,
      userId: exec.userId,
      symbol: exec.symbol,
      pnl: fullClosePnl.toString(),
      fees: exec.fees ?? '0',
      quantity: exec.quantity,
      price: exec.exitPrice ?? '0',
      createdAt: exec.closedAt!,
      reason: events.length === 0 ? 'no-events' : 'partial-only',
    });
  }

  console.log(`\n[backfill] Plan: ${plan.length} rows to insert`);
  const byReason = new Map<string, number>();
  for (const p of plan) byReason.set(p.reason, (byReason.get(p.reason) ?? 0) + 1);
  for (const [reason, count] of byReason) console.log(`  - ${reason}: ${count}`);

  const byMonth = new Map<string, number>();
  for (const p of plan) {
    const month = p.createdAt.toISOString().slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
  }
  console.log(`\n[backfill] Distribution by month:`);
  for (const [month, count] of [...byMonth.entries()].sort()) console.log(`  - ${month}: ${count}`);

  const totalPnl = plan.reduce((s, p) => s + parseFloat(p.pnl), 0);
  const winCount = plan.filter((p) => parseFloat(p.pnl) > 0).length;
  const lossCount = plan.filter((p) => parseFloat(p.pnl) < 0).length;
  console.log(`\n[backfill] Summary:`);
  console.log(`  Total PnL to record: ${totalPnl.toFixed(4)} USDT`);
  console.log(`  Wins: ${winCount} | Losses: ${lossCount} | Break-even: ${plan.length - winCount - lossCount}`);

  if (!APPLY) {
    console.log('\n[backfill] Dry-run complete. Run with --apply to write.');
    process.exit(0);
  }

  console.log('\n[backfill] Writing...');
  let written = 0;
  let failed = 0;
  for (const p of plan) {
    try {
      await db.insert(realizedPnlEvents).values({
        walletId: p.walletId,
        userId: p.userId,
        executionId: p.executionId,
        symbol: p.symbol,
        eventType: 'full_close',
        pnl: p.pnl,
        fees: p.fees,
        quantity: p.quantity,
        price: p.price,
        createdAt: p.createdAt,
      });
      written++;
    } catch (err) {
      failed++;
      console.error(`[backfill] FAIL execution=${p.executionId}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\n[backfill] Done. Wrote ${written}/${plan.length} events (${failed} failed).`);
  process.exit(failed > 0 ? 1 : 0);
}

backfill().catch((err) => {
  console.error('[backfill] Fatal error:', err);
  process.exit(1);
});
