import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useWalletUpdates } from '../useWalletUpdates';

vi.mock('../useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    subscribe: {
      wallet: vi.fn(),
    },
    unsubscribe: {
      wallet: vi.fn(),
    },
  })),
}));

const mockTrpcUtils = {
  wallet: {
    list: {
      invalidate: vi.fn(),
    },
    getById: {
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

describe('useWalletUpdates', () => {
  it('should subscribe to wallet events when walletId is provided', async () => {
    const { useWebSocket } = await import('../useWebSocket');
    const mockSubscribe = vi.fn();
    const mockUnsubscribe = vi.fn();

    (useWebSocket as ReturnType<typeof vi.fn>).mockReturnValue({
      subscribe: { wallet: mockSubscribe },
      unsubscribe: { wallet: mockUnsubscribe },
    });

    const { result } = renderHook(() => useWalletUpdates('wallet-123'), {
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
      subscribe: { wallet: mockSubscribe },
      unsubscribe: { wallet: vi.fn() },
    });

    renderHook(() => useWalletUpdates(undefined), {
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
      subscribe: { wallet: vi.fn() },
      unsubscribe: { wallet: mockUnsubscribe },
    });

    const { unmount } = renderHook(() => useWalletUpdates('wallet-123'), {
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
      subscribe: { wallet: mockSubscribe },
      unsubscribe: { wallet: mockUnsubscribe },
    });

    const { rerender } = renderHook(({ walletId }) => useWalletUpdates(walletId), {
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

  it('should invalidate queries when wallet:update event received', async () => {
    const { useWebSocket } = await import('../useWebSocket');
    let walletUpdateCallback: ((wallet: unknown) => void) | undefined;

    (useWebSocket as ReturnType<typeof vi.fn>).mockReturnValue({
      subscribe: {
        wallet: vi.fn((_, cb) => {
          walletUpdateCallback = cb;
        }),
      },
      unsubscribe: { wallet: vi.fn() },
    });

    renderHook(() => useWalletUpdates('wallet-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(walletUpdateCallback).toBeDefined();
    });

    walletUpdateCallback?.({ id: 'wallet-123', balance: 10000 });

    await waitFor(() => {
      expect(mockTrpcUtils.wallet.list.invalidate).toHaveBeenCalled();
      expect(mockTrpcUtils.wallet.getById.invalidate).toHaveBeenCalledWith({
        id: 'wallet-123',
      });
    });
  });

  it('should handle empty walletId string', async () => {
    const { useWebSocket } = await import('../useWebSocket');
    const mockSubscribe = vi.fn();

    (useWebSocket as ReturnType<typeof vi.fn>).mockReturnValue({
      subscribe: { wallet: mockSubscribe },
      unsubscribe: { wallet: vi.fn() },
    });

    renderHook(() => useWalletUpdates(''), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockSubscribe).not.toHaveBeenCalled();
    });
  });
});
