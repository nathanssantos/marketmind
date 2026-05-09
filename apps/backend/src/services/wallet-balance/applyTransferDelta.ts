import { eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { incomeEvents, wallets } from '../../db/schema';
import { logger, serializeError } from '../logger';
import { getWebSocketService } from '../websocket';
import { nextSyntheticTranId } from '../income-events/syntheticTranId';

export interface TransferDeltaInput {
  walletId: string;
  userId: string;
  asset: string;
  deltaAmount: number;
  eventTime: number;
  reason: string;
  newBalance?: number;
}

export interface TransferDeltaResult {
  tranId: number;
  newBalance: number;
  depositsAdded: number;
  withdrawalsAdded: number;
}

export const applyTransferDelta = async (input: TransferDeltaInput): Promise<TransferDeltaResult | null> => {
  const { walletId, userId, asset, deltaAmount, eventTime, reason, newBalance } = input;

  if (deltaAmount === 0) {
    logger.trace({ walletId, reason }, '[applyTransferDelta] Zero delta — no-op');
    return null;
  }

  const absDelta = Math.abs(deltaAmount);
  const isDeposit = deltaAmount > 0;
  const tranId = nextSyntheticTranId();
  const eventDate = new Date(eventTime);

  try {
    const resolvedBalance = await db.transaction(async (tx) => {
      const depositsExpr = isDeposit
        ? sql`COALESCE(${wallets.totalDeposits}, '0')::numeric + ${absDelta}`
        : sql`COALESCE(${wallets.totalDeposits}, '0')::numeric`;
      const withdrawalsExpr = isDeposit
        ? sql`COALESCE(${wallets.totalWithdrawals}, '0')::numeric`
        : sql`COALESCE(${wallets.totalWithdrawals}, '0')::numeric + ${absDelta}`;
      const balanceExpr = newBalance !== undefined
        ? sql`${newBalance}`
        : sql`COALESCE(${wallets.currentBalance}, '0')::numeric + ${deltaAmount}`;

      const [updated] = await tx
        .update(wallets)
        .set({
          currentBalance: balanceExpr,
          totalDeposits: depositsExpr,
          totalWithdrawals: withdrawalsExpr,
          lastTransferSyncAt: eventDate,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, walletId))
        .returning({ currentBalance: wallets.currentBalance });

      await tx
        .insert(incomeEvents)
        .values({
          walletId,
          userId,
          binanceTranId: tranId,
          incomeType: 'TRANSFER',
          amount: deltaAmount.toString(),
          asset,
          info: `realtime:${reason}`,
          source: 'binance',
          incomeTime: eventDate,
        })
        .onConflictDoNothing({ target: [incomeEvents.walletId, incomeEvents.binanceTranId, incomeEvents.incomeType] });

      return updated?.currentBalance ? parseFloat(updated.currentBalance) : (newBalance ?? 0);
    });

    const wsService = getWebSocketService();
    if (wsService) {
      wsService.emitWalletUpdate(walletId, {
        reason,
        asset,
        delta: deltaAmount,
        newBalance: resolvedBalance,
        eventTime,
      });
    }

    logger.info(
      { walletId, asset, deltaAmount, reason, newBalance: resolvedBalance, tranId },
      '[applyTransferDelta] Wallet transfer applied',
    );

    return {
      tranId,
      newBalance: resolvedBalance,
      depositsAdded: isDeposit ? absDelta : 0,
      withdrawalsAdded: isDeposit ? 0 : absDelta,
    };
  } catch (error) {
    logger.error(
      { walletId, asset, deltaAmount, reason, error: serializeError(error) },
      '[applyTransferDelta] Failed to apply transfer delta',
    );
    throw error;
  }
};
