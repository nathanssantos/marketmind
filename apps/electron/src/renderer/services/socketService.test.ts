import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSocket = {
  connected: false,
  on: vi.fn(),
  disconnect: vi.fn(),
  emit: vi.fn(),
  off: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

import { io } from 'socket.io-client';
import { socketService } from './socketService';

describe('socketService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
    (socketService as unknown as { socket: null; connectionCount: number }).socket = null;
    (socketService as unknown as { socket: null; connectionCount: number }).connectionCount = 0;
  });

  describe('connect', () => {
    it('should create socket on first connect', () => {
      const socket = socketService.connect();

      expect(io).toHaveBeenCalledWith(expect.any(String), {
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
        transports: ['websocket'],
        timeout: 10000,
      });
      expect(socket).toBe(mockSocket);
    });

    it('should register event handlers on connect', () => {
      socketService.connect();

      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
    });

    it('should reuse existing socket on subsequent connects', () => {
      const socket1 = socketService.connect();
      const socket2 = socketService.connect();

      expect(io).toHaveBeenCalledTimes(1);
      expect(socket1).toBe(socket2);
    });

    it('should increment connection count on each connect', () => {
      socketService.connect();
      socketService.connect();
      socketService.connect();

      expect(io).toHaveBeenCalledTimes(1);
    });
  });

  describe('disconnect', () => {
    it('should decrement connection count', () => {
      socketService.connect();
      socketService.connect();
      socketService.disconnect();

      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });

    it('should disconnect socket when count reaches zero', () => {
      socketService.connect();
      socketService.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should not go below zero connection count', () => {
      socketService.disconnect();
      socketService.disconnect();
      socketService.disconnect();

      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });

    it('should set socket to null after disconnecting', () => {
      socketService.connect();
      socketService.disconnect();

      expect(socketService.getSocket()).toBeNull();
    });
  });

  describe('getSocket', () => {
    it('should return null when not connected', () => {
      expect(socketService.getSocket()).toBeNull();
    });

    it('should return socket when connected', () => {
      socketService.connect();

      expect(socketService.getSocket()).toBe(mockSocket);
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      expect(socketService.isConnected()).toBe(false);
    });

    it('should return false when socket exists but not connected', () => {
      socketService.connect();
      mockSocket.connected = false;

      expect(socketService.isConnected()).toBe(false);
    });

    it('should return true when socket is connected', () => {
      socketService.connect();
      mockSocket.connected = true;

      expect(socketService.isConnected()).toBe(true);
    });
  });

  describe('event handlers', () => {
    it('should handle connect event without error', () => {
      socketService.connect();
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1];

      expect(() => connectHandler?.()).not.toThrow();
    });

    it('should handle disconnect event without error', () => {
      socketService.connect();
      const disconnectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'disconnect'
      )?.[1];

      expect(() => disconnectHandler?.()).not.toThrow();
    });

    it('should handle connect_error event without error', () => {
      socketService.connect();
      const errorHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect_error'
      )?.[1];

      expect(() => errorHandler?.(new Error('Test error'))).not.toThrow();
    });
  });
});
