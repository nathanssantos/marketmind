import { useEffect } from 'react';
import { CLIENT_TO_SERVER_EVENTS, ROOMS } from '@marketmind/types';
import { socketBus } from '../../services/socketBus';

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
