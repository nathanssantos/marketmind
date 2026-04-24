import { beforeEach, describe, expect, it, vi } from 'vitest';

const { MockWebsocketClient, getMockWsClients } = vi.hoisted(() => {
  const clients: MockClient[] = [];

  interface MockClient {
    on: ReturnType<typeof vi.fn>;
    subscribeUsdFuturesUserDataStream: ReturnType<typeof vi.fn>;
    closeAll: ReturnType<typeof vi.fn>;
    handlers: Record<string, ((data: unknown) => void)[]>;
    emit: (event: string, data: unknown) => void;
  }

  class MockWebsocketClient {
    handlers: Record<string, ((data: unknown) => void)[]> = {};
    on: ReturnType<typeof vi.fn>;
    subscribeUsdFuturesUserDataStream: ReturnType<typeof vi.fn>;
    closeAll: ReturnType<typeof vi.fn>;

    emit(event: string, data: unknown): void {
      (this.handlers[event] ?? []).forEach((h) => h(data));
    }

    constructor() {
      this.on = vi.fn((event: string, handler: (data: unknown) => void) => {
        (this.handlers[event] ??= []).push(handler);
      });
      this.subscribeUsdFuturesUserDataStream = vi.fn().mockResolvedValue(undefined);
      this.closeAll = vi.fn();
      clients.push(this as unknown as MockClient);
    }
  }

  return {
    MockWebsocketClient,
    getMockWsClients: (): MockClient[] => clients,
  };
});

vi.mock('binance', () => ({
  WebsocketClient: MockWebsocketClient,
}));

const mockGetCurrentPositionMode = vi.fn().mockResolvedValue({ dualSidePosition: false });
vi.mock('../../services/binance-futures-client', () => ({
  createBinanceFuturesClient: vi.fn(() => ({ getCurrentPositionMode: mockGetCurrentPositionMode })),
  isPaperWallet: vi.fn(() => false),
  getWalletType: vi.fn(() => 'live'),
  getPosition: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/encryption', () => ({
  decryptApiKey: vi.fn((s: string) => s),
}));

vi.mock('../../services/binance-client', () => ({
  silentWsLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() },
  serializeError: vi.fn((e: unknown) => String(e)),
}));

const mockSyncWallet = vi.fn().mockResolvedValue({ changes: { orphanedPositions: [], unknownPositions: [], updatedPositions: [], balanceUpdated: false } });
vi.mock('../../services/position-sync', () => ({
  positionSyncService: { syncWallet: (...args: unknown[]) => mockSyncWallet(...args) },
}));

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => Promise.resolve([])) })),
  },
}));

vi.mock('../../db/schema', () => ({
  wallets: {},
  tradeExecutions: {},
}));

const FAKE_WALLET = {
  id: 'wallet-1',
  userId: 'user-1',
  isActive: true,
  apiKeyEncrypted: 'encrypted-key',
  apiSecretEncrypted: 'encrypted-secret',
  marketType: 'FUTURES' as const,
  exchange: 'binance' as const,
  name: 'test',
  createdAt: new Date(),
  updatedAt: new Date(),
  walletType: 'live',
};

import { BinanceFuturesUserStreamService } from '../../services/binance-futures-user-stream';

describe('BinanceFuturesUserStreamService — watchdog', () => {
  let service: BinanceFuturesUserStreamService;

  beforeEach(() => {
    vi.clearAllMocks();
    getMockWsClients().length = 0;
    service = new BinanceFuturesUserStreamService();
  });

  it('marks wallet degraded + forces reconnect + triggers REST sync after STALE_THRESHOLD_MS of silence', async () => {
    vi.useFakeTimers();

    // Stub getCachedWallet to always return the fake wallet
    vi.spyOn(service, 'getCachedWallet').mockResolvedValue(FAKE_WALLET as never);

    await service.start();
    await service.subscribeWallet(FAKE_WALLET as never);

    expect(service.isWalletSubscribed('wallet-1')).toBe(true);
    const initialClient = getMockWsClients()[0];
    expect(initialClient).toBeDefined();

    // Advance past 60s + watchdog tick (15s)
    await vi.advanceTimersByTimeAsync(61_000);
    await vi.advanceTimersByTimeAsync(15_500);

    // Allow microtasks from the forceReconnectWallet chain to settle
    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve();
    await Promise.resolve();

    // Closed the old connection
    expect(initialClient!.closeAll).toHaveBeenCalledWith(true);
    // Triggered the REST sync
    expect(mockSyncWallet).toHaveBeenCalledWith(FAKE_WALLET);

    vi.useRealTimers();
  });

  it('recovers status on next incoming frame', async () => {
    vi.useFakeTimers();
    vi.spyOn(service, 'getCachedWallet').mockResolvedValue(FAKE_WALLET as never);

    await service.start();
    await service.subscribeWallet(FAKE_WALLET as never);

    // Manually flip health to degraded (bypass the full reconnect cycle for focus)
    const health = (service as unknown as { walletHealth: Map<string, { healthStatus: string; lastMessageAt: number; lastReconnectAt: number }> }).walletHealth;
    const state = health.get('wallet-1')!;
    state.healthStatus = 'degraded';
    state.lastMessageAt = Date.now() - 120_000;

    // Fire a user-data frame — handler records activity
    const clients = getMockWsClients();
    clients[0]!.emit('message', { e: 'ACCOUNT_UPDATE', a: { m: 'ORDER', B: [], P: [] } });

    const afterState = health.get('wallet-1')!;
    expect(afterState.healthStatus).toBe('healthy');

    vi.useRealTimers();
  });

  it('stops the watchdog on service.stop()', async () => {
    vi.useFakeTimers();
    vi.spyOn(service, 'getCachedWallet').mockResolvedValue(FAKE_WALLET as never);

    await service.start();
    await service.subscribeWallet(FAKE_WALLET as never);

    service.stop();

    await vi.advanceTimersByTimeAsync(120_000);
    await vi.runOnlyPendingTimersAsync();

    expect(mockSyncWallet).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
