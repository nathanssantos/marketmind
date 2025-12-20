import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';

const BACKEND_URL = 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;
  private connectionCount = 0;

  connect(): Socket {
    if (this.socket) {
      this.connectionCount++;
      return this.socket;
    }

    this.socket = io(BACKEND_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      transports: ['websocket'],
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      
    });

    this.socket.on('disconnect', () => {
      
    });

    this.socket.on('connect_error', () => {
      
    });

    this.connectionCount = 1;
    return this.socket;
  }

  disconnect(): void {
    this.connectionCount--;
    
    if (this.connectionCount <= 0) {
      this.socket?.disconnect();
      this.socket = null;
      this.connectionCount = 0;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
