import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOrderUpdates } from '../useOrderUpdates';

const mockSubscribeOrders = vi.fn();
const mockUnsubscribeOrders = vi.fn();
const mockOn = vi.fn();
const mockOff = vi.fn();

let mockIsConnected = true;

vi.mock('../useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    isConnected: mockIsConnected,
    subscribe: {
      orders: mockSubscribeOrders,
    },
    unsubscribe: {
      orders: mockUnsubscribeOrders,
    },
    on: mockOn,
    off: mockOff,
  })),
}));

const mockInvalidateExecutions = vi.fn();
const mockInvalidateOrders = vi.fn();
const mockInvalidatePositions = vi.fn();

vi.mock('../../utils/trpc', () => ({
  trpc: {
    useUtils: () => ({
      autoTrading: {
        getActiveExecutions: {
          invalidate: mockInvalidateExecutions,
        },
      },
      trading: {
        getOrders: {
          invalidate: mockInvalidateOrders,
        },
        getPositions: {
          invalidate: mockInvalidatePositions,
        },
      },
    }),
  },
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
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsConnected = true;
  });

  it('should subscribe to order events when walletId is provided', async () => {
    renderHook(() => useOrderUpdates('wallet-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockSubscribeOrders).toHaveBeenCalledWith('wallet-123');
    });
  });

  it('should not subscribe when walletId is not provided', async () => {
    renderHook(() => useOrderUpdates(''), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockSubscribeOrders).not.toHaveBeenCalled();
    });
  });

  it('should unsubscribe on unmount', async () => {
    const { unmount } = renderHook(() => useOrderUpdates('wallet-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockSubscribeOrders).toHaveBeenCalled();
    });

    unmount();

    expect(mockUnsubscribeOrders).toHaveBeenCalledWith('wallet-123');
    expect(mockOff).toHaveBeenCalledWith('order:created', expect.any(Function));
    expect(mockOff).toHaveBeenCalledWith('order:update', expect.any(Function));
    expect(mockOff).toHaveBeenCalledWith('order:cancelled', expect.any(Function));
  });

  it('should resubscribe when walletId changes', async () => {
    const { rerender } = renderHook(
      ({ walletId }) => useOrderUpdates(walletId),
      {
        wrapper: createWrapper(),
        initialProps: { walletId: 'wallet-123' },
      }
    );

    await waitFor(() => {
      expect(mockSubscribeOrders).toHaveBeenCalledWith('wallet-123');
    });

    rerender({ walletId: 'wallet-456' });

    await waitFor(() => {
      expect(mockUnsubscribeOrders).toHaveBeenCalledWith('wallet-123');
      expect(mockSubscribeOrders).toHaveBeenCalledWith('wallet-456');
    });
  });

  it('should invalidate queries when order:created event received', async () => {
    let capturedCallback: ((order: unknown) => void) | undefined;

    mockOn.mockImplementation((event: string, cb: (order: unknown) => void) => {
      if (event === 'order:created') {
        capturedCallback = cb;
      }
    });

    renderHook(() => useOrderUpdates('wallet-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockOn).toHaveBeenCalledWith('order:created', expect.any(Function));
    });

    expect(capturedCallback).toBeDefined();

    act(() => {
      capturedCallback?.({ id: '1', symbol: 'BTCUSDT' });
    });

    await waitFor(() => {
      expect(mockInvalidateExecutions).toHaveBeenCalled();
      expect(mockInvalidateOrders).toHaveBeenCalled();
      expect(mockInvalidatePositions).toHaveBeenCalled();
    });
  });

  it('should return isConnected status', async () => {
    const { result } = renderHook(() => useOrderUpdates('wallet-123'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('should not subscribe when disabled', async () => {
    renderHook(() => useOrderUpdates('wallet-123', false), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockSubscribeOrders).not.toHaveBeenCalled();
    });
  });
});
