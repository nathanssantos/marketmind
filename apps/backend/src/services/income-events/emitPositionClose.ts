import type { TradeExecution, Wallet } from '../../db/schema';
import { isPaperWallet } from '../binance-client';
import { synthesizePaperClose } from './synthesizePaperClose';

export interface EmitPositionCloseInput {
  wallet: Wallet;
  execution: Pick<TradeExecution, 'id' | 'userId' | 'symbol'>;
  grossPnl: number;
  totalFees: number;
  accumulatedFunding?: number;
  asset?: string;
  closedAt?: Date;
}

export const emitPositionClose = async (input: EmitPositionCloseInput): Promise<void> => {
  if (!isPaperWallet(input.wallet)) return;

  await synthesizePaperClose({
    walletId: input.wallet.id,
    userId: input.execution.userId,
    executionId: input.execution.id,
    symbol: input.execution.symbol,
    grossPnl: input.grossPnl,
    totalFees: input.totalFees,
    accumulatedFunding: input.accumulatedFunding,
    asset: input.asset,
    closedAt: input.closedAt,
  });
};
