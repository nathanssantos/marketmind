import type { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from './logger';

export interface SocketData {
  userId?: number;
  sessionToken?: string;
}

export class WebSocketService {
  private io: SocketIOServer;

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
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
      logger.info({ socketId: socket.id }, 'Client connected');

      socket.on('subscribe:orders', (walletId: string) => {
        socket.join(`orders:${walletId}`);
        logger.info({ socketId: socket.id, walletId }, 'Subscribed to orders');
      });

      socket.on('subscribe:positions', (walletId: string) => {
        socket.join(`positions:${walletId}`);
        logger.info({ socketId: socket.id, walletId }, 'Subscribed to positions');
      });

      socket.on('subscribe:prices', (symbol: string) => {
        socket.join(`prices:${symbol}`);
        logger.info({ socketId: socket.id, symbol }, 'Subscribed to prices');
      });

      socket.on('unsubscribe:orders', (walletId: string) => {
        socket.leave(`orders:${walletId}`);
        logger.info({ socketId: socket.id, walletId }, 'Unsubscribed from orders');
      });

      socket.on('unsubscribe:positions', (walletId: string) => {
        socket.leave(`positions:${walletId}`);
        logger.info({ socketId: socket.id, walletId }, 'Unsubscribed from positions');
      });

      socket.on('unsubscribe:prices', (symbol: string) => {
        socket.leave(`prices:${symbol}`);
        logger.info({ socketId: socket.id, symbol }, 'Unsubscribed from prices');
      });

      socket.on('subscribe:setups', (userId: string) => {
        socket.join(`user:${userId}`);
        logger.info({ socketId: socket.id, userId }, 'Subscribed to setups');
      });

      socket.on('unsubscribe:setups', (userId: string) => {
        socket.leave(`user:${userId}`);
        logger.info({ socketId: socket.id, userId }, 'Unsubscribed from setups');
      });

      socket.on('disconnect', () => {
        logger.info({ socketId: socket.id }, 'Client disconnected');
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

  public emitPriceUpdate(symbol: string, price: number, timestamp: number): void {
    this.io.to(`prices:${symbol}`).emit('price:update', { symbol, price, timestamp });
  }

  public emitSetupDetected(userId: string, data: unknown): void {
    this.io.to(`user:${userId}`).emit('setup-detected', data);
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
