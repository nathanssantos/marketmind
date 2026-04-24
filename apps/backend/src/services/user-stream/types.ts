import type { USDMClient } from 'binance';
import { type WebsocketClient } from 'binance';
import type { Wallet } from '../../db/schema';

export interface FuturesAccountUpdate {
  e: 'ACCOUNT_UPDATE';
  E: number;
  T: number;
  a: {
    m: string;
    B: Array<{ a: string; wb: string; cw: string; bc: string }>;
    P: Array<{
      s: string;
      pa: string;
      ep: string;
      cr: string;
      up: string;
      mt: string;
      iw: string;
      ps: string;
    }>;
  };
}

export interface FuturesOrderUpdate {
  e: 'ORDER_TRADE_UPDATE';
  E: number;
  T: number;
  o: {
    s: string;
    c: string;
    S: 'BUY' | 'SELL';
    o: string;
    f: string;
    q: string;
    p: string;
    ap: string;
    sp: string;
    x: string;
    X: string;
    i: number;
    l: string;
    z: string;
    L: string;
    n: string;
    N: string;
    T: number;
    t: number;
    rp: string;
    ps: 'LONG' | 'SHORT' | 'BOTH';
  };
}

export interface FuturesMarginCall {
  e: 'MARGIN_CALL';
  E: number;
  cw: string;
  p: Array<{
    s: string;
    ps: string;
    pa: string;
    mt: string;
    iw: string;
    mp: string;
    up: string;
    mm: string;
  }>;
}

export interface FuturesAccountConfigUpdate {
  e: 'ACCOUNT_CONFIG_UPDATE';
  E: number;
  T: number;
  ac?: {
    s: string;
    l: number;
  };
  ai?: {
    j: boolean;
  };
}

export interface FuturesAlgoOrderUpdate {
  e: 'ALGO_UPDATE';
  E: number;
  T: number;
  o: {
    aid: number;
    caid: string;
    at: string;
    s: string;
    S: 'BUY' | 'SELL';
    o: string;
    ps: 'LONG' | 'SHORT' | 'BOTH';
    f: string;
    q: string;
    X: 'NEW' | 'CANCELED' | 'TRIGGERING' | 'TRIGGERED' | 'FINISHED' | 'REJECTED' | 'EXPIRED';
    ai: string;
    ap: string;
    aq: string;
    tp: string;
    p: string;
    wt: string;
    R: boolean;
    cp: boolean;
    pP: boolean;
  };
}

export interface FuturesConditionalOrderReject {
  e: 'CONDITIONAL_ORDER_TRIGGER_REJECT';
  E: number;
  T: number;
  or: {
    s: string;
    i: number;
    r: string;
  };
}

export interface FuturesTradeLite {
  e: 'TRADE_LITE';
  E: number;
  T: number;
  s: string;
  q: string;
  p: string;
  m: boolean;
  c: string;
  S: 'BUY' | 'SELL';
  L: string;
  l: string;
  t: number;
  i: number;
}

export interface FuturesStrategyUpdate {
  e: 'STRATEGY_UPDATE';
  E: number;
  T: number;
  su: Record<string, unknown>;
}

export interface FuturesGridUpdate {
  e: 'GRID_UPDATE';
  E: number;
  T: number;
  gu: Record<string, unknown>;
}

export interface FuturesListenKeyExpired {
  e: 'listenKeyExpired';
  E: number;
}

export type FuturesUserDataEvent =
  | FuturesOrderUpdate
  | FuturesAccountUpdate
  | FuturesMarginCall
  | FuturesAccountConfigUpdate
  | FuturesAlgoOrderUpdate
  | FuturesConditionalOrderReject
  | FuturesTradeLite
  | FuturesStrategyUpdate
  | FuturesGridUpdate
  | FuturesListenKeyExpired;

export interface SpotExecutionReport {
  e: 'executionReport';
  E: number;
  s: string;
  c: string;
  S: 'BUY' | 'SELL';
  o: string;
  f: string;
  q: string;
  p: string;
  P: string;
  F: string;
  g: number;
  C: string;
  x: string;
  X: string;
  r: string;
  i: number;
  l: string;
  z: string;
  L: string;
  n: string;
  N: string | null;
  T: number;
  t: number;
  I: number;
  w: boolean;
  m: boolean;
  M: boolean;
  O: number;
  Z: string;
  Y: string;
  Q: string;
}

export interface SpotOutboundAccountPosition {
  e: 'outboundAccountPosition';
  E: number;
  u: number;
  B: Array<{ a: string; f: string; l: string }>;
}

export interface SpotBalanceUpdate {
  e: 'balanceUpdate';
  E: number;
  a: string;
  d: string;
  T: number;
}

export interface SpotListStatus {
  e: 'listStatus';
  E: number;
  s: string;
  g: number;
  c: string;
  l: string;
  L: string;
  r: string;
  C: string;
  T: number;
  O: Array<{ s: string; i: number; c: string }>;
}

export interface SpotListenKeyExpired {
  e: 'listenKeyExpired';
  E: number;
}

export interface SpotEventStreamTerminated {
  e: 'eventStreamTerminated';
  E: number;
}

export type SpotUserDataEvent =
  | SpotExecutionReport
  | SpotOutboundAccountPosition
  | SpotBalanceUpdate
  | SpotListStatus
  | SpotListenKeyExpired
  | SpotEventStreamTerminated;

export interface UserStreamContext {
  connections: Map<string, { wsClient: WebsocketClient; apiClient: USDMClient }>;
  getCachedWallet(walletId: string): Promise<Wallet | null>;
  invalidateWalletCache(walletId: string): void;
  withPyramidLock<T>(walletId: string, symbol: string, fn: () => Promise<T>): Promise<T>;
  mergeIntoExistingPosition(walletId: string, symbol: string, existingExecId: string, addedQty: number, addedPrice: number, deleteExecId?: string, logContext?: string): Promise<void>;
  syncPositionFromExchange(walletId: string, symbol: string, executionId: string, logContext: string): Promise<boolean>;
  scheduleDebouncedSlTpUpdate(executionId: string, walletId: string, symbol: string): void;
  cancelPendingEntryOrders(walletId: string, symbol: string, closedExecutionId: string): Promise<void>;
  closeResidualPosition(walletId: string, symbol: string, executionId: string): Promise<void>;
  verifyAlgoFillProcessed(walletId: string, executionId: string, symbol: string, side: 'LONG' | 'SHORT', openedAt: number, exitReason: string): Promise<void>;
  recentAlgoEntrySymbols: Map<string, number>;
}
