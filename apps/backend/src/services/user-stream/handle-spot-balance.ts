import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { wallets } from '../../db/schema';
import { logger, serializeError } from '../logger';
import { getWebSocketService } from '../websocket';
import { applyTransferDelta } from '../wallet-balance';
import type { SpotBalanceUpdate, SpotOutboundAccountPosition } from './types';

const USDT_ASSET = 'USDT';

export const handleOutboundAccountPosition = async (
  walletId: string,
  event: SpotOutboundAccountPosition,
): Promise<void> => {
  try {
    const usdt = event.B.find((b) => b.a === USDT_ASSET);
    if (!usdt) {
      logger.trace({ walletId }, '[SpotUserStream] outboundAccountPosition without USDT — skipping');
      return;
    }

    const free = parseFloat(usdt.f);
    const locked = parseFloat(usdt.l);
    const newBalance = free + locked;

    await db
      .update(wallets)
      .set({
        currentBalance: newBalance.toString(),
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, walletId));

    const wsService = getWebSocketService();
    if (wsService) {
      wsService.emitWalletUpdate(walletId, {
        reason: 'OUTBOUND_ACCOUNT_POSITION',
        asset: USDT_ASSET,
        newBalance,
        eventTime: event.E,
      });
    }

    logger.trace(
      { walletId, newBalance, free, locked },
      '[SpotUserStream] Wallet balance synced from outboundAccountPosition',
    );
  } catch (error) {
    logger.error(
      { walletId, error: serializeError(error) },
      '[SpotUserStream] Error handling outboundAccountPosition',
    );
  }
};

export const handleSpotBalanceUpdate = async (
  walletId: string,
  event: SpotBalanceUpdate,
): Promise<void> => {
  try {
    if (event.a !== USDT_ASSET) {
      logger.trace({ walletId, asset: event.a }, '[SpotUserStream] balanceUpdate non-USDT — skipping');
      return;
    }

    const delta = parseFloat(event.d);
    if (!Number.isFinite(delta) || delta === 0) {
      logger.trace({ walletId, delta: event.d }, '[SpotUserStream] balanceUpdate zero/invalid delta — skipping');
      return;
    }

    const [wallet] = await db
      .select({ userId: wallets.userId })
      .from(wallets)
      .where(eq(wallets.id, walletId))
      .limit(1);

    if (!wallet) {
      logger.warn({ walletId }, '[SpotUserStream] balanceUpdate for unknown wallet — skipping');
      return;
    }

    await applyTransferDelta({
      walletId,
      userId: wallet.userId,
      asset: USDT_ASSET,
      deltaAmount: delta,
      eventTime: event.E,
      reason: 'BALANCE_UPDATE',
    });
  } catch (error) {
    logger.error(
      { walletId, error: serializeError(error) },
      '[SpotUserStream] Error handling balanceUpdate',
    );
  }
};
