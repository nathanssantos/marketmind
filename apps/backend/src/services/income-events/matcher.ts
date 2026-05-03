import { and, eq, gte, lte, sql, asc, isNull } from 'drizzle-orm';
import { db } from '../../db';
import { incomeEvents, tradeExecutions } from '../../db/schema';
import type { IncomeType } from '../../constants/income-types';

export interface LinkIncomeToExecutionInput {
  walletId: string;
  symbol: string;
  incomeType: IncomeType;
  incomeTime: Date;
  binanceTranId: number;
}

/**
 * Recomputes `tradeExecutions.accumulatedFunding` for a given execution
 * from the sum of FUNDING_FEE income events that fall within the
 * execution's open/close window (matched by wallet + symbol + time,
 * NOT by `executionId` — the linker's executionId is a useful index
 * but ambiguous when multiple executions on the same symbol overlap,
 * because the linker picks "first execution by openedAt" greedily).
 *
 * Time-window match is authoritative: Binance issues funding fees at
 * known cadence (every 8h on futures), each event has a precise
 * `incomeTime`, and an execution that was open across a funding tick
 * was charged that tick. As long as one position per (wallet, symbol)
 * is open at a time (one-way mode) this is exact; in hedge mode it
 * still gives the correct sum but may apportion across overlapping
 * positions sub-optimally.
 *
 * Refuses to overwrite a non-zero `accumulatedFunding` with zero —
 * if the time-window query returns 0 income rows, the previously
 * stored value is left intact. This protects against erasing funding
 * that was set by an older / different path before the income-event
 * sync caught up.
 *
 * Exported for audit scripts and the user-stream link path.
 */
export const recomputeExecutionAccumulatedFunding = async (executionId: string): Promise<void> => {
  const [exec] = await db
    .select({
      walletId: tradeExecutions.walletId,
      symbol: tradeExecutions.symbol,
      openedAt: tradeExecutions.openedAt,
      closedAt: tradeExecutions.closedAt,
      currentFunding: tradeExecutions.accumulatedFunding,
    })
    .from(tradeExecutions)
    .where(eq(tradeExecutions.id, executionId))
    .limit(1);

  if (!exec) return;

  const closedAt = exec.closedAt ?? new Date();
  const [row] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${incomeEvents.amount}::numeric), 0)::text`,
      cnt: sql<string>`COUNT(*)::text`,
    })
    .from(incomeEvents)
    .where(
      and(
        eq(incomeEvents.walletId, exec.walletId),
        eq(incomeEvents.symbol, exec.symbol),
        eq(incomeEvents.incomeType, 'FUNDING_FEE'),
        sql`${incomeEvents.incomeTime} >= ${exec.openedAt}`,
        sql`${incomeEvents.incomeTime} <= ${closedAt}`,
      ),
    );

  const count = parseInt(row?.cnt ?? '0', 10);
  // No linked / windowed events found — don't clobber any existing
  // value. Either income hasn't synced yet, or the position closed
  // outside any funding tick.
  if (count === 0) return;

  await db
    .update(tradeExecutions)
    .set({
      accumulatedFunding: row?.total ?? '0',
      updatedAt: new Date(),
    })
    .where(eq(tradeExecutions.id, executionId));
};

export const linkIncomeToExecution = async (input: LinkIncomeToExecutionInput): Promise<string | null> => {
  const time = input.incomeTime;

  const [match] = await db
    .select({ id: tradeExecutions.id })
    .from(tradeExecutions)
    .where(
      and(
        eq(tradeExecutions.walletId, input.walletId),
        eq(tradeExecutions.symbol, input.symbol),
        lte(tradeExecutions.openedAt, time),
        sql`(${tradeExecutions.closedAt} IS NULL OR ${tradeExecutions.closedAt} >= ${time})`,
      ),
    )
    .orderBy(asc(tradeExecutions.openedAt))
    .limit(1);

  if (!match) return null;

  await db
    .update(incomeEvents)
    .set({ executionId: match.id })
    .where(
      and(
        eq(incomeEvents.walletId, input.walletId),
        eq(incomeEvents.binanceTranId, input.binanceTranId),
        isNull(incomeEvents.executionId),
      ),
    );

  if (input.incomeType === 'FUNDING_FEE') {
    await recomputeExecutionAccumulatedFunding(match.id);
  }

  return match.id;
};

export const linkUnmatchedEventsForWallet = async (walletId: string, sinceMs: number): Promise<number> => {
  const since = new Date(sinceMs);

  const unmatched = await db
    .select()
    .from(incomeEvents)
    .where(
      and(
        eq(incomeEvents.walletId, walletId),
        isNull(incomeEvents.executionId),
        gte(incomeEvents.incomeTime, since),
      ),
    );

  let linked = 0;
  for (const row of unmatched) {
    if (!row.symbol) continue;
    const id = await linkIncomeToExecution({
      walletId,
      symbol: row.symbol,
      incomeType: row.incomeType,
      incomeTime: row.incomeTime,
      binanceTranId: row.binanceTranId,
    });
    if (id) linked++;
  }
  return linked;
};
