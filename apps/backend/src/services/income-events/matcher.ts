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
