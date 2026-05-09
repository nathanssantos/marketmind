import { db } from '../../db';
import { incomeEvents, type NewIncomeEvent } from '../../db/schema';
import type { IncomeType, IncomeSource } from '../../constants/income-types';

export interface InsertIncomeEventInput {
  walletId: string;
  userId: string;
  binanceTranId: number;
  incomeType: IncomeType;
  amount: number | string;
  asset: string;
  symbol?: string | null;
  executionId?: string | null;
  info?: string | null;
  tradeId?: string | null;
  source?: IncomeSource;
  incomeTime: Date;
}

export const insertIncomeEvent = async (input: InsertIncomeEventInput): Promise<void> => {
  const row: NewIncomeEvent = {
    walletId: input.walletId,
    userId: input.userId,
    binanceTranId: input.binanceTranId,
    incomeType: input.incomeType,
    amount: typeof input.amount === 'number' ? input.amount.toString() : input.amount,
    asset: input.asset,
    symbol: input.symbol ?? null,
    executionId: input.executionId ?? null,
    info: input.info ?? null,
    tradeId: input.tradeId ?? null,
    source: input.source ?? 'binance',
    incomeTime: input.incomeTime,
  };

  await db
    .insert(incomeEvents)
    .values(row)
    .onConflictDoNothing({ target: [incomeEvents.walletId, incomeEvents.binanceTranId, incomeEvents.incomeType] });
};

const INSERT_CHUNK_SIZE = 500;

export const insertIncomeEventsBatch = async (inputs: InsertIncomeEventInput[]): Promise<number> => {
  if (inputs.length === 0) return 0;

  const rows: NewIncomeEvent[] = inputs.map((input) => ({
    walletId: input.walletId,
    userId: input.userId,
    binanceTranId: input.binanceTranId,
    incomeType: input.incomeType,
    amount: typeof input.amount === 'number' ? input.amount.toString() : input.amount,
    asset: input.asset,
    symbol: input.symbol ?? null,
    executionId: input.executionId ?? null,
    info: input.info ?? null,
    tradeId: input.tradeId ?? null,
    source: input.source ?? 'binance',
    incomeTime: input.incomeTime,
  }));

  let totalInserted = 0;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + INSERT_CHUNK_SIZE);
    const inserted = await db
      .insert(incomeEvents)
      .values(chunk)
      .onConflictDoNothing({ target: [incomeEvents.walletId, incomeEvents.binanceTranId, incomeEvents.incomeType] })
      .returning({ id: incomeEvents.id });
    totalInserted += inserted.length;
  }

  return totalInserted;
};
