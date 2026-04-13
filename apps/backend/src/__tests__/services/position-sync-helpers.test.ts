import { describe, expect, it, vi } from 'vitest';
import { createEmptySyncResult, createFailedSyncResult } from '../../services/position-sync-helpers';

vi.mock('../../db', () => ({
  db: {
    query: { orders: { findFirst: vi.fn() } },
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    insert: vi.fn(),
  },
}));

vi.mock('../../db/schema', () => ({
  orders: {},
  tradeExecutions: {},
}));

vi.mock('../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  serializeError: vi.fn((e: unknown) => String(e)),
}));

vi.mock('../../services/auto-trading', () => ({
  autoTradingService: {
    createStopLossOrder: vi.fn(),
    createTakeProfitOrder: vi.fn(),
  },
}));

describe('createEmptySyncResult', () => {
  it('creates a result with default empty values', () => {
    const result = createEmptySyncResult('wallet-123');
    expect(result.walletId).toBe('wallet-123');
    expect(result.synced).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.changes.orphanedPositions).toEqual([]);
    expect(result.changes.unknownPositions).toEqual([]);
    expect(result.changes.updatedPositions).toEqual([]);
    expect(result.changes.balanceUpdated).toBe(false);
    expect(result.detailedOrphaned).toEqual([]);
    expect(result.detailedUnknown).toEqual([]);
    expect(result.detailedUpdated).toEqual([]);
  });

  it('creates independent instances', () => {
    const result1 = createEmptySyncResult('w1');
    const result2 = createEmptySyncResult('w2');
    result1.changes.orphanedPositions.push('sym1');
    expect(result2.changes.orphanedPositions).toEqual([]);
  });
});

describe('createFailedSyncResult', () => {
  it('creates a failed result with error message', () => {
    const result = createFailedSyncResult('wallet-456', 'Connection failed');
    expect(result.walletId).toBe('wallet-456');
    expect(result.synced).toBe(false);
    expect(result.errors).toEqual(['Connection failed']);
    expect(result.changes.orphanedPositions).toEqual([]);
    expect(result.changes.unknownPositions).toEqual([]);
    expect(result.changes.updatedPositions).toEqual([]);
    expect(result.changes.balanceUpdated).toBe(false);
  });

  it('does not include detailed arrays', () => {
    const result = createFailedSyncResult('w1', 'err');
    expect(result.detailedOrphaned).toBeUndefined();
    expect(result.detailedUnknown).toBeUndefined();
    expect(result.detailedUpdated).toBeUndefined();
  });

  it('creates independent instances', () => {
    const result1 = createFailedSyncResult('w1', 'err1');
    const result2 = createFailedSyncResult('w2', 'err2');
    result1.errors.push('extra');
    expect(result2.errors).toEqual(['err2']);
  });
});
