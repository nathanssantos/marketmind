import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import { BACKEND_URL } from '@shared/constants/api';
import { useConnectionStore } from '../store/connectionStore';

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
      reconnectionAttempts: 50,
      transports: ['websocket'],
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      useConnectionStore.getState().setWsConnected(true);
    });

    this.socket.on('disconnect', () => {
      useConnectionStore.getState().setWsConnected(false);
    });

    this.socket.on('connect_error', () => {
      useConnectionStore.getState().setWsConnected(false);
    });

    this.socket.on('reconnect_failed', () => {
      console.warn('[SocketService] Reconnection failed after 50 attempts — backend may be offline');
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
      useConnectionStore.getState().setWsConnected(false);
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
