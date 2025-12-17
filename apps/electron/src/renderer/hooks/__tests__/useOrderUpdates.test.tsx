import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useOrderUpdates } from '../useOrderUpdates';

vi.mock('../useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    subscribe: {
      orders: vi.fn(),
    },
    unsubscribe: {
      orders: vi.fn(),
    },
  })),
}));

const mockTrpcUtils = {
  autoTrading: {
    getActiveExecutions: {
      invalidate: vi.fn(),
    },
  },
  trading: {
    getOrders: {
      invalidate: vi.fn(),
    },
    getPositions: {
      invalidate: vi.fn(),
    },
  },
};

vi.mock('@renderer/services/trpc', () => ({
  trpcUtils: mockTrpcUtils,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useOrderUpdates', () => {
  it('should subscribe to order events when walletId is provided', async () => {
    const { useWebSocket } = await import('../useWebSocket');
    const mockSubscribe = vi.fn();
    const mockUnsubscribe = vi.fn();

    (useWebSocket as ReturnType<typeof vi.fn>).mockReturnValue({
      subscribe: { orders: mockSubscribe },
      unsubscribe: { orders: mockUnsubscribe },
    });

    const { result } = renderHook(() => useOrderUpdates('wallet-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalledWith('wallet-123', expect.any(Function));
    });
  });

  it('should not subscribe when walletId is not provided', async () => {
    const { useWebSocket } = await import('../useWebSocket');
    const mockSubscribe = vi.fn();

    (useWebSocket as ReturnType<typeof vi.fn>).mockReturnValue({
      subscribe: { orders: mockSubscribe },
      unsubscribe: { orders: vi.fn() },
    });

    renderHook(() => useOrderUpdates(undefined), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockSubscribe).not.toHaveBeenCalled();
    });
  });

  it('should unsubscribe on unmount', async () => {
    const { useWebSocket } = await import('../useWebSocket');
    const mockUnsubscribe = vi.fn();

    (useWebSocket as ReturnType<typeof vi.fn>).mockReturnValue({
      subscribe: { orders: vi.fn() },
      unsubscribe: { orders: mockUnsubscribe },
    });

    const { unmount } = renderHook(() => useOrderUpdates('wallet-123'), {
      wrapper: createWrapper(),
    });

    unmount();

    await waitFor(() => {
      expect(mockUnsubscribe).toHaveBeenCalledWith('wallet-123');
    });
  });

  it('should resubscribe when walletId changes', async () => {
    const { useWebSocket } = await import('../useWebSocket');
    const mockSubscribe = vi.fn();
    const mockUnsubscribe = vi.fn();

    (useWebSocket as ReturnType<typeof vi.fn>).mockReturnValue({
      subscribe: { orders: mockSubscribe },
      unsubscribe: { orders: mockUnsubscribe },
    });

    const { rerender } = renderHook(({ walletId }) => useOrderUpdates(walletId), {
      wrapper: createWrapper(),
      initialProps: { walletId: 'wallet-123' as string | undefined },
    });

    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalledWith('wallet-123', expect.any(Function));
    });

    rerender({ walletId: 'wallet-456' });

    await waitFor(() => {
      expect(mockUnsubscribe).toHaveBeenCalledWith('wallet-123');
      expect(mockSubscribe).toHaveBeenCalledWith('wallet-456', expect.any(Function));
    });
  });

  it('should invalidate queries when order:created event received', async () => {
    const { useWebSocket } = await import('../useWebSocket');
    let orderCreatedCallback: ((order: unknown) => void) | undefined;

    (useWebSocket as ReturnType<typeof vi.fn>).mockReturnValue({
      subscribe: {
        orders: vi.fn((_, cb) => {
          orderCreatedCallback = cb;
        }),
      },
      unsubscribe: { orders: vi.fn() },
    });

    renderHook(() => useOrderUpdates('wallet-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(orderCreatedCallback).toBeDefined();
    });

    orderCreatedCallback?.({ id: '1', symbol: 'BTCUSDT' });

    await waitFor(() => {
      expect(mockTrpcUtils.autoTrading.getActiveExecutions.invalidate).toHaveBeenCalled();
      expect(mockTrpcUtils.trading.getOrders.invalidate).toHaveBeenCalled();
      expect(mockTrpcUtils.trading.getPositions.invalidate).toHaveBeenCalled();
    });
  });
});
