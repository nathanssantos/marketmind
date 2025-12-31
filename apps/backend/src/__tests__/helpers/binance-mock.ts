import { vi } from 'vitest';

export interface BinanceFuturesMock {
  newOrder: ReturnType<typeof vi.fn>;
  cancelOrder: ReturnType<typeof vi.fn>;
  getAllOpenOrders: ReturnType<typeof vi.fn>;
  getPositions: ReturnType<typeof vi.fn>;
  getBalance: ReturnType<typeof vi.fn>;
  setLeverage: ReturnType<typeof vi.fn>;
  setMarginType: ReturnType<typeof vi.fn>;
  getAccountInformation: ReturnType<typeof vi.fn>;
}

export const createBinanceFuturesMock = (): BinanceFuturesMock => ({
  newOrder: vi.fn().mockResolvedValue({ orderId: 123456789, status: 'NEW' }),
  cancelOrder: vi.fn().mockResolvedValue({ orderId: 123456789, status: 'CANCELED' }),
  getAllOpenOrders: vi.fn().mockResolvedValue([]),
  getPositions: vi.fn().mockResolvedValue([]),
  getBalance: vi.fn().mockResolvedValue([{ asset: 'USDT', balance: '10000', availableBalance: '10000' }]),
  setLeverage: vi.fn().mockResolvedValue({ leverage: 10, symbol: 'BTCUSDT' }),
  setMarginType: vi.fn().mockResolvedValue({ code: 200, msg: 'success' }),
  getAccountInformation: vi.fn().mockResolvedValue({
    totalWalletBalance: '10000',
    availableBalance: '10000',
    positions: [],
  }),
});

export interface BinanceSpotMock {
  newOrder: ReturnType<typeof vi.fn>;
  cancelOrder: ReturnType<typeof vi.fn>;
  getAllOpenOrders: ReturnType<typeof vi.fn>;
  getAccountInfo: ReturnType<typeof vi.fn>;
}

export const createBinanceSpotMock = (): BinanceSpotMock => ({
  newOrder: vi.fn().mockResolvedValue({ orderId: 123456789, status: 'NEW' }),
  cancelOrder: vi.fn().mockResolvedValue({ orderId: 123456789, status: 'CANCELED' }),
  getAllOpenOrders: vi.fn().mockResolvedValue([]),
  getAccountInfo: vi.fn().mockResolvedValue({
    balances: [{ asset: 'USDT', free: '10000', locked: '0' }],
  }),
});

export interface MockWebSocketClient {
  on: ReturnType<typeof vi.fn>;
  subscribeUsdFuturesUserDataStream: ReturnType<typeof vi.fn>;
  closeAll: ReturnType<typeof vi.fn>;
  emit: (event: string, data: unknown) => void;
}

export const createWebSocketClientMock = (): MockWebSocketClient => {
  const handlers: Record<string, ((data: unknown) => void)[]> = {};

  return {
    on: vi.fn((event: string, handler: (data: unknown) => void) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    }),
    subscribeUsdFuturesUserDataStream: vi.fn().mockResolvedValue(undefined),
    closeAll: vi.fn(),
    emit: (event: string, data: unknown) => {
      const eventHandlers = handlers[event] || [];
      eventHandlers.forEach(handler => handler(data));
    },
  };
};

export const createFuturesOrderUpdateEvent = (options: {
  symbol?: string;
  orderId?: number;
  status?: string;
  execType?: string;
  side?: 'BUY' | 'SELL';
  positionSide?: 'LONG' | 'SHORT' | 'BOTH';
  avgPrice?: string;
  lastFilledPrice?: string;
  executedQty?: string;
  realizedProfit?: string;
}) => ({
  e: 'ORDER_TRADE_UPDATE',
  E: Date.now(),
  T: Date.now(),
  o: {
    s: options.symbol || 'BTCUSDT',
    c: 'client-order-id',
    S: options.side || 'BUY',
    o: 'LIMIT',
    f: 'GTC',
    q: '0.1',
    p: '50000',
    ap: options.avgPrice || '50000',
    sp: '49000',
    x: options.execType || 'TRADE',
    X: options.status || 'FILLED',
    i: options.orderId || 123456789,
    l: '0.1',
    z: options.executedQty || '0.1',
    L: options.lastFilledPrice || '50000',
    n: '0.5',
    N: 'USDT',
    T: Date.now(),
    t: 123456,
    rp: options.realizedProfit || '0',
    ps: options.positionSide || 'BOTH',
  },
});

export const createFuturesAccountUpdateEvent = (options: {
  reason?: string;
  balances?: Array<{ asset: string; walletBalance: string; crossWalletBalance: string; balanceChange: string }>;
  positions?: Array<{
    symbol: string;
    positionAmount: string;
    entryPrice: string;
    cumulativeRealized: string;
    unrealizedPnL: string;
    marginType: string;
    isolatedWallet: string;
    positionSide: string;
  }>;
}) => ({
  e: 'ACCOUNT_UPDATE',
  E: Date.now(),
  T: Date.now(),
  a: {
    m: options.reason || 'ORDER',
    B: (options.balances || [{ asset: 'USDT', walletBalance: '10000', crossWalletBalance: '10000', balanceChange: '0' }]).map(b => ({
      a: b.asset,
      wb: b.walletBalance,
      cw: b.crossWalletBalance,
      bc: b.balanceChange,
    })),
    P: (options.positions || []).map(p => ({
      s: p.symbol,
      pa: p.positionAmount,
      ep: p.entryPrice,
      cr: p.cumulativeRealized,
      up: p.unrealizedPnL,
      mt: p.marginType,
      iw: p.isolatedWallet,
      ps: p.positionSide,
    })),
  },
});

export const createFuturesMarginCallEvent = (options: {
  crossWalletBalance?: string;
  positions?: Array<{
    symbol: string;
    positionSide: string;
    positionAmount: string;
    marginType: string;
    isolatedWallet: string;
    markPrice: string;
    unrealizedPnL: string;
    maintenanceMargin: string;
  }>;
}) => ({
  e: 'MARGIN_CALL',
  E: Date.now(),
  cw: options.crossWalletBalance || '100',
  p: (options.positions || [{
    symbol: 'BTCUSDT',
    positionSide: 'BOTH',
    positionAmount: '0.1',
    marginType: 'ISOLATED',
    isolatedWallet: '100',
    markPrice: '50000',
    unrealizedPnL: '-50',
    maintenanceMargin: '25',
  }]).map(p => ({
    s: p.symbol,
    ps: p.positionSide,
    pa: p.positionAmount,
    mt: p.marginType,
    iw: p.isolatedWallet,
    mp: p.markPrice,
    up: p.unrealizedPnL,
    mm: p.maintenanceMargin,
  })),
});

export const createFuturesConfigUpdateEvent = (options: {
  symbol?: string;
  leverage?: number;
  multiAssetMode?: boolean;
}) => ({
  e: 'ACCOUNT_CONFIG_UPDATE',
  E: Date.now(),
  T: Date.now(),
  ...(options.symbol && options.leverage !== undefined ? {
    ac: {
      s: options.symbol,
      l: options.leverage,
    },
  } : {}),
  ...(options.multiAssetMode !== undefined ? {
    ai: {
      j: options.multiAssetMode,
    },
  } : {}),
});

export const createMockPosition = (options: {
  symbol?: string;
  positionAmt?: string;
  entryPrice?: string;
  markPrice?: string;
  unrealizedPnL?: string;
  liquidationPrice?: string;
  leverage?: string;
  marginType?: 'ISOLATED' | 'CROSS';
  isolatedWallet?: string;
  notional?: string;
  positionSide?: 'LONG' | 'SHORT' | 'BOTH';
}) => ({
  symbol: options.symbol || 'BTCUSDT',
  positionAmt: options.positionAmt || '0.1',
  entryPrice: options.entryPrice || '50000',
  markPrice: options.markPrice || '51000',
  unRealizedProfit: options.unrealizedPnL || '100',
  liquidationPrice: options.liquidationPrice || '45000',
  leverage: options.leverage || '10',
  marginType: options.marginType || 'ISOLATED',
  isolatedWallet: options.isolatedWallet || '500',
  notional: options.notional || '5100',
  positionSide: options.positionSide || 'BOTH',
});
