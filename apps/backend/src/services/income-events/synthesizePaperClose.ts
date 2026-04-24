import { insertIncomeEventsBatch, type InsertIncomeEventInput } from './insertIncomeEvent';
import { nextSyntheticTranId } from './syntheticTranId';

export interface SynthesizePaperCloseInput {
  walletId: string;
  userId: string;
  executionId: string;
  symbol: string;
  grossPnl: number;
  totalFees: number;
  accumulatedFunding?: number;
  asset?: string;
  closedAt?: Date;
}

export const synthesizePaperClose = async (input: SynthesizePaperCloseInput): Promise<number> => {
  const asset = input.asset ?? 'USDT';
  const time = input.closedAt ?? new Date();
  const funding = input.accumulatedFunding ?? 0;

  const rows: InsertIncomeEventInput[] = [
    {
      walletId: input.walletId,
      userId: input.userId,
      binanceTranId: nextSyntheticTranId(),
      incomeType: 'REALIZED_PNL',
      amount: input.grossPnl,
      asset,
      symbol: input.symbol,
      executionId: input.executionId,
      source: 'paper',
      incomeTime: time,
    },
  ];

  if (input.totalFees !== 0) {
    rows.push({
      walletId: input.walletId,
      userId: input.userId,
      binanceTranId: nextSyntheticTranId(),
      incomeType: 'COMMISSION',
      amount: -Math.abs(input.totalFees),
      asset,
      symbol: input.symbol,
      executionId: input.executionId,
      source: 'paper',
      incomeTime: time,
    });
  }

  if (funding !== 0) {
    rows.push({
      walletId: input.walletId,
      userId: input.userId,
      binanceTranId: nextSyntheticTranId(),
      incomeType: 'FUNDING_FEE',
      amount: funding,
      asset,
      symbol: input.symbol,
      executionId: input.executionId,
      source: 'paper',
      incomeTime: time,
    });
  }

  return insertIncomeEventsBatch(rows);
};
