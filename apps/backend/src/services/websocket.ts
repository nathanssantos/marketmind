import type { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { binancePriceStreamService } from './binance-price-stream';

export interface SocketData {
  userId?: number;
  sessionToken?: string;
}

export class WebSocketService {
  private io: SocketIOServer;

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
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
      
      if (sessionToken) {
        (socket.data as SocketData).sessionToken = sessionToken;
      }
      
      next();
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {

      socket.on('subscribe:orders', (walletId: string) => {
        const room = `orders:${walletId}`;
        if (!socket.rooms.has(room)) {
          socket.join(room);
        }
      });

      socket.on('subscribe:positions', (walletId: string) => {
        const room = `positions:${walletId}`;
        if (!socket.rooms.has(room)) {
          socket.join(room);
        }
      });

      socket.on('subscribe:prices', (symbol: string) => {
        const room = `prices:${symbol}`;
        if (!socket.rooms.has(room)) {
          socket.join(room);
          binancePriceStreamService.subscribeSymbol(symbol);
        }
      });

      socket.on('subscribe:klines', (data: { symbol: string; interval: string }) => {
        const room = `klines:${data.symbol}:${data.interval}`;
        if (!socket.rooms.has(room)) {
          socket.join(room);
        }
      });

      socket.on('unsubscribe:klines', (data: { symbol: string; interval: string }) => {
        const room = `klines:${data.symbol}:${data.interval}`;
        socket.leave(room);
      });

      socket.on('unsubscribe:orders', (walletId: string) => {
        socket.leave(`orders:${walletId}`);
      });

      socket.on('unsubscribe:positions', (walletId: string) => {
        socket.leave(`positions:${walletId}`);
      });

      socket.on('unsubscribe:prices', (symbol: string) => {
        socket.leave(`prices:${symbol}`);
      });

      socket.on('subscribe:wallet', (walletId: string) => {
        const room = `wallet:${walletId}`;
        if (!socket.rooms.has(room)) {
          socket.join(room);
        }
      });

      socket.on('unsubscribe:wallet', (walletId: string) => {
        socket.leave(`wallet:${walletId}`);
      });

      socket.on('subscribe:setups', (userId: string) => {
        const room = `user:${userId}`;
        if (!socket.rooms.has(room)) {
          socket.join(room);
        }
      });

      socket.on('unsubscribe:setups', (userId: string) => {
        socket.leave(`user:${userId}`);
      });

      socket.on('disconnect', () => {
      });
    });
  }

  public emitOrderUpdate(walletId: string, order: unknown): void {
    this.io.to(`orders:${walletId}`).emit('order:update', order);
  }

  public emitOrderCreated(walletId: string, order: unknown): void {
    this.io.to(`orders:${walletId}`).emit('order:created', order);
  }

  public emitOrderCancelled(walletId: string, orderId: string): void {
    this.io.to(`orders:${walletId}`).emit('order:cancelled', { orderId });
  }

  public emitPositionUpdate(walletId: string, position: unknown): void {
    this.io.to(`positions:${walletId}`).emit('position:update', position);
  }

  public emitWalletUpdate(walletId: string, wallet: unknown): void {
    this.io.to(`wallet:${walletId}`).emit('wallet:update', wallet);
  }

  public emitPriceUpdate(symbol: string, price: number, timestamp: number): void {
    this.io.to(`prices:${symbol}`).emit('price:update', { symbol, price, timestamp });
  }

  public emitKlineUpdate(kline: {
    symbol: string;
    interval: string;
    openTime: number;
    closeTime: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    isClosed: boolean;
    timestamp: number;
  }): void {
    const room = `klines:${kline.symbol}:${kline.interval}`;
    this.io.to(room).emit('kline:update', kline);
  }

  public emitSetupDetected(userId: string, data: unknown): void {
    this.io.to(`user:${userId}`).emit('setup-detected', data);
  }

  public emitRiskAlert(walletId: string, alert: {
    type: 'LIQUIDATION_RISK' | 'DAILY_LOSS_LIMIT' | 'MAX_DRAWDOWN' | 'POSITION_CLOSED' | 'MARGIN_TOP_UP' | 'UNKNOWN_POSITION';
    level: 'info' | 'warning' | 'danger' | 'critical';
    positionId?: string;
    symbol?: string;
    message: string;
    data: Record<string, unknown>;
    timestamp: number;
  }): void {
    this.io.to(`wallet:${walletId}`).emit('risk:alert', alert);
  }

  public emitPositionClosed(walletId: string, data: {
    positionId: string;
    symbol: string;
    side: string;
    exitReason: string;
    pnl: number;
    pnlPercent: number;
  }): void {
    this.io.to(`positions:${walletId}`).emit('position:closed', data);
  }

  public emitDailyLossLimitReached(walletId: string, data: {
    currentLoss: number;
    limit: number;
    percentUsed: number;
  }): void {
    this.io.to(`wallet:${walletId}`).emit('risk:daily-loss-limit', data);
  }

  public emitLiquidationWarning(walletId: string, data: {
    symbol: string;
    side: 'LONG' | 'SHORT';
    markPrice: number;
    liquidationPrice: number;
    distancePercent: number;
    riskLevel: 'warning' | 'danger' | 'critical';
  }): void {
    this.io.to(`wallet:${walletId}`).emit('risk:liquidation-warning', data);
  }

  public emitTradeNotification(walletId: string, notification: {
    type: 'POSITION_OPENED' | 'POSITION_CLOSED' | 'TRAILING_STOP_UPDATED' | 'LIMIT_FILLED';
    title: string;
    body: string;
    urgency: 'low' | 'normal' | 'critical';
    data: {
      executionId: string;
      symbol: string;
      side: 'LONG' | 'SHORT';
      entryPrice?: string;
      exitPrice?: string;
      pnl?: string;
      pnlPercent?: string;
      exitReason?: string;
      oldStopLoss?: string;
      newStopLoss?: string;
    };
  }): void {
    this.io.to(`positions:${walletId}`).emit('trade:notification', notification);
  }

  public emitNotification(walletId: string, notification: {
    type: 'info' | 'warning' | 'success' | 'error';
    title: string;
    message: string;
  }): void {
    this.io.to(`wallet:${walletId}`).emit('notification', notification);
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}

let websocketService: WebSocketService | null = null;

export const initializeWebSocket = (httpServer: HTTPServer): WebSocketService => {
  if (!websocketService) {
    websocketService = new WebSocketService(httpServer);
  }
  return websocketService;
};

export const getWebSocketService = (): WebSocketService | null => {
  return websocketService;
};
