/**
 * Repair script — restores `tradeExecutions.accumulatedFunding` from
 * Binance income events using time-window matching, and recomputes
 * `pnl` accordingly. Use after a faulty audit run zeroed funding on
 * historical trades.
 *
 * Usage:
 *   pnpm tsx scripts/audit/repair-funding.ts                 # repair all
 *   pnpm tsx scripts/audit/repair-funding.ts --dry-run       # preview
 *   pnpm tsx scripts/audit/repair-funding.ts --wallet <id>   # one wallet
 *   pnpm tsx scripts/audit/repair-funding.ts --since=7       # last N days
 */
import 'dotenv/config';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '../../src/db';
import { incomeEvents, tradeExecutions, wallets } from '../../src/db/schema';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const walletArg = args.indexOf('--wallet');
const walletFilter = walletArg !== -1 ? args[walletArg + 1] : undefined;
const sinceMatch = args.find((a) => a.startsWith('--since='));
const sinceDays = sinceMatch ? parseInt(sinceMatch.split('=')[1] ?? '30', 10) : 30;

const cutoff = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

const closedExecs = await db
  .select()
  .from(tradeExecutions)
  .where(
    and(
      eq(tradeExecutions.status, 'closed'),
      gte(tradeExecutions.closedAt, cutoff),
      walletFilter ? eq(tradeExecutions.walletId, walletFilter) : sql`TRUE`,
    ),
  );

console.log(`Inspecting ${closedExecs.length} closed executions (since ${cutoff.toISOString()})\n`);

let repaired = 0;
let totalPnlDelta = 0;
const walletDeltas = new Map<string, number>();

for (const exec of closedExecs) {
  if (!exec.closedAt) continue;

  const [row] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${incomeEvents.amount}::numeric), 0)::text`,
      cnt: sql<string>`COUNT(*)::int`,
    })
    .from(incomeEvents)
    .where(
      and(
        eq(incomeEvents.walletId, exec.walletId),
        eq(incomeEvents.symbol, exec.symbol),
        eq(incomeEvents.incomeType, 'FUNDING_FEE'),
        sql`${incomeEvents.incomeTime} >= ${exec.openedAt}`,
        sql`${incomeEvents.incomeTime} <= ${exec.closedAt}`,
      ),
    );

  const newFunding = parseFloat(row?.total ?? '0');
  const dbFunding = parseFloat(exec.accumulatedFunding ?? '0');
  const fundingDelta = newFunding - dbFunding;

  if (Math.abs(fundingDelta) < 0.0001) continue;

  // Recompute pnl: it was stored as gross - fees + funding. Old funding was
  // dbFunding, new is newFunding → pnl shifts by fundingDelta.
  const oldPnl = parseFloat(exec.pnl ?? '0');
  const newPnl = oldPnl + fundingDelta;
  const pnlDelta = newPnl - oldPnl;

  console.log(
    `${exec.id} ${exec.symbol} ${exec.side} closed=${exec.closedAt.toISOString()} ` +
    `dbFunding=${dbFunding.toFixed(4)} newFunding=${newFunding.toFixed(4)} (${row?.cnt} events) ` +
    `oldPnl=${oldPnl.toFixed(4)} newPnl=${newPnl.toFixed(4)} Δ=${pnlDelta.toFixed(4)}`,
  );

  if (!dryRun) {
    await db
      .update(tradeExecutions)
      .set({
        accumulatedFunding: newFunding.toString(),
        pnl: newPnl.toString(),
        updatedAt: new Date(),
      })
      .where(eq(tradeExecutions.id, exec.id));

    walletDeltas.set(exec.walletId, (walletDeltas.get(exec.walletId) ?? 0) + pnlDelta);
  }

  repaired++;
  totalPnlDelta += pnlDelta;
}

if (!dryRun && walletDeltas.size > 0) {
  console.log('\nApplying wallet balance corrections:');
  for (const [walletId, delta] of walletDeltas) {
    const [wallet] = await db
      .select({ currentBalance: wallets.currentBalance, name: wallets.name })
      .from(wallets)
      .where(eq(wallets.id, walletId))
      .limit(1);
    if (!wallet) continue;
    const oldBalance = parseFloat(wallet.currentBalance ?? '0');
    const newBalance = oldBalance + delta;
    await db
      .update(wallets)
      .set({ currentBalance: newBalance.toString(), updatedAt: new Date() })
      .where(eq(wallets.id, walletId));
    console.log(`  ${wallet.name} (${walletId}): ${oldBalance.toFixed(4)} → ${newBalance.toFixed(4)} (Δ ${delta.toFixed(4)})`);
  }
}

console.log(`\nSummary: ${repaired} executions ${dryRun ? 'would be repaired' : 'repaired'}, total pnl shift: ${totalPnlDelta.toFixed(4)} USDT`);
process.exit(0);
