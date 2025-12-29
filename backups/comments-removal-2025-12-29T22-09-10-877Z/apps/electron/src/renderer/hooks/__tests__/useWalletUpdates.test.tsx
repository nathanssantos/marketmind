import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWalletUpdates } from '../useWalletUpdates';

const mockSubscribeWallet = vi.fn();
const mockUnsubscribeWallet = vi.fn();
const mockOn = vi.fn();
const mockOff = vi.fn();

let mockIsConnected = true;

vi.mock('../useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    isConnected: mockIsConnected,
    subscribe: {
      wallet: mockSubscribeWallet,
    },
    unsubscribe: {
      wallet: mockUnsubscribeWallet,
    },
    on: mockOn,
    off: mockOff,
  })),
}));

const mockInvalidateList = vi.fn();
const mockInvalidateGetById = vi.fn();

vi.mock('../../utils/trpc', () => ({
  trpc: {
    useUtils: () => ({
      wallet: {
        list: {
          invalidate: mockInvalidateList,
        },
        getById: {
          invalidate: mockInvalidateGetById,
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

describe('useWalletUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsConnected = true;
  });

  it('should subscribe to wallet events when walletId is provided', async () => {
    renderHook(() => useWalletUpdates('wallet-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockSubscribeWallet).toHaveBeenCalledWith('wallet-123');
    });
  });

  it('should not subscribe when walletId is not provided', async () => {
    renderHook(() => useWalletUpdates(''), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockSubscribeWallet).not.toHaveBeenCalled();
    });
  });

  it('should unsubscribe on unmount', async () => {
    const { unmount } = renderHook(() => useWalletUpdates('wallet-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockSubscribeWallet).toHaveBeenCalled();
    });

    unmount();

    expect(mockUnsubscribeWallet).toHaveBeenCalledWith('wallet-123');
    expect(mockOff).toHaveBeenCalledWith('wallet:update', expect.any(Function));
  });

  it('should resubscribe when walletId changes', async () => {
    const { rerender } = renderHook(
      ({ walletId }) => useWalletUpdates(walletId),
      {
        wrapper: createWrapper(),
        initialProps: { walletId: 'wallet-123' },
      }
    );

    await waitFor(() => {
      expect(mockSubscribeWallet).toHaveBeenCalledWith('wallet-123');
    });

    rerender({ walletId: 'wallet-456' });

    await waitFor(() => {
      expect(mockUnsubscribeWallet).toHaveBeenCalledWith('wallet-123');
      expect(mockSubscribeWallet).toHaveBeenCalledWith('wallet-456');
    });
  });

  it('should invalidate queries when wallet:update event received', async () => {
    let capturedCallback: ((wallet: unknown) => void) | undefined;

    mockOn.mockImplementation((event: string, cb: (wallet: unknown) => void) => {
      if (event === 'wallet:update') {
        capturedCallback = cb;
      }
    });

    renderHook(() => useWalletUpdates('wallet-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockOn).toHaveBeenCalledWith('wallet:update', expect.any(Function));
    });

    expect(capturedCallback).toBeDefined();

    act(() => {
      capturedCallback?.({ id: 'wallet-123', balance: 10000 });
    });

    await waitFor(() => {
      expect(mockInvalidateList).toHaveBeenCalled();
      expect(mockInvalidateGetById).toHaveBeenCalled();
    });
  });

  it('should handle empty walletId string', async () => {
    renderHook(() => useWalletUpdates(''), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockSubscribeWallet).not.toHaveBeenCalled();
    });
  });

  it('should return isConnected status', async () => {
    const { result } = renderHook(() => useWalletUpdates('wallet-123'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('should not subscribe when disabled', async () => {
    renderHook(() => useWalletUpdates('wallet-123', false), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockSubscribeWallet).not.toHaveBeenCalled();
    });
  });
});
