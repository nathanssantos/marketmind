import { useEffect } from 'react';
import { CLIENT_TO_SERVER_EVENTS, ROOMS } from '@marketmind/types';
import { socketBus } from '../../services/socketBus';

/**
 * Subscribe the socket to the orders/positions/wallet rooms for a single
 * wallet. Single-wallet variant — kept for callers that only manage one
 * wallet's UI surface (chart panels, ticket, etc.).
 */
export const useWalletSubscription = (walletId: string | undefined): void => {
  useEffect(() => {
    if (!walletId) return;
    const subs: Array<() => void> = [
      socketBus.subscribeRoom({
        dedupKey: ROOMS.orders(walletId),
        subscribe: () => socketBus.emit(CLIENT_TO_SERVER_EVENTS.subscribeOrders, walletId),
        unsubscribe: () => socketBus.emit(CLIENT_TO_SERVER_EVENTS.unsubscribeOrders, walletId),
      }),
      socketBus.subscribeRoom({
        dedupKey: ROOMS.positions(walletId),
        subscribe: () => socketBus.emit(CLIENT_TO_SERVER_EVENTS.subscribePositions, walletId),
        unsubscribe: () => socketBus.emit(CLIENT_TO_SERVER_EVENTS.unsubscribePositions, walletId),
      }),
      socketBus.subscribeRoom({
        dedupKey: ROOMS.wallet(walletId),
        subscribe: () => socketBus.emit(CLIENT_TO_SERVER_EVENTS.subscribeWallet, walletId),
        unsubscribe: () => socketBus.emit(CLIENT_TO_SERVER_EVENTS.unsubscribeWallet, walletId),
      }),
    ];
    return () => subs.forEach((fn) => fn());
  }, [walletId]);
};

/**
 * Subscribe to wallet:update for EVERY wallet the user owns — not just
 * the focused one. Without this, closing a trade on wallet B never
 * patches its row in wallet.list because the socket isn't in B's room
 * and the event is dropped at the server. User-reported symptom: had
 * to click "Sync balance from Binance" after every close to see the
 * updated balance.
 *
 * Orders/positions stay single-subscription (`useWalletSubscription`)
 * because the renderer's ticket/chart caches are keyed on the focused
 * wallet — extending them to every wallet would multiply payload
 * volume without changing visible behavior.
 */
export const useAllWalletsBalanceSubscription = (walletIds: readonly string[]): void => {
  const dedupKey = walletIds.join('|');
  useEffect(() => {
    if (walletIds.length === 0) return;
    const subs: Array<() => void> = [];
    for (const walletId of walletIds) {
      subs.push(
        socketBus.subscribeRoom({
          dedupKey: ROOMS.wallet(walletId),
          subscribe: () => socketBus.emit(CLIENT_TO_SERVER_EVENTS.subscribeWallet, walletId),
          unsubscribe: () => socketBus.emit(CLIENT_TO_SERVER_EVENTS.unsubscribeWallet, walletId),
        }),
      );
    }
    return () => subs.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dedupKey]);
};

export const useUserChannelSubscription = (userId: string | undefined): void => {
  useEffect(() => {
    if (!userId) return;
    return socketBus.subscribeRoom({
      dedupKey: ROOMS.user(userId),
      subscribe: () => socketBus.emit(CLIENT_TO_SERVER_EVENTS.subscribeSetups, userId),
      unsubscribe: () => socketBus.emit(CLIENT_TO_SERVER_EVENTS.unsubscribeSetups, userId),
    });
  }, [userId]);
};
