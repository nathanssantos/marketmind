import type { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

export interface SocketData {
  userId?: number;
  sessionToken?: string;
}

export class WebSocketService {
  private io: SocketIOServer;

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    this.io.use((socket, next) => {
      const sessionToken = socket.handshake.auth.token;
      
      if (sessionToken) {
        (socket.data as SocketData).sessionToken = sessionToken;
      }
      
      next();
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('subscribe:orders', (walletId: string) => {
        socket.join(`orders:${walletId}`);
        console.log(`Client ${socket.id} subscribed to orders:${walletId}`);
      });

      socket.on('subscribe:positions', (walletId: string) => {
        socket.join(`positions:${walletId}`);
        console.log(`Client ${socket.id} subscribed to positions:${walletId}`);
      });

      socket.on('subscribe:prices', (symbol: string) => {
        socket.join(`prices:${symbol}`);
        console.log(`Client ${socket.id} subscribed to prices:${symbol}`);
      });

      socket.on('unsubscribe:orders', (walletId: string) => {
        socket.leave(`orders:${walletId}`);
        console.log(`Client ${socket.id} unsubscribed from orders:${walletId}`);
      });

      socket.on('unsubscribe:positions', (walletId: string) => {
        socket.leave(`positions:${walletId}`);
        console.log(`Client ${socket.id} unsubscribed from positions:${walletId}`);
      });

      socket.on('unsubscribe:prices', (symbol: string) => {
        socket.leave(`prices:${symbol}`);
        console.log(`Client ${socket.id} unsubscribed from prices:${symbol}`);
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
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
