import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connected: false,
};

vi.mock('../services/socketService', () => ({
  socketService: {
    connect: vi.fn(() => mockSocket),
    disconnect: vi.fn(),
    getSocket: vi.fn(() => mockSocket),
  },
}));

import { socketService } from '../services/socketService';
import { useWebSocket } from './useWebSocket';

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
  });

  describe('initialization', () => {
    it('should auto connect when autoConnect is true (default)', () => {
      renderHook(() => useWebSocket());

      expect(socketService.connect).toHaveBeenCalled();
    });

    it('should not auto connect when autoConnect is false', () => {
      renderHook(() => useWebSocket({ autoConnect: false }));

      expect(socketService.connect).not.toHaveBeenCalled();
    });

    it('should register event handlers on mount', () => {
      renderHook(() => useWebSocket());

      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
    });
  });

  describe('connection state', () => {
    it('should return isConnected false initially', () => {
      const { result } = renderHook(() => useWebSocket());

      expect(result.current.isConnected).toBe(false);
    });

    it('should return isConnected true when socket is already connected', () => {
      mockSocket.connected = true;
      const { result } = renderHook(() => useWebSocket());

      expect(result.current.isConnected).toBe(true);
    });

    it('should return error as null initially', () => {
      const { result } = renderHook(() => useWebSocket());

      expect(result.current.error).toBeNull();
    });
  });

  describe('event handlers', () => {
    it('should set isConnected true on connect event', () => {
      const { result } = renderHook(() => useWebSocket());

      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1];

      act(() => {
        connectHandler?.();
      });

      expect(result.current.isConnected).toBe(true);
    });

    it('should set isConnected false on disconnect event', () => {
      mockSocket.connected = true;
      const { result } = renderHook(() => useWebSocket());

      const disconnectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'disconnect'
      )?.[1];

      act(() => {
        disconnectHandler?.();
      });

      expect(result.current.isConnected).toBe(false);
    });

    it('should set error on connect_error event', () => {
      const { result } = renderHook(() => useWebSocket());
      const testError = new Error('Connection failed');

      const errorHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect_error'
      )?.[1];

      act(() => {
        errorHandler?.(testError);
      });

      expect(result.current.error).toBe(testError);
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should remove event handlers on unmount', () => {
      const { unmount } = renderHook(() => useWebSocket());

      unmount();

      expect(mockSocket.off).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith('connect_error', expect.any(Function));
    });

    it('should disconnect on unmount', () => {
      const { unmount } = renderHook(() => useWebSocket());

      unmount();

      expect(socketService.disconnect).toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('should emit subscribe:orders with walletId', () => {
      const { result } = renderHook(() => useWebSocket());

      result.current.subscribe.orders('wallet-123');

      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:orders', 'wallet-123');
    });

    it('should emit subscribe:positions with walletId', () => {
      const { result } = renderHook(() => useWebSocket());

      result.current.subscribe.positions('wallet-456');

      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:positions', 'wallet-456');
    });

    it('should emit subscribe:wallet with walletId', () => {
      const { result } = renderHook(() => useWebSocket());

      result.current.subscribe.wallet('wallet-789');

      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:wallet', 'wallet-789');
    });

    it('should emit subscribe:prices with symbol', () => {
      const { result } = renderHook(() => useWebSocket());

      result.current.subscribe.prices('BTCUSDT');

      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:prices', 'BTCUSDT');
    });

    it('should emit subscribe:klines with symbol and interval', () => {
      const { result } = renderHook(() => useWebSocket());

      result.current.subscribe.klines({ symbol: 'ETHUSDT', interval: '1h' });

      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:klines', {
        symbol: 'ETHUSDT',
        interval: '1h',
      });
    });

    it('should emit subscribe:setups with userId', () => {
      const { result } = renderHook(() => useWebSocket());

      result.current.subscribe.setups('user-123');

      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:setups', 'user-123');
    });
  });

  describe('unsubscribe', () => {
    it('should emit unsubscribe:orders with walletId', () => {
      const { result } = renderHook(() => useWebSocket());

      result.current.unsubscribe.orders('wallet-123');

      expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe:orders', 'wallet-123');
    });

    it('should emit unsubscribe:positions with walletId', () => {
      const { result } = renderHook(() => useWebSocket());

      result.current.unsubscribe.positions('wallet-456');

      expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe:positions', 'wallet-456');
    });

    it('should emit unsubscribe:wallet with walletId', () => {
      const { result } = renderHook(() => useWebSocket());

      result.current.unsubscribe.wallet('wallet-789');

      expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe:wallet', 'wallet-789');
    });

    it('should emit unsubscribe:prices with symbol', () => {
      const { result } = renderHook(() => useWebSocket());

      result.current.unsubscribe.prices('BTCUSDT');

      expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe:prices', 'BTCUSDT');
    });

    it('should emit unsubscribe:klines with symbol and interval', () => {
      const { result } = renderHook(() => useWebSocket());

      result.current.unsubscribe.klines({ symbol: 'ETHUSDT', interval: '1h' });

      expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe:klines', {
        symbol: 'ETHUSDT',
        interval: '1h',
      });
    });

    it('should emit unsubscribe:setups with userId', () => {
      const { result } = renderHook(() => useWebSocket());

      result.current.unsubscribe.setups('user-123');

      expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe:setups', 'user-123');
    });
  });

  describe('on/off event handlers', () => {
    it('should register event handler with on', () => {
      const { result } = renderHook(() => useWebSocket());
      const handler = vi.fn();

      result.current.on('order:update', handler);

      expect(mockSocket.on).toHaveBeenCalledWith('order:update', handler);
    });

    it('should unregister event handler with off', () => {
      const { result } = renderHook(() => useWebSocket());
      const handler = vi.fn();

      result.current.off('order:update', handler);

      expect(mockSocket.off).toHaveBeenCalledWith('order:update', handler);
    });

    it('should handle price:update event', () => {
      const { result } = renderHook(() => useWebSocket());
      const handler = vi.fn();

      result.current.on('price:update', handler);

      expect(mockSocket.on).toHaveBeenCalledWith('price:update', handler);
    });

    it('should handle kline:update event', () => {
      const { result } = renderHook(() => useWebSocket());
      const handler = vi.fn();

      result.current.on('kline:update', handler);

      expect(mockSocket.on).toHaveBeenCalledWith('kline:update', handler);
    });

    it('should handle setup-detected event', () => {
      const { result } = renderHook(() => useWebSocket());
      const handler = vi.fn();

      result.current.on('setup-detected', handler);

      expect(mockSocket.on).toHaveBeenCalledWith('setup-detected', handler);
    });
  });

  describe('socket reference', () => {
    it('should return socket in the result', () => {
      const { result } = renderHook(() => useWebSocket());

      expect(result.current.socket).toBeDefined();
    });
  });

  describe('with null socket', () => {
    it('should handle subscribe when socket is null', () => {
      vi.mocked(socketService.getSocket).mockReturnValue(null);
      const { result } = renderHook(() => useWebSocket());

      expect(() => result.current.subscribe.orders('wallet-123')).not.toThrow();
    });

    it('should handle unsubscribe when socket is null', () => {
      vi.mocked(socketService.getSocket).mockReturnValue(null);
      const { result } = renderHook(() => useWebSocket());

      expect(() => result.current.unsubscribe.orders('wallet-123')).not.toThrow();
    });

    it('should handle on when socket is null', () => {
      vi.mocked(socketService.getSocket).mockReturnValue(null);
      const { result } = renderHook(() => useWebSocket());

      expect(() => result.current.on('order:update', vi.fn())).not.toThrow();
    });

    it('should handle off when socket is null', () => {
      vi.mocked(socketService.getSocket).mockReturnValue(null);
      const { result } = renderHook(() => useWebSocket());

      expect(() => result.current.off('order:update', vi.fn())).not.toThrow();
    });
  });
});
