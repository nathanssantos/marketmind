import { useEffect } from 'react';
import { CLIENT_TO_SERVER_EVENTS, ROOMS } from '@marketmind/types';
import { socketBus } from '../../services/socketBus';

const helpers = {
  bookTicker: {
    room: ROOMS.bookTicker,
    sub: CLIENT_TO_SERVER_EVENTS.subscribeBookTicker,
    unsub: CLIENT_TO_SERVER_EVENTS.unsubscribeBookTicker,
  },
  aggTrades: {
    room: ROOMS.aggTrades,
    sub: CLIENT_TO_SERVER_EVENTS.subscribeAggTrades,
    unsub: CLIENT_TO_SERVER_EVENTS.unsubscribeAggTrades,
  },
  depth: {
    room: ROOMS.depth,
    sub: CLIENT_TO_SERVER_EVENTS.subscribeDepth,
    unsub: CLIENT_TO_SERVER_EVENTS.unsubscribeDepth,
  },
  liquidityHeatmap: {
    room: ROOMS.liquidityHeatmap,
    sub: CLIENT_TO_SERVER_EVENTS.subscribeLiquidityHeatmap,
    unsub: CLIENT_TO_SERVER_EVENTS.unsubscribeLiquidityHeatmap,
  },
  scalpingMetrics: {
    room: ROOMS.scalpingMetrics,
    sub: CLIENT_TO_SERVER_EVENTS.subscribeScalpingMetrics,
    unsub: CLIENT_TO_SERVER_EVENTS.unsubscribeScalpingMetrics,
  },
} as const;

type SymbolStreamKind = keyof typeof helpers;

export const useSymbolStreamSubscription = (kind: SymbolStreamKind, symbol: string | undefined): void => {
  useEffect(() => {
    if (!symbol) return;
    const cfg = helpers[kind];
    return socketBus.subscribeRoom({
      dedupKey: cfg.room(symbol),
      subscribe: () => socketBus.emit(cfg.sub, symbol),
      unsubscribe: () => socketBus.emit(cfg.unsub, symbol),
    });
  }, [kind, symbol]);
};

const walletStreamHelpers = {
  autoTradingLogs: {
    room: ROOMS.autoTradingLogs,
    sub: CLIENT_TO_SERVER_EVENTS.subscribeAutoTradingLogs,
    unsub: CLIENT_TO_SERVER_EVENTS.unsubscribeAutoTradingLogs,
  },
  scalpingSignals: {
    room: ROOMS.scalpingSignals,
    sub: CLIENT_TO_SERVER_EVENTS.subscribeScalpingSignals,
    unsub: CLIENT_TO_SERVER_EVENTS.unsubscribeScalpingSignals,
  },
} as const;

type WalletStreamKind = keyof typeof walletStreamHelpers;

export const useWalletStreamSubscription = (kind: WalletStreamKind, walletId: string | undefined): void => {
  useEffect(() => {
    if (!walletId) return;
    const cfg = walletStreamHelpers[kind];
    return socketBus.subscribeRoom({
      dedupKey: cfg.room(walletId),
      subscribe: () => socketBus.emit(cfg.sub, walletId),
      unsubscribe: () => socketBus.emit(cfg.unsub, walletId),
    });
  }, [kind, walletId]);
};
