import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { mcpTradingAudit } from '../../db/schema';
import { setupTestDatabase, teardownTestDatabase, cleanupTables, getTestDatabase } from '../helpers/test-db';
import { createAuthenticatedUser, createTestWallet } from '../helpers/test-fixtures';
import { createAuthenticatedCaller, createUnauthenticatedCaller } from '../helpers/test-caller';

describe('MCP Router', () => {
  beforeAll(async () => { await setupTestDatabase(); });
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await cleanupTables(); });

  describe('recordAudit', () => {
    it('rejects unauthenticated callers', async () => {
      const caller = createUnauthenticatedCaller();
      await expect(
        caller.mcp.recordAudit({ tool: 't', status: 'success' }),
      ).rejects.toThrow('UNAUTHORIZED');
    });

    it('inserts a row and returns its id', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.mcp.recordAudit({
        tool: 'trading.list_orders',
        status: 'success',
        inputJson: '{"walletId":"x"}',
        durationMs: 42,
      });
      expect(result.deduped).toBe(false);
      expect(result.id).toEqual(expect.any(Number));

      const db = getTestDatabase();
      const rows = await db.select().from(mcpTradingAudit).where(eq(mcpTradingAudit.id, result.id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.tool).toBe('trading.list_orders');
      expect(rows[0]?.status).toBe('success');
      expect(rows[0]?.userId).toBe(user.id);
      expect(rows[0]?.durationMs).toBe(42);
    });

    it('verifies wallet ownership when walletId is supplied', async () => {
      const { user: u1, session: s1 } = await createAuthenticatedUser({ email: 'a@test.com' });
      const { user: u2, session: s2 } = await createAuthenticatedUser({ email: 'b@test.com' });
      const wallet = await createTestWallet({ userId: u1.id, name: 'u1 wallet' });

      const c2 = createAuthenticatedCaller(u2, s2);
      await expect(
        c2.mcp.recordAudit({ tool: 't', status: 'success', walletId: wallet.id }),
      ).rejects.toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));

      const c1 = createAuthenticatedCaller(u1, s1);
      const ok = await c1.mcp.recordAudit({ tool: 't', status: 'success', walletId: wallet.id });
      expect(ok.deduped).toBe(false);
    });

    it('dedupes by idempotencyKey for the same user', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const a = await caller.mcp.recordAudit({
        tool: 't', status: 'success', idempotencyKey: 'k1',
      });
      const b = await caller.mcp.recordAudit({
        tool: 't', status: 'success', idempotencyKey: 'k1',
      });
      expect(a.deduped).toBe(false);
      expect(b.deduped).toBe(true);
      expect(b.id).toBe(a.id);

      const db = getTestDatabase();
      const rows = await db.select().from(mcpTradingAudit).where(eq(mcpTradingAudit.userId, user.id));
      expect(rows).toHaveLength(1);
    });

    it('does not dedupe across users with the same idempotencyKey', async () => {
      const { user: u1, session: s1 } = await createAuthenticatedUser({ email: 'a@test.com' });
      const { user: u2, session: s2 } = await createAuthenticatedUser({ email: 'b@test.com' });
      const c1 = createAuthenticatedCaller(u1, s1);
      const c2 = createAuthenticatedCaller(u2, s2);

      await c1.mcp.recordAudit({ tool: 't', status: 'success', idempotencyKey: 'shared' });
      const result2 = await c2.mcp.recordAudit({ tool: 't', status: 'success', idempotencyKey: 'shared' });
      expect(result2.deduped).toBe(false);
    });
  });

  describe('listAudit', () => {
    it('rejects unauthenticated callers', async () => {
      const caller = createUnauthenticatedCaller();
      await expect(caller.mcp.listAudit({ limit: 10 })).rejects.toThrow('UNAUTHORIZED');
    });

    it('returns rows for the calling user only, ordered ts desc', async () => {
      const { user: u1, session: s1 } = await createAuthenticatedUser({ email: 'a@test.com' });
      const { user: u2, session: s2 } = await createAuthenticatedUser({ email: 'b@test.com' });
      const c1 = createAuthenticatedCaller(u1, s1);
      const c2 = createAuthenticatedCaller(u2, s2);

      await c1.mcp.recordAudit({ tool: 't1', status: 'success' });
      await c1.mcp.recordAudit({ tool: 't2', status: 'failure', errorMessage: 'boom' });
      await c2.mcp.recordAudit({ tool: 'other', status: 'success' });

      const list = await c1.mcp.listAudit({ limit: 50 });
      expect(list).toHaveLength(2);
      expect(list[0]?.tool).toBe('t2');
      expect(list[1]?.tool).toBe('t1');
      expect(list.every((r) => r.tool !== 'other')).toBe(true);
    });

    it('filters by walletId when supplied', async () => {
      const { user, session } = await createAuthenticatedUser();
      const w1 = await createTestWallet({ userId: user.id, name: 'A' });
      const w2 = await createTestWallet({ userId: user.id, name: 'B' });
      const caller = createAuthenticatedCaller(user, session);

      await caller.mcp.recordAudit({ tool: 't1', status: 'success', walletId: w1.id });
      await caller.mcp.recordAudit({ tool: 't2', status: 'success', walletId: w2.id });
      await caller.mcp.recordAudit({ tool: 't3', status: 'success' });

      const onlyW1 = await caller.mcp.listAudit({ walletId: w1.id, limit: 50 });
      expect(onlyW1).toHaveLength(1);
      expect(onlyW1[0]?.tool).toBe('t1');
    });

    it('respects limit', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);
      for (let i = 0; i < 5; i++) {
        await caller.mcp.recordAudit({ tool: `t${i}`, status: 'success' });
      }
      const list = await caller.mcp.listAudit({ limit: 3 });
      expect(list).toHaveLength(3);
    });
  });
});
