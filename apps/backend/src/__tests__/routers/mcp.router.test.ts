import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { mcpTradingAudit } from '../../db/schema';
import { MCP_WRITES_PER_HOUR } from '../../routers/mcp';
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

  describe('assertWriteAllowed', () => {
    it('rejects unauthenticated callers', async () => {
      const caller = createUnauthenticatedCaller();
      await expect(
        caller.mcp.assertWriteAllowed({ walletId: 'x', tool: 't' }),
      ).rejects.toThrow('UNAUTHORIZED');
    });

    it('throws NOT_FOUND when the wallet is not owned by the caller', async () => {
      const { user: u1 } = await createAuthenticatedUser({ email: 'a@test.com' });
      const { user: u2, session: s2 } = await createAuthenticatedUser({ email: 'b@test.com' });
      const wallet = await createTestWallet({ userId: u1.id, name: 'u1 wallet' });
      const c2 = createAuthenticatedCaller(u2, s2);
      await expect(
        c2.mcp.assertWriteAllowed({ walletId: wallet.id, tool: 'trading.place_order' }),
      ).rejects.toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
    });

    it('throws FORBIDDEN and writes a denied audit row when agentTradingEnabled is false', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, name: 'gated' });
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.mcp.assertWriteAllowed({ walletId: wallet.id, tool: 'trading.place_order' }),
      ).rejects.toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));

      const db = getTestDatabase();
      const rows = await db.select().from(mcpTradingAudit).where(eq(mcpTradingAudit.userId, user.id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe('denied');
      expect(rows[0]?.tool).toBe('trading.place_order');
      expect(rows[0]?.walletId).toBe(wallet.id);
      expect(rows[0]?.errorMessage).toMatch(/disabled/i);
    });

    it('returns ok when agentTradingEnabled is true and writes no audit row', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, name: 'ok', agentTradingEnabled: true });
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.mcp.assertWriteAllowed({ walletId: wallet.id, tool: 'trading.place_order' });
      expect(result.ok).toBe(true);

      const db = getTestDatabase();
      const rows = await db.select().from(mcpTradingAudit).where(eq(mcpTradingAudit.userId, user.id));
      expect(rows).toHaveLength(0);
    });

    it('throws TOO_MANY_REQUESTS and writes a rate_limited row when the per-hour cap is exceeded', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, name: 'rl', agentTradingEnabled: true });
      const caller = createAuthenticatedCaller(user, session);
      const db = getTestDatabase();

      for (let i = 0; i < MCP_WRITES_PER_HOUR; i++) {
        await caller.mcp.recordAudit({
          tool: 'trading.place_order',
          status: 'success',
          walletId: wallet.id,
        });
      }

      await expect(
        caller.mcp.assertWriteAllowed({ walletId: wallet.id, tool: 'trading.place_order' }),
      ).rejects.toThrow(expect.objectContaining({ code: 'TOO_MANY_REQUESTS' }));

      const rateLimitedRows = await db
        .select()
        .from(mcpTradingAudit)
        .where(and(
          eq(mcpTradingAudit.userId, user.id),
          eq(mcpTradingAudit.status, 'rate_limited'),
        ));
      expect(rateLimitedRows).toHaveLength(1);
      expect(rateLimitedRows[0]?.walletId).toBe(wallet.id);
      expect(rateLimitedRows[0]?.errorMessage).toMatch(/rate limit/i);
    });

    it('does not count denied or failure rows against the per-hour cap', async () => {
      const { user, session } = await createAuthenticatedUser();
      const wallet = await createTestWallet({ userId: user.id, name: 'mixed', agentTradingEnabled: true });
      const caller = createAuthenticatedCaller(user, session);

      for (let i = 0; i < MCP_WRITES_PER_HOUR; i++) {
        await caller.mcp.recordAudit({
          tool: 'trading.place_order',
          status: i % 2 === 0 ? 'failure' : 'denied',
          walletId: wallet.id,
          errorMessage: 'simulated',
        });
      }

      const result = await caller.mcp.assertWriteAllowed({ walletId: wallet.id, tool: 'trading.place_order' });
      expect(result.ok).toBe(true);
    });
  });
});
