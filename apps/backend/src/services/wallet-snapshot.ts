import { eq } from 'drizzle-orm';
import type { USDMClient } from 'binance';
import type { db as dbType } from '../db';
import { wallets } from '../db/schema';
import { getAccountInfo } from './binance-futures-client';
import { logger, serializeError } from './logger';

interface WalletForSnapshot {
  id: string;
  userId: string;
  totalWalletBalance?: string | null;
  currentBalance?: string | null;
}

export interface WalletSnapshot {
  totalWalletBalance: string;
  currentBalance: string;
}

/**
 * Refresh the local wallet snapshot from Binance immediately after an
 * order/position state change. Used by every live futures mutation
 * that affects margin or capital so the frontend's `wallet.list` cache
 * reflects realtime balance the moment the mutation resolves —
 * instead of waiting for the user-stream WS to catch up (typically
 * 200-500ms; sometimes seconds during a reconnect).
 *
 * Returns the updated snapshot for inline use in mutation responses
 * — frontend mutation handlers `setQueryData` from this without an
 * extra refetch. Errors are swallowed and logged: if Binance doesn't
 * answer, the user-stream's eventual update is still authoritative.
 *
 * Single home for the helper — previously inline in
 * `position-mutations.ts`, leading to N copies as more mutations
 * needed it (closePosition, closePositionAndCancelOrders,
 * reversePosition, createOrder).
 */
export const syncLiveWalletSnapshot = async (
  ctx: { db: typeof dbType },
  wallet: WalletForSnapshot,
  client: USDMClient,
): Promise<WalletSnapshot | null> => {
  try {
    const account = await getAccountInfo(client);
    const totalWalletBalance = account.totalWalletBalance;
    // currentBalance kept in sync with totalWalletBalance — both
    // fields are read by the frontend (`portfolio.walletBalance ??
    // .balance`) and tests reconcile via `totalWalletBalance` first.
    const currentBalance = totalWalletBalance;
    await ctx.db
      .update(wallets)
      .set({ totalWalletBalance, currentBalance, updatedAt: new Date() })
      .where(eq(wallets.id, wallet.id));
    return { totalWalletBalance, currentBalance };
  } catch (err) {
    logger.warn(
      { walletId: wallet.id, error: serializeError(err) },
      '[wallet-snapshot] Failed to refresh live wallet snapshot — relying on user-stream',
    );
    return null;
  }
};
