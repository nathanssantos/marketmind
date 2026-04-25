import type { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, type Socket as IOSocket } from 'socket.io';
import {
  CLIENT_TO_SERVER_EVENTS,
  ROOMS,
  ROOM_PREFIXES,
  SERVER_TO_CLIENT_EVENTS,
  type AppNotificationPayload,
  type AutoTradingLogEntryPayload,
  type BackfillProgressPayload,
  type ClientToServerEvents,
  type DailyLossLimitPayload,
  type KlineSubscribePayload,
  type KlineUpdatePayload,
  type LiquidationWarningPayload,
  type PositionClosedPayload,
  type RiskAlertPayload,
  type ServerToClientEvents,
  type SetupDetectedPayload,
  type SignalSuggestionPayload,
  type StreamHealthPayload,
  type TradeNotificationPayload,
} from '@marketmind/types';
import { binancePriceStreamService } from './binance-price-stream';
import { binanceAggTradeStreamService } from './binance-agg-trade-stream';
import { binanceBookTickerStreamService } from './binance-book-ticker-stream';
import { binanceDepthStreamService } from './binance-depth-stream';
import type { AggTrade, BookTickerUpdate, DepthUpdate, LiquidityHeatmapBucket, ScalpingMetrics, ScalpingSignal } from '@marketmind/types';

let _getCustomSymbolService: (() => { isCustomSymbolSync: (s: string) => boolean } | null) | null = null;
let _importPromise: Promise<void> | null = null;

const ensureCustomSymbolImport = (): void => {
  if (_importPromise) return;
  _importPromise = import('./custom-symbol-service').then(mod => {
    _getCustomSymbolService = mod.getCustomSymbolService;
  });
};

const isCustomSymbol = (symbol: string): boolean => {
  if (!_getCustomSymbolService) return false;
  return _getCustomSymbolService()?.isCustomSymbolSync(symbol) ?? false;
};

export interface SocketData {
  userId?: number;
  sessionToken?: string;
}

type TypedSocket = IOSocket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type TypedServer = SocketIOServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

interface RoomHandler<E extends keyof ClientToServerEvents> {
  subscribe: E;
  unsubscribe: keyof ClientToServerEvents;
  room: (payload: Parameters<ClientToServerEvents[E]>[0]) => string | string[] | null;
  onJoin?: (payload: Parameters<ClientToServerEvents[E]>[0], socket: TypedSocket, service: WebSocketService) => void;
  onLeave?: (payload: Parameters<ClientToServerEvents[E]>[0], socket: TypedSocket, service: WebSocketService) => void;
}

const skipCustomSymbol = (symbol: string, action: () => void): void => {
  if (!isCustomSymbol(symbol)) action();
};

const ROOM_HANDLERS: Array<RoomHandler<keyof ClientToServerEvents>> = [
  {
    subscribe: CLIENT_TO_SERVER_EVENTS.subscribeOrders,
    unsubscribe: CLIENT_TO_SERVER_EVENTS.unsubscribeOrders,
    room: (walletId) => ROOMS.orders(walletId as string),
  },
  {
    subscribe: CLIENT_TO_SERVER_EVENTS.subscribePositions,
    unsubscribe: CLIENT_TO_SERVER_EVENTS.unsubscribePositions,
    room: (walletId) => ROOMS.positions(walletId as string),
  },
  {
    subscribe: CLIENT_TO_SERVER_EVENTS.subscribeWallet,
    unsubscribe: CLIENT_TO_SERVER_EVENTS.unsubscribeWallet,
    room: (walletId) => ROOMS.wallet(walletId as string),
  },
  {
    subscribe: CLIENT_TO_SERVER_EVENTS.subscribePrices,
    unsubscribe: CLIENT_TO_SERVER_EVENTS.unsubscribePrices,
    room: (symbol) => ROOMS.prices(symbol as string),
    onJoin: (symbol, _, svc) => {
      skipCustomSymbol(symbol as string, () => binancePriceStreamService.subscribeSymbol(symbol as string));
      svc.emitActiveSymbolsChanged();
    },
    onLeave: (_, __, svc) => svc.emitActiveSymbolsChanged(),
  },
  {
    subscribe: CLIENT_TO_SERVER_EVENTS.subscribePricesBatch,
    unsubscribe: CLIENT_TO_SERVER_EVENTS.unsubscribePrices,
    room: (symbols) => Array.isArray(symbols) ? (symbols as string[]).map(ROOMS.prices) : null,
    onJoin: (symbols, _, svc) => {
      if (!Array.isArray(symbols)) return;
      for (const symbol of symbols as string[]) {
        skipCustomSymbol(symbol, () => binancePriceStreamService.subscribeSymbol(symbol));
      }
      svc.emitActiveSymbolsChanged();
    },
  },
  {
    subscribe: CLIENT_TO_SERVER_EVENTS.subscribeKlines,
    unsubscribe: CLIENT_TO_SERVER_EVENTS.unsubscribeKlines,
    room: (data) => {
      const d = data as KlineSubscribePayload;
      return ROOMS.klines(d.symbol, d.interval);
    },
  },
  {
    subscribe: CLIENT_TO_SERVER_EVENTS.subscribeSetups,
    unsubscribe: CLIENT_TO_SERVER_EVENTS.unsubscribeSetups,
    room: (userId) => ROOMS.user(userId as string),
  },
  {
    subscribe: CLIENT_TO_SERVER_EVENTS.subscribeAutoTradingLogs,
    unsubscribe: CLIENT_TO_SERVER_EVENTS.unsubscribeAutoTradingLogs,
    room: (walletId) => ROOMS.autoTradingLogs(walletId as string),
  },
  {
    subscribe: CLIENT_TO_SERVER_EVENTS.subscribeBookTicker,
    unsubscribe: CLIENT_TO_SERVER_EVENTS.unsubscribeBookTicker,
    room: (symbol) => ROOMS.bookTicker(symbol as string),
    onJoin: (symbol) => skipCustomSymbol(symbol as string, () => binanceBookTickerStreamService.subscribe(symbol as string)),
  },
  {
    subscribe: CLIENT_TO_SERVER_EVENTS.subscribeAggTrades,
    unsubscribe: CLIENT_TO_SERVER_EVENTS.unsubscribeAggTrades,
    room: (symbol) => ROOMS.aggTrades(symbol as string),
    onJoin: (symbol) => skipCustomSymbol(symbol as string, () => binanceAggTradeStreamService.subscribe(symbol as string)),
  },
  {
    subscribe: CLIENT_TO_SERVER_EVENTS.subscribeDepth,
    unsubscribe: CLIENT_TO_SERVER_EVENTS.unsubscribeDepth,
    room: (symbol) => ROOMS.depth(symbol as string),
    onJoin: (symbol) => skipCustomSymbol(symbol as string, () => binanceDepthStreamService.subscribe(symbol as string)),
  },
  {
    subscribe: CLIENT_TO_SERVER_EVENTS.subscribeLiquidityHeatmap,
    unsubscribe: CLIENT_TO_SERVER_EVENTS.unsubscribeLiquidityHeatmap,
    room: (symbol) => ROOMS.liquidityHeatmap(symbol as string),
    onJoin: (symbol, socket, svc) => void svc.sendLiquidityHeatmapSnapshot(socket, symbol as string),
  },
  {
    subscribe: CLIENT_TO_SERVER_EVENTS.subscribeScalpingMetrics,
    unsubscribe: CLIENT_TO_SERVER_EVENTS.unsubscribeScalpingMetrics,
    room: (symbol) => ROOMS.scalpingMetrics(symbol as string),
  },
  {
    subscribe: CLIENT_TO_SERVER_EVENTS.subscribeScalpingSignals,
    unsubscribe: CLIENT_TO_SERVER_EVENTS.unsubscribeScalpingSignals,
    room: (walletId) => ROOMS.scalpingSignals(walletId as string),
  },
];

export class WebSocketService {
  private io: TypedServer;

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
      cors: {
        origin: (origin, callback) => {
          if (!origin) {
            callback(null, true);
            return;
          }

          const isDev = process.env['NODE_ENV'] === 'development';
          if (isDev) {
            const isLocalhost = /^http:\/\/localhost:\d+$/.test(origin);
            callback(null, isLocalhost);
          } else {
            const allowedOrigin = process.env['CORS_ORIGIN'] ?? 'http://localhost:5173';
            callback(null, origin === allowedOrigin);
          }
        },
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    this.io.use((socket, next) => {
      const sessionToken = socket.handshake.auth['token'];
      if (sessionToken) socket.data.sessionToken = sessionToken;
      next();
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      for (const handler of ROOM_HANDLERS) {
        this.registerRoomHandler(socket, handler);
      }
    });
  }

  private registerRoomHandler<E extends keyof ClientToServerEvents>(
    socket: TypedSocket,
    handler: RoomHandler<E>,
  ): void {
    type Payload = Parameters<ClientToServerEvents[E]>[0];
    const onSubscribe = (payload: Payload): void => {
      const room = handler.room(payload);
      if (!room) return;
      const rooms = Array.isArray(room) ? room : [room];
      for (const r of rooms) {
        if (!socket.rooms.has(r)) void socket.join(r);
      }
      handler.onJoin?.(payload, socket, this);
    };
    const onUnsubscribe = (payload: Payload): void => {
      const room = handler.room(payload);
      if (!room) return;
      const rooms = Array.isArray(room) ? room : [room];
      for (const r of rooms) void socket.leave(r);
      handler.onLeave?.(payload, socket, this);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket.on as any)(handler.subscribe, onSubscribe);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket.on as any)(handler.unsubscribe, onUnsubscribe);
  }

  public emitOrderUpdate(walletId: string, order: unknown): void {
    this.io.to(ROOMS.orders(walletId)).emit(SERVER_TO_CLIENT_EVENTS.orderUpdate, order);
  }

  public emitOrderCreated(walletId: string, order: unknown): void {
    this.io.to(ROOMS.orders(walletId)).emit(SERVER_TO_CLIENT_EVENTS.orderCreated, order);
  }

  public emitOrderCancelled(walletId: string, orderId: string): void {
    this.io.to(ROOMS.orders(walletId)).emit(SERVER_TO_CLIENT_EVENTS.orderCancelled, { orderId });
  }

  public emitPositionUpdate(walletId: string, position: unknown): void {
    this.io.to(ROOMS.positions(walletId)).emit(SERVER_TO_CLIENT_EVENTS.positionUpdate, position);
  }

  public emitWalletUpdate(walletId: string, wallet: unknown): void {
    this.io.to(ROOMS.wallet(walletId)).emit(SERVER_TO_CLIENT_EVENTS.walletUpdate, wallet);
  }

  public emitPriceUpdate(symbol: string, price: number, timestamp: number): void {
    this.io.to(ROOMS.prices(symbol)).emit(SERVER_TO_CLIENT_EVENTS.priceUpdate, { symbol, price, timestamp });
  }

  public emitKlineUpdate(kline: KlineUpdatePayload): void {
    this.io.to(ROOMS.klines(kline.symbol, kline.interval)).emit(SERVER_TO_CLIENT_EVENTS.klineUpdate, kline);
  }

  public emitStreamHealth(payload: StreamHealthPayload): void {
    this.io.to(ROOMS.klines(payload.symbol, payload.interval)).emit(SERVER_TO_CLIENT_EVENTS.streamHealth, payload);
  }

  public emitSetupDetected(userId: string, data: SetupDetectedPayload): void {
    this.io.to(ROOMS.user(userId)).emit(SERVER_TO_CLIENT_EVENTS.setupDetected, data);
  }

  public emitSignalSuggestion(userId: string, suggestion: SignalSuggestionPayload): void {
    this.io.to(ROOMS.user(userId)).emit(SERVER_TO_CLIENT_EVENTS.signalSuggestion, suggestion);
  }

  public emitSessionScanResult(userId: string, sessionId: string, presetId: string, results: unknown): void {
    this.io.to(ROOMS.user(userId)).emit(SERVER_TO_CLIENT_EVENTS.sessionScanResult, { sessionId, presetId, results });
  }

  public emitRiskAlert(walletId: string, alert: RiskAlertPayload): void {
    this.io.to(ROOMS.wallet(walletId)).emit(SERVER_TO_CLIENT_EVENTS.riskAlert, alert);
  }

  public emitPositionClosed(walletId: string, data: PositionClosedPayload): void {
    this.io.to(ROOMS.positions(walletId)).emit(SERVER_TO_CLIENT_EVENTS.positionClosed, data);
  }

  public emitDailyLossLimitReached(walletId: string, data: DailyLossLimitPayload): void {
    this.io.to(ROOMS.wallet(walletId)).emit(SERVER_TO_CLIENT_EVENTS.riskDailyLossLimit, data);
  }

  public emitLiquidationWarning(walletId: string, data: LiquidationWarningPayload): void {
    this.io.to(ROOMS.wallet(walletId)).emit(SERVER_TO_CLIENT_EVENTS.riskLiquidationWarning, data);
  }

  public emitTradeNotification(walletId: string, notification: TradeNotificationPayload): void {
    this.io.to(ROOMS.positions(walletId)).emit(SERVER_TO_CLIENT_EVENTS.tradeNotification, notification);
  }

  public emitNotification(walletId: string, notification: AppNotificationPayload): void {
    this.io.to(ROOMS.wallet(walletId)).emit(SERVER_TO_CLIENT_EVENTS.notification, notification);
  }

  public emitAutoTradingLog(walletId: string, entry: AutoTradingLogEntryPayload): void {
    this.io.to(ROOMS.autoTradingLogs(walletId)).emit(SERVER_TO_CLIENT_EVENTS.autoTradingLog, entry);
  }

  public emitBookTickerUpdate(symbol: string, update: BookTickerUpdate): void {
    this.io.to(ROOMS.bookTicker(symbol)).emit(SERVER_TO_CLIENT_EVENTS.bookTickerUpdate, update);
  }

  public emitAggTradeUpdate(symbol: string, trade: AggTrade, isLargeTrade: boolean): void {
    this.io.to(ROOMS.aggTrades(symbol)).emit(SERVER_TO_CLIENT_EVENTS.aggTradeUpdate, { ...trade, isLargeTrade });
  }

  public emitDepthUpdate(symbol: string, update: DepthUpdate): void {
    this.io.to(ROOMS.depth(symbol)).emit(SERVER_TO_CLIENT_EVENTS.depthUpdate, update);
  }

  public emitScalpingMetrics(symbol: string, metrics: ScalpingMetrics): void {
    this.io.to(ROOMS.scalpingMetrics(symbol)).emit(SERVER_TO_CLIENT_EVENTS.scalpingMetricsUpdate, metrics);
  }

  public emitScalpingSignal(walletId: string, signal: ScalpingSignal): void {
    this.io.to(ROOMS.scalpingSignals(walletId)).emit(SERVER_TO_CLIENT_EVENTS.scalpingSignalNew, signal);
  }

  public emitLiquidityHeatmapBucket(symbol: string, bucket: LiquidityHeatmapBucket, priceBinSize: number, maxQuantity: number): void {
    this.io.to(ROOMS.liquidityHeatmap(symbol)).emit(SERVER_TO_CLIENT_EVENTS.liquidityHeatmapBucket, { symbol, bucket, priceBinSize, maxQuantity });
  }

  public async sendLiquidityHeatmapSnapshot(socket: TypedSocket, symbol: string): Promise<void> {
    try {
      const { liquidityHeatmapAggregator } = await import('./liquidity-heatmap-aggregator');
      const snapshot = await liquidityHeatmapAggregator.getSnapshot(symbol);
      if (snapshot) socket.emit(SERVER_TO_CLIENT_EVENTS.liquidityHeatmapSnapshot, snapshot);
    } catch {
      // aggregator not yet initialized
    }
  }

  public getActiveRooms(prefix: string): string[] {
    const result = new Set<string>();
    const rooms = this.io.sockets.adapter.rooms;
    for (const [roomName] of rooms) {
      if (!roomName.startsWith(prefix)) continue;
      const key = roomName.slice(prefix.length);
      if (key) result.add(key);
    }
    return Array.from(result).sort();
  }

  public getActivelyViewedSymbols(): string[] {
    return this.getActiveRooms(ROOM_PREFIXES.prices);
  }

  public emitActiveSymbolsChanged(): void {
    this.io.emit(SERVER_TO_CLIENT_EVENTS.symbolsActiveUpdated, this.getActivelyViewedSymbols());
  }

  public emitBackfillProgress(walletId: string, data: BackfillProgressPayload): void {
    this.io.to(ROOMS.wallet(walletId)).emit(SERVER_TO_CLIENT_EVENTS.backfillProgress, data);
  }

  public getIO(): TypedServer {
    return this.io;
  }
}

let websocketService: WebSocketService | null = null;

export const initializeWebSocket = (httpServer: HTTPServer): WebSocketService => {
  if (!websocketService) {
    websocketService = new WebSocketService(httpServer);
    ensureCustomSymbolImport();
  }
  return websocketService;
};

export const getWebSocketService = (): WebSocketService | null => {
  return websocketService;
};
