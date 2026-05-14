import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import {
  markExecutionClosedInAllCaches,
  markPendingExecCancelledByOrderIdInAllCaches,
  patchExecutionInAllCaches,
  replaceOpenExecutionsInAllCaches,
} from './executionCacheSync';

// Hard-coded mirrors of the keys `getQueryKey(trpc.x.y)` produces.
// The trpc proxy paths aren't materialized at vitest module-load
// (no React provider), so we build keys manually here. Helper code
// uses `getQueryKey` which produces the same shape — kept in sync
// by the integration test in RealtimeTradingSyncContext.
const tradeExecKey = [['trading', 'getTradeExecutions']];
const activeExecKey = [['autoTrading', 'getActiveExecutions']];

interface Execution {
  id: string;
  walletId: string;
  status?: string | null;
  stopLoss?: string | null;
  pnl?: string | null;
  entryOrderId?: string | number | null;
}

/**
 * Builds the tRPC v11 cache key for a given procedure + input. Mirrors
 * what `useQuery` writes when it caches a response, so the test can
 * pre-seed the cache and verify the helper's predicate matches.
 *
 * The {input, type} wrapper is what tRPC's react-query bridge stores
 * at queryKey[1]; the helper reads `wrapper.input` — keep these in
 * sync if tRPC ever changes the shape.
 */
const buildKey = (procedureKey: readonly unknown[], input: object) => [
  ...procedureKey,
  { input, type: 'query' },
];

const seedAllVariants = (qc: QueryClient, walletId: string, rows: Execution[]) => {
  qc.setQueryData(buildKey(tradeExecKey, { walletId, status: 'open', limit: 500 }), rows);
  qc.setQueryData(buildKey(tradeExecKey, { walletId, limit: 100 }), rows);
  qc.setQueryData(buildKey(tradeExecKey, { walletId, status: 'closed', limit: 100 }), [
    { id: 'closed-1', walletId, status: 'closed' },
  ]);
  qc.setQueryData(buildKey(activeExecKey, { walletId }), rows);
};

const readVariants = (qc: QueryClient, walletId: string) => ({
  tradeOpen500: qc.getQueryData<Execution[]>(buildKey(tradeExecKey, { walletId, status: 'open', limit: 500 })),
  tradeAll100: qc.getQueryData<Execution[]>(buildKey(tradeExecKey, { walletId, limit: 100 })),
  tradeClosed100: qc.getQueryData<Execution[]>(buildKey(tradeExecKey, { walletId, status: 'closed', limit: 100 })),
  activeWallet: qc.getQueryData<Execution[]>(buildKey(activeExecKey, { walletId })),
});

describe('executionCacheSync', () => {
  describe('replaceOpenExecutionsInAllCaches', () => {
    it('replaces open-rows variants for the target wallet on both procedures', () => {
      const qc = new QueryClient();
      const seed: Execution[] = [{ id: 'e1', walletId: 'w1', status: 'open', stopLoss: '49000' }];
      seedAllVariants(qc, 'w1', seed);

      const next: Execution[] = [
        { id: 'e1', walletId: 'w1', status: 'open', stopLoss: '50000' },
        { id: 'e2', walletId: 'w1', status: 'open', stopLoss: '60000' },
      ];
      replaceOpenExecutionsInAllCaches(qc, 'w1', next);

      const after = readVariants(qc, 'w1');
      expect(after.tradeOpen500).toEqual(next);
      expect(after.tradeAll100).toEqual(next);
      expect(after.activeWallet).toEqual(next);
    });

    it('does NOT pollute status:"closed" variants', () => {
      const qc = new QueryClient();
      seedAllVariants(qc, 'w1', [{ id: 'e1', walletId: 'w1', status: 'open' }]);

      const closedBefore = readVariants(qc, 'w1').tradeClosed100;
      replaceOpenExecutionsInAllCaches(qc, 'w1', [{ id: 'e9', walletId: 'w1', status: 'open' }]);
      const closedAfter = readVariants(qc, 'w1').tradeClosed100;

      // Closed-only variant must remain identical.
      expect(closedAfter).toBe(closedBefore);
    });

    it('does NOT touch other wallets', () => {
      const qc = new QueryClient();
      seedAllVariants(qc, 'w1', [{ id: 'e1', walletId: 'w1', status: 'open' }]);
      const w2Seed: Execution[] = [{ id: 'x', walletId: 'w2', status: 'open' }];
      qc.setQueryData(buildKey(activeExecKey, { walletId: 'w2' }), w2Seed);

      replaceOpenExecutionsInAllCaches(qc, 'w1', [{ id: 'e9', walletId: 'w1', status: 'open' }]);

      expect(qc.getQueryData(buildKey(activeExecKey, { walletId: 'w2' }))).toBe(w2Seed);
    });

    it('no-ops on empty walletId', () => {
      const qc = new QueryClient();
      seedAllVariants(qc, 'w1', [{ id: 'e1', walletId: 'w1', status: 'open' }]);
      const before = readVariants(qc, 'w1');
      replaceOpenExecutionsInAllCaches(qc, '', []);
      expect(readVariants(qc, 'w1').tradeOpen500).toBe(before.tradeOpen500);
    });
  });

  describe('patchExecutionInAllCaches', () => {
    it('patches the target row across every wallet-scoped variant', () => {
      const qc = new QueryClient();
      const seed: Execution[] = [
        { id: 'e1', walletId: 'w1', status: 'open', stopLoss: '49000' },
        { id: 'e2', walletId: 'w1', status: 'open', stopLoss: '60000' },
      ];
      seedAllVariants(qc, 'w1', seed);

      patchExecutionInAllCaches(qc, 'w1', { id: 'e1', stopLoss: '50500' });

      const after = readVariants(qc, 'w1');
      const findE1 = (rows?: Execution[]) => rows?.find((r) => r.id === 'e1');
      expect(findE1(after.tradeOpen500)?.stopLoss).toBe('50500');
      expect(findE1(after.tradeAll100)?.stopLoss).toBe('50500');
      expect(findE1(after.activeWallet)?.stopLoss).toBe('50500');
      // e2 untouched
      expect(after.tradeOpen500?.find((r) => r.id === 'e2')?.stopLoss).toBe('60000');
    });

    it('returns the same array reference when nothing matched (cheap re-render)', () => {
      const qc = new QueryClient();
      const seed: Execution[] = [{ id: 'e1', walletId: 'w1', status: 'open' }];
      seedAllVariants(qc, 'w1', seed);

      patchExecutionInAllCaches(qc, 'w1', { id: 'never-existed', stopLoss: '0' });

      // mergePositionUpdate returns same ref when id not found, so the
      // cache value's identity should be preserved (downstream React.memo
      // short-circuits cheaply).
      const after = readVariants(qc, 'w1');
      expect(after.tradeOpen500).toBe(seed);
      expect(after.activeWallet).toBe(seed);
    });
  });

  describe('markPendingExecCancelledByOrderIdInAllCaches', () => {
    it('flips pending exec status to cancelled across both procedures', () => {
      const qc = new QueryClient();
      const seed: Execution[] = [
        { id: 'p1', walletId: 'w1', status: 'pending', entryOrderId: '111' },
        { id: 'o1', walletId: 'w1', status: 'open', entryOrderId: '222' },
      ];
      seedAllVariants(qc, 'w1', seed);

      markPendingExecCancelledByOrderIdInAllCaches(qc, 'w1', '111');

      const after = readVariants(qc, 'w1');
      const findP1 = (rows?: Execution[]) => rows?.find((r) => r.id === 'p1');
      expect(findP1(after.tradeOpen500)?.status).toBe('cancelled');
      expect(findP1(after.tradeAll100)?.status).toBe('cancelled');
      expect(findP1(after.activeWallet)?.status).toBe('cancelled');
      // open row untouched
      expect(after.tradeOpen500?.find((r) => r.id === 'o1')?.status).toBe('open');
    });

    it('no-ops when no pending exec matches the orderId', () => {
      const qc = new QueryClient();
      const seed: Execution[] = [{ id: 'p1', walletId: 'w1', status: 'pending', entryOrderId: '111' }];
      seedAllVariants(qc, 'w1', seed);

      markPendingExecCancelledByOrderIdInAllCaches(qc, 'w1', '999');

      const after = readVariants(qc, 'w1');
      expect(after.tradeOpen500).toBe(seed);
      expect(after.activeWallet).toBe(seed);
    });

    it('no-ops on empty walletId or empty orderId', () => {
      const qc = new QueryClient();
      const seed: Execution[] = [{ id: 'p1', walletId: 'w1', status: 'pending', entryOrderId: '111' }];
      seedAllVariants(qc, 'w1', seed);
      const before = readVariants(qc, 'w1');

      markPendingExecCancelledByOrderIdInAllCaches(qc, '', '111');
      markPendingExecCancelledByOrderIdInAllCaches(qc, 'w1', null);
      markPendingExecCancelledByOrderIdInAllCaches(qc, 'w1', undefined);
      markPendingExecCancelledByOrderIdInAllCaches(qc, 'w1', '');

      const after = readVariants(qc, 'w1');
      expect(after.tradeOpen500).toBe(before.tradeOpen500);
      expect(after.activeWallet).toBe(before.activeWallet);
    });

    it('does NOT touch other wallets', () => {
      const qc = new QueryClient();
      seedAllVariants(qc, 'w1', [{ id: 'p1', walletId: 'w1', status: 'pending', entryOrderId: '111' }]);
      const w2Seed: Execution[] = [{ id: 'p2', walletId: 'w2', status: 'pending', entryOrderId: '111' }];
      qc.setQueryData(buildKey(activeExecKey, { walletId: 'w2' }), w2Seed);

      markPendingExecCancelledByOrderIdInAllCaches(qc, 'w1', '111');

      // w2's pending exec with same entryOrderId stays pending.
      expect(qc.getQueryData(buildKey(activeExecKey, { walletId: 'w2' }))).toBe(w2Seed);
    });
  });

  describe('markExecutionClosedInAllCaches', () => {
    it('flips status + merges pnl across every wallet-scoped variant', () => {
      const qc = new QueryClient();
      const seed: Execution[] = [{ id: 'e1', walletId: 'w1', status: 'open', stopLoss: '49000' }];
      seedAllVariants(qc, 'w1', seed);

      markExecutionClosedInAllCaches(qc, 'w1', { positionId: 'e1', pnl: 12.5, pnlPercent: 1.2, exitReason: 'STOP_LOSS' });

      const after = readVariants(qc, 'w1');
      const findE1 = (rows?: Execution[]) => rows?.find((r) => r.id === 'e1') as Execution & { pnl?: string; exitReason?: string };
      expect(findE1(after.tradeOpen500)?.status).toBe('closed');
      expect(findE1(after.tradeOpen500)?.pnl).toBe('12.5');
      expect(findE1(after.tradeAll100)?.status).toBe('closed');
      expect(findE1(after.activeWallet)?.status).toBe('closed');
    });
  });
});
