import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PositionSyncService } from '../position-sync';

const mockDbSelect = vi.fn(() => ({
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue([]),
}));

const mockDbUpdate = vi.fn(() => ({
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue([]),
}));

const mockDbInsert = vi.fn(() => ({
  values: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db', () => ({
  db: {
    select: () => mockDbSelect(),
    update: () => mockDbUpdate(),
    insert: () => mockDbInsert(),
  },
}));

const mockGetPositions = vi.fn().mockResolvedValue([]);
const mockCreateBinanceFuturesClient = vi.fn().mockReturnValue({});
const mockIsPaperWallet = vi.fn((wallet) => wallet.walletType === 'paper');

const mockClosePosition = vi.fn().mockResolvedValue({});
const mockGetAllTradeFeesForPosition = vi.fn().mockResolvedValue(null);

vi.mock('../binance-futures-client', () => ({
  createBinanceFuturesClient: (wallet: unknown) => mockCreateBinanceFuturesClient(wallet),
  isPaperWallet: (wallet: { walletType: string }) => mockIsPaperWallet(wallet),
  getPositions: (client: unknown) => mockGetPositions(client),
  closePosition: (...args: unknown[]) => mockClosePosition(...args),
  getAllTradeFeesForPosition: (...args: unknown[]) => mockGetAllTradeFeesForPosition(...args),
}));

const mockGetMarkPrice = vi.fn().mockResolvedValue({ markPrice: 50000 });

vi.mock('../binance-futures-data', () => ({
  getBinanceFuturesDataService: vi.fn(() => ({
    getMarkPrice: (symbol: string) => mockGetMarkPrice(symbol),
  })),
}));

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    trace: vi.fn(),
  },
  serializeError: vi.fn((err) => err instanceof Error ? err.message : String(err)),
}));

const mockOutputPositionSyncResults = vi.fn();

vi.mock('../watcher-batch-logger', () => ({
  outputPositionSyncResults: (result: unknown) => mockOutputPositionSyncResults(result),
}));

const mockEmitPositionUpdate = vi.fn();
const mockEmitRiskAlert = vi.fn();
let mockWebSocketService: { emitPositionUpdate: typeof mockEmitPositionUpdate; emitRiskAlert: typeof mockEmitRiskAlert } | null = null;

vi.mock('../websocket', () => ({
  getWebSocketService: () => mockWebSocketService,
}));

vi.mock('../protection-orders', () => ({
  cancelAllProtectionOrders: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../auto-trading', () => ({
  autoTradingService: {
    createStopLossOrder: vi.fn().mockResolvedValue({ orderId: 999, isAlgoOrder: false }),
    createTakeProfitOrder: vi.fn().mockResolvedValue({ orderId: 1000, isAlgoOrder: false }),
  },
}));

vi.mock('@marketmind/types', async (importOriginal) => {
  const original = await importOriginal<typeof import('@marketmind/types')>();
  return {
    ...original,
    calculateTotalFees: vi.fn(() => ({ entryFee: 0, exitFee: 0, totalFees: 0 })),
  };
});

describe('PositionSyncService', () => {
  let service: PositionSyncService;

  beforeEach(() => {
    service = new PositionSyncService();
    vi.clearAllMocks();
    mockWebSocketService = null;
    mockGetPositions.mockResolvedValue([]);
    mockCreateBinanceFuturesClient.mockReturnValue({});
    mockGetMarkPrice.mockResolvedValue({ markPrice: 50000 });
  });

  describe('start', () => {
    it('should start the sync service', async () => {
      vi.useFakeTimers();

      await service.start();

      expect(service['isRunning']).toBe(true);
      expect(service['syncInterval']).not.toBeNull();

      service.stop();
      vi.useRealTimers();
    });

    it('should not start if already running', async () => {
      vi.useFakeTimers();

      await service.start();
      const firstInterval = service['syncInterval'];

      await service.start();

      expect(service['syncInterval']).toBe(firstInterval);

      service.stop();
      vi.useRealTimers();
    });
  });

  describe('stop', () => {
    it('should stop the sync service', async () => {
      vi.useFakeTimers();

      await service.start();
      expect(service['isRunning']).toBe(true);

      service.stop();

      expect(service['isRunning']).toBe(false);
      expect(service['syncInterval']).toBeNull();

      vi.useRealTimers();
    });

    it('should handle stop when not running', () => {
      service.stop();

      expect(service['isRunning']).toBe(false);
      expect(service['syncInterval']).toBeNull();
    });
  });

  describe('syncAllWallets', () => {
    it('should return empty array when no wallets', async () => {
      const results = await service.syncAllWallets();

      expect(Array.isArray(results)).toBe(true);
    });

    it('should filter out paper wallets', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockResolvedValue([
          { id: 'wallet-1', walletType: 'paper', apiKeyEncrypted: 'key', apiSecretEncrypted: 'secret', marketType: 'FUTURES' },
          { id: 'wallet-2', walletType: 'paper', apiKeyEncrypted: 'key', apiSecretEncrypted: 'secret', marketType: 'FUTURES' },
        ]),
      } as never);

      const results = await service.syncAllWallets();

      expect(results).toHaveLength(0);
    });

    it('should filter out SPOT market wallets', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockResolvedValue([
          { id: 'wallet-1', walletType: 'live', apiKeyEncrypted: 'key', apiSecretEncrypted: 'secret', marketType: 'SPOT' },
        ]),
      } as never);

      const results = await service.syncAllWallets();

      expect(results).toHaveLength(0);
    });
  });

  describe('syncWallet', () => {
    const mockWallet = {
      id: 'wallet-1',
      userId: 'user-1',
      name: 'Test Wallet',
      walletType: 'live',
      marketType: 'FUTURES',
      apiKeyEncrypted: 'encrypted-key',
      apiSecretEncrypted: 'encrypted-secret',
      initialBalance: '10000',
      currentBalance: '10000',
      currency: 'USDT',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return sync result with no changes when positions match', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      } as never);

      const result = await service.syncWallet(mockWallet as never);

      expect(result.walletId).toBe('wallet-1');
      expect(result.synced).toBe(true);
      expect(result.changes.orphanedPositions).toEqual([]);
      expect(result.changes.unknownPositions).toEqual([]);
      expect(result.changes.updatedPositions).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('should handle errors during sync', async () => {
      mockCreateBinanceFuturesClient.mockImplementation(() => {
        throw new Error('API Error');
      });

      const result = await service.syncWallet(mockWallet as never);

      expect(result.synced).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should identify orphaned positions', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: 'exec-1',
            symbol: 'BTCUSDT',
            side: 'LONG',
            entryPrice: '50000',
            quantity: '0.1',
            leverage: 10,
          },
        ]),
      } as never);

      mockGetPositions.mockResolvedValue([]);

      const result = await service.syncWallet(mockWallet as never);

      expect(result.changes.orphanedPositions).toContain('exec-1');
    });

    it('should identify unknown positions on exchange', async () => {
      // Two .select() chains run in unknown-position path:
      //   1) initial dbOpenPositions read (.from().where()) → []
      //   2) race-guard re-check (.from().where().limit(1)) → []
      // Both use the same mock so we make .where return a thenable
      // that ALSO carries .limit(1) → [] (no concurrent exec).
      const chainable = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
        then: (fn: (v: unknown) => void) => Promise.resolve([]).then(fn),
        catch: (fn: (v: unknown) => void) => Promise.resolve([]).catch(fn),
        finally: (fn: () => void) => Promise.resolve([]).finally(fn),
      };
      mockDbSelect.mockReturnValue(chainable as never);

      mockGetPositions.mockResolvedValue([
        {
          symbol: 'ETHUSDT',
          positionAmt: '0.5',
          entryPrice: '3000',
          unrealizedPnl: '50',
          leverage: 5,
          marginType: 'ISOLATED',
        } as never,
      ]);

      const result = await service.syncWallet(mockWallet as never);

      expect(result.changes.unknownPositions).toContain('ETHUSDT');
      expect(result.detailedUnknown).toHaveLength(1);
    });

    it('skips inserting unknown position when same-side exec already exists (race guard)', async () => {
      // Simulates the race: dbOpenPositions read returned []
      // (handleManualOrderFill hadn't committed yet), Binance shows
      // the position, but by the time we re-check before insert,
      // user-stream has committed the exec. position-sync should bail
      // instead of double-inserting.
      let selectCallCount = 0;
      const initialReadEmpty = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
        then: (fn: (v: unknown) => void) => Promise.resolve([]).then(fn),
        catch: (fn: (v: unknown) => void) => Promise.resolve([]).catch(fn),
        finally: (fn: () => void) => Promise.resolve([]).finally(fn),
      };
      const reCheckHasMatch = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 'concurrent-exec-1' }]),
        then: (fn: (v: unknown) => void) => Promise.resolve([]).then(fn),
        catch: (fn: (v: unknown) => void) => Promise.resolve([]).catch(fn),
        finally: (fn: () => void) => Promise.resolve([]).finally(fn),
      };

      mockDbSelect.mockImplementation(() => {
        selectCallCount += 1;
        // 1st = dbOpenPositions read, 2nd = race-guard re-check
        return (selectCallCount === 1 ? initialReadEmpty : reCheckHasMatch) as never;
      });

      mockGetPositions.mockResolvedValue([
        {
          symbol: 'ETHUSDT',
          positionAmt: '0.5',
          entryPrice: '3000',
          unrealizedPnl: '50',
          leverage: 5,
          marginType: 'ISOLATED',
        } as never,
      ]);

      const result = await service.syncWallet(mockWallet as never);

      // Unknown was reported (Binance had it), but no insert fired.
      expect(result.changes.unknownPositions).toContain('ETHUSDT');
      expect(mockDbInsert).not.toHaveBeenCalled();
    });

    it('should detect updated positions', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: 'exec-1',
            symbol: 'BTCUSDT',
            side: 'LONG',
            entryPrice: '50000',
            quantity: '0.1',
            leverage: 10,
          },
        ]),
      } as never);

      mockGetPositions.mockResolvedValue([
        {
          symbol: 'BTCUSDT',
          positionAmt: '0.2',
          entryPrice: '51000',
          unrealizedPnl: '100',
          leverage: 10,
          liquidationPrice: '45000',
        } as never,
      ]);

      const result = await service.syncWallet(mockWallet as never);

      expect(result.changes.updatedPositions).toContain('exec-1');
    });
  });

  describe('edge cases', () => {
    it('should handle wallet with no API keys', async () => {
      const walletNoKeys = {
        id: 'wallet-1',
        userId: 'user-1',
        name: 'Test Wallet',
        walletType: 'live',
        marketType: 'FUTURES',
        apiKeyEncrypted: '',
        apiSecretEncrypted: '',
        currentBalance: '10000',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockResolvedValue([walletNoKeys]),
      } as never);

      const results = await service.syncAllWallets();

      expect(results).toHaveLength(0);
    });

    it('should handle zero quantity positions', async () => {
      const mockWallet = {
        id: 'wallet-1',
        userId: 'user-1',
        name: 'Test Wallet',
        walletType: 'live',
        marketType: 'FUTURES',
        apiKeyEncrypted: 'key',
        apiSecretEncrypted: 'secret',
        currentBalance: '10000',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: 'exec-1',
            symbol: 'BTCUSDT',
            side: 'LONG',
            entryPrice: '50000',
            quantity: '0',
            leverage: 10,
          },
        ]),
      } as never);

      mockGetPositions.mockResolvedValue([
        {
          symbol: 'BTCUSDT',
          positionAmt: '0',
          entryPrice: '50000',
          leverage: 10,
        } as never,
      ]);

      const result = await service.syncWallet(mockWallet as never);

      expect(result.synced).toBe(true);
    });
  });

  describe('PnL calculation', () => {
    const mockWallet = {
      id: 'wallet-1',
      userId: 'user-1',
      name: 'Test Wallet',
      walletType: 'live',
      marketType: 'FUTURES',
      apiKeyEncrypted: 'key',
      apiSecretEncrypted: 'secret',
      initialBalance: '10000',
      currentBalance: '10000',
      currency: 'USDT',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should calculate positive PnL for profitable LONG position', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: 'exec-1',
            symbol: 'BTCUSDT',
            side: 'LONG',
            entryPrice: '50000',
            quantity: '0.1',
            leverage: 10,
          },
        ]),
      } as never);

      mockGetPositions.mockResolvedValue([]);
      mockGetMarkPrice.mockResolvedValue({ markPrice: 55000 });

      const result = await service.syncWallet(mockWallet as never);

      expect(result.changes.orphanedPositions).toContain('exec-1');
      expect(result.detailedOrphaned).toHaveLength(1);
      const orphaned = result.detailedOrphaned![0];
      expect(orphaned?.pnl).toBe(500);
      expect(orphaned?.exitPrice).toBe(55000);
    });

    it('should calculate negative PnL for losing LONG position', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: 'exec-1',
            symbol: 'BTCUSDT',
            side: 'LONG',
            entryPrice: '50000',
            quantity: '0.1',
            leverage: 10,
          },
        ]),
      } as never);

      mockGetPositions.mockResolvedValue([]);
      mockGetMarkPrice.mockResolvedValue({ markPrice: 45000 });

      const result = await service.syncWallet(mockWallet as never);

      expect(result.detailedOrphaned).toHaveLength(1);
      const orphaned = result.detailedOrphaned![0];
      expect(orphaned?.pnl).toBe(-500);
    });

    it('should calculate positive PnL for profitable SHORT position', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: 'exec-1',
            symbol: 'BTCUSDT',
            side: 'SHORT',
            entryPrice: '50000',
            quantity: '0.1',
            leverage: 10,
          },
        ]),
      } as never);

      mockGetPositions.mockResolvedValue([]);
      mockGetMarkPrice.mockResolvedValue({ markPrice: 45000 });

      const result = await service.syncWallet(mockWallet as never);

      expect(result.detailedOrphaned).toHaveLength(1);
      const orphaned = result.detailedOrphaned![0];
      expect(orphaned?.pnl).toBe(500);
    });

    it('should calculate negative PnL for losing SHORT position', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: 'exec-1',
            symbol: 'BTCUSDT',
            side: 'SHORT',
            entryPrice: '50000',
            quantity: '0.1',
            leverage: 10,
          },
        ]),
      } as never);

      mockGetPositions.mockResolvedValue([]);
      mockGetMarkPrice.mockResolvedValue({ markPrice: 55000 });

      const result = await service.syncWallet(mockWallet as never);

      expect(result.detailedOrphaned).toHaveLength(1);
      const orphaned = result.detailedOrphaned![0];
      expect(orphaned?.pnl).toBe(-500);
    });

    it('should calculate PnL percent based on margin', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: 'exec-1',
            symbol: 'BTCUSDT',
            side: 'LONG',
            entryPrice: '50000',
            quantity: '0.1',
            leverage: 10,
          },
        ]),
      } as never);

      mockGetPositions.mockResolvedValue([]);
      mockGetMarkPrice.mockResolvedValue({ markPrice: 55000 });

      const result = await service.syncWallet(mockWallet as never);

      const orphaned = result.detailedOrphaned![0];
      expect(orphaned?.pnlPercent).toBe(100);
    });

    it('should handle mark price fetch failure gracefully', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: 'exec-1',
            symbol: 'BTCUSDT',
            side: 'LONG',
            entryPrice: '50000',
            quantity: '0.1',
            leverage: 10,
          },
        ]),
      } as never);

      mockGetPositions.mockResolvedValue([]);
      mockGetMarkPrice.mockRejectedValue(new Error('API Error'));

      const result = await service.syncWallet(mockWallet as never);

      expect(result.changes.orphanedPositions).toContain('exec-1');
      expect(result.detailedOrphaned).toHaveLength(1);
      expect(result.detailedOrphaned![0]?.pnl).toBe(0);
    });
  });

  describe('WebSocket emissions', () => {
    const mockWallet = {
      id: 'wallet-1',
      userId: 'user-1',
      name: 'Test Wallet',
      walletType: 'live',
      marketType: 'FUTURES',
      apiKeyEncrypted: 'key',
      apiSecretEncrypted: 'secret',
      currentBalance: '10000',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should emit position update for orphaned positions when WebSocket available', async () => {
      mockWebSocketService =({
        emitPositionUpdate: mockEmitPositionUpdate,
        emitRiskAlert: mockEmitRiskAlert,
      });

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: 'exec-1',
            symbol: 'BTCUSDT',
            side: 'LONG',
            entryPrice: '50000',
            quantity: '0.1',
            leverage: 10,
          },
        ]),
      } as never);

      mockGetPositions.mockResolvedValue([]);
      mockGetMarkPrice.mockResolvedValue({ markPrice: 55000 });

      await service.syncWallet(mockWallet as never);

      expect(mockEmitPositionUpdate).toHaveBeenCalledWith(
        'wallet-1',
        expect.objectContaining({
          status: 'closed',
          exitReason: 'ORPHANED_POSITION',
        })
      );
    });

    it('should adopt unknown positions into DB and emit warning alert', async () => {
      mockWebSocketService =({
        emitPositionUpdate: mockEmitPositionUpdate,
        emitRiskAlert: mockEmitRiskAlert,
      });

      // Two .select() chains run: 1) initial dbOpenPositions read,
      // 2) race-guard re-check before insert. Both return [] so the
      // unknown-adopt path proceeds.
      const chainable = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
        then: (fn: (v: unknown) => void) => Promise.resolve([]).then(fn),
        catch: (fn: (v: unknown) => void) => Promise.resolve([]).catch(fn),
        finally: (fn: () => void) => Promise.resolve([]).finally(fn),
      };
      mockDbSelect.mockReturnValue(chainable as never);

      mockGetPositions.mockResolvedValue([
        {
          symbol: 'ETHUSDT',
          positionAmt: '0.5',
          entryPrice: '3000',
          unrealizedPnl: '50',
          leverage: 5,
          marginType: 'ISOLATED',
        } as never,
      ]);

      await service.syncWallet(mockWallet as never);

      expect(mockDbInsert).toHaveBeenCalled();
      expect(mockEmitRiskAlert).toHaveBeenCalledWith(
        'wallet-1',
        expect.objectContaining({
          type: 'UNKNOWN_POSITION',
          level: 'warning',
          symbol: 'ETHUSDT',
        })
      );
    });

    it('should not emit when WebSocket service is not available', async () => {
      mockWebSocketService =(null);

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: 'exec-1',
            symbol: 'BTCUSDT',
            side: 'LONG',
            entryPrice: '50000',
            quantity: '0.1',
            leverage: 10,
          },
        ]),
      } as never);

      mockGetPositions.mockResolvedValue([]);

      await service.syncWallet(mockWallet as never);

      expect(mockEmitPositionUpdate).not.toHaveBeenCalled();
      expect(mockEmitRiskAlert).not.toHaveBeenCalled();
    });
  });

  describe('position sync result logging', () => {
    it('should call outputPositionSyncResults with sync summary', async () => {
      const liveWallet = {
        id: 'wallet-1',
        userId: 'user-1',
        name: 'Test Wallet',
        walletType: 'live',
        marketType: 'FUTURES',
        apiKeyEncrypted: 'key',
        apiSecretEncrypted: 'secret',
        currentBalance: '10000',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockResolvedValue([liveWallet]),
      } as never);

      mockGetPositions.mockResolvedValue([]);

      await service.syncAllWallets();

      expect(mockOutputPositionSyncResults).toHaveBeenCalledWith(
        expect.objectContaining({
          walletsChecked: 1,
          walletSummaries: expect.any(Array),
        })
      );
    });
  });

  describe('position updates detection', () => {
    const mockWallet = {
      id: 'wallet-1',
      userId: 'user-1',
      name: 'Test Wallet',
      walletType: 'live',
      marketType: 'FUTURES',
      apiKeyEncrypted: 'key',
      apiSecretEncrypted: 'secret',
      currentBalance: '10000',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should detect quantity changes', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: 'exec-1',
            symbol: 'BTCUSDT',
            side: 'LONG',
            entryPrice: '50000',
            quantity: '0.1',
            leverage: 10,
          },
        ]),
      } as never);

      mockGetPositions.mockResolvedValue([
        {
          symbol: 'BTCUSDT',
          positionAmt: '0.15',
          entryPrice: '50000',
          leverage: 10,
          liquidationPrice: '45000',
        } as never,
      ]);

      const result = await service.syncWallet(mockWallet as never);

      expect(result.changes.updatedPositions).toContain('exec-1');
      expect(result.detailedUpdated).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'Quantity',
            oldValue: 0.1,
            newValue: 0.15,
          }),
        ])
      );
    });

    it('should detect entry price changes', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: 'exec-1',
            symbol: 'BTCUSDT',
            side: 'LONG',
            entryPrice: '50000',
            quantity: '0.1',
            leverage: 10,
          },
        ]),
      } as never);

      mockGetPositions.mockResolvedValue([
        {
          symbol: 'BTCUSDT',
          positionAmt: '0.1',
          entryPrice: '50100',
          leverage: 10,
          liquidationPrice: '45000',
        } as never,
      ]);

      const result = await service.syncWallet(mockWallet as never);

      expect(result.changes.updatedPositions).toContain('exec-1');
      expect(result.detailedUpdated).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'Entry Price',
            oldValue: 50000,
            newValue: 50100,
          }),
        ])
      );
    });

    it('should detect both quantity and price changes', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: 'exec-1',
            symbol: 'BTCUSDT',
            side: 'LONG',
            entryPrice: '50000',
            quantity: '0.1',
            leverage: 10,
          },
        ]),
      } as never);

      mockGetPositions.mockResolvedValue([
        {
          symbol: 'BTCUSDT',
          positionAmt: '0.2',
          entryPrice: '51000',
          leverage: 10,
          liquidationPrice: '45000',
        } as never,
      ]);

      const result = await service.syncWallet(mockWallet as never);

      expect(result.detailedUpdated).toHaveLength(2);
    });

    it('should not flag position as updated if within tolerance', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: 'exec-1',
            symbol: 'BTCUSDT',
            side: 'LONG',
            entryPrice: '50000.005',
            quantity: '0.100000001',
            leverage: 10,
          },
        ]),
      } as never);

      mockGetPositions.mockResolvedValue([
        {
          symbol: 'BTCUSDT',
          positionAmt: '0.1',
          entryPrice: '50000',
          leverage: 10,
        } as never,
      ]);

      const result = await service.syncWallet(mockWallet as never);

      expect(result.changes.updatedPositions).toHaveLength(0);
    });
  });

  describe('syncAllWallets error handling', () => {
    it('should handle rejected promises from individual wallet syncs', async () => {
      const liveWallet = {
        id: 'wallet-1',
        userId: 'user-1',
        name: 'Test Wallet',
        walletType: 'live',
        marketType: 'FUTURES',
        apiKeyEncrypted: 'key',
        apiSecretEncrypted: 'secret',
        currentBalance: '10000',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockResolvedValue([liveWallet]),
      } as never);

      mockCreateBinanceFuturesClient.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const results = await service.syncAllWallets();

      expect(results).toHaveLength(1);
      expect(results[0]?.synced).toBe(false);
      expect(results[0]?.errors).toContain('Connection failed');
    });

    it('should continue syncing other wallets when one fails', async () => {
      const wallets = [
        {
          id: 'wallet-1',
          name: 'Wallet 1',
          walletType: 'live',
          marketType: 'FUTURES',
          apiKeyEncrypted: 'key',
          apiSecretEncrypted: 'secret',
        },
        {
          id: 'wallet-2',
          name: 'Wallet 2',
          walletType: 'live',
          marketType: 'FUTURES',
          apiKeyEncrypted: 'key',
          apiSecretEncrypted: 'secret',
        },
      ];

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockResolvedValue(wallets),
      } as never);

      let callCount = 0;
      mockCreateBinanceFuturesClient.mockImplementation(() => {
        callCount++;
        if (callCount === 1) throw new Error('First wallet failed');
        return {};
      });

      mockGetPositions.mockResolvedValue([]);

      await service.syncAllWallets();

      expect(mockOutputPositionSyncResults).toHaveBeenCalledWith(
        expect.objectContaining({
          walletsChecked: 2,
        })
      );
    });
  });
});
