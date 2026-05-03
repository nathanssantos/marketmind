import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { userLayouts, userLayoutsAudit, userLayoutsHistory } from '../../db/schema';
import { setupTestDatabase, teardownTestDatabase, cleanupTables, getTestDatabase } from '../helpers/test-db';
import { createAuthenticatedUser } from '../helpers/test-fixtures';
import { createAuthenticatedCaller, createUnauthenticatedCaller } from '../helpers/test-caller';

const NON_DEFAULT_LAYOUT = JSON.stringify({
  symbolTabs: [
    { id: 'default', symbol: 'BTCUSDT', marketType: 'FUTURES', activeLayoutId: 'single', order: 0 },
    { id: 'tab-2', symbol: 'ETHUSDT', marketType: 'FUTURES', activeLayoutId: 'single', order: 1 },
    { id: 'tab-3', symbol: 'SOLUSDT', marketType: 'FUTURES', activeLayoutId: 'single', order: 2 },
  ],
  activeSymbolTabId: 'default',
  layoutPresets: [
    { id: 'single', name: 'Single Chart', grid: [], order: 0 },
    { id: 'dual', name: 'Dual', grid: [], order: 1 },
    { id: 'quad', name: 'Quad', grid: [], order: 2 },
    { id: 'custom', name: 'Custom', grid: [], order: 3 },
  ],
});

const DEFAULT_LAYOUT = JSON.stringify({
  symbolTabs: [
    { id: 'default', symbol: 'BTCUSDT', marketType: 'FUTURES', activeLayoutId: 'single', order: 0 },
  ],
  activeSymbolTabId: 'default',
  layoutPresets: [
    { id: 'single', name: 'Single Chart', grid: [], order: 0 },
    { id: 'dual', name: 'Dual', grid: [], order: 1 },
    { id: 'quad', name: 'Quad', grid: [], order: 2 },
  ],
});

// v2 default layout shape: trading / autotrading / scalping replaced
// the old single / dual / quad presets in v1.10. The overwrite-protection
// guard accepts both id sets so existing users + fresh installs both
// trip the same check.
const DEFAULT_LAYOUT_V2 = JSON.stringify({
  symbolTabs: [
    { id: 'default', symbol: 'BTCUSDT', marketType: 'FUTURES', activeLayoutId: 'trading', order: 0 },
  ],
  activeSymbolTabId: 'default',
  layoutPresets: [
    { id: 'trading', name: 'Trading', grid: [], order: 0 },
    { id: 'autotrading', name: 'Auto-Trading', grid: [], order: 1 },
    { id: 'scalping', name: 'Scalping', grid: [], order: 2 },
  ],
});

describe('Layout Router', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
  });

  describe('get', () => {
    it('returns null when no layout exists', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);
      expect(await caller.layout.get()).toBeNull();
    });

    it('returns parsed layout when present', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);
      await caller.layout.save({ data: NON_DEFAULT_LAYOUT });
      const result = await caller.layout.get();
      expect(result).toEqual(JSON.parse(NON_DEFAULT_LAYOUT));
    });

    it('rejects unauthenticated callers', async () => {
      const caller = createUnauthenticatedCaller();
      await expect(caller.layout.get()).rejects.toThrow(
        expect.objectContaining({ code: 'UNAUTHORIZED' }),
      );
    });
  });

  describe('save', () => {
    it('creates a new layout row', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);
      const result = await caller.layout.save({ data: NON_DEFAULT_LAYOUT });
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
    });

    it('updates an existing row on subsequent saves', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);
      const first = await caller.layout.save({ data: DEFAULT_LAYOUT });
      const second = await caller.layout.save({ data: NON_DEFAULT_LAYOUT });
      expect(first.id).toBe(second.id);
    });

    it('refuses to overwrite a non-default layout with the default state', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);
      await caller.layout.save({ data: NON_DEFAULT_LAYOUT });

      await expect(caller.layout.save({ data: DEFAULT_LAYOUT })).rejects.toThrow(
        expect.objectContaining({ code: 'PRECONDITION_FAILED' }),
      );

      const stored = await caller.layout.get();
      expect(stored).toEqual(JSON.parse(NON_DEFAULT_LAYOUT));
    });

    it('allows the default state to be saved when no row exists', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);
      const result = await caller.layout.save({ data: DEFAULT_LAYOUT });
      expect(result.success).toBe(true);
    });

    it('allows overwriting a default layout with the default again (no-op shape)', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);
      await caller.layout.save({ data: DEFAULT_LAYOUT });
      const result = await caller.layout.save({ data: DEFAULT_LAYOUT });
      expect(result.success).toBe(true);
    });

    it('refuses to overwrite a non-default layout with the v2 default state (trading/autotrading/scalping)', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);
      await caller.layout.save({ data: NON_DEFAULT_LAYOUT });

      await expect(caller.layout.save({ data: DEFAULT_LAYOUT_V2 })).rejects.toThrow(
        expect.objectContaining({ code: 'PRECONDITION_FAILED' }),
      );
    });

    it('allows the v2 default state to be saved when no row exists (fresh user post-v1.10)', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);
      const result = await caller.layout.save({ data: DEFAULT_LAYOUT_V2 });
      expect(result.success).toBe(true);
    });

    it('snapshots the previous state when the prior row is older than the snapshot interval', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);
      const db = getTestDatabase();

      await caller.layout.save({ data: NON_DEFAULT_LAYOUT });
      const past = new Date(Date.now() - 25 * 60 * 60 * 1000);
      await db.update(userLayouts).set({ updatedAt: past }).where(eq(userLayouts.userId, user.id));

      const newer = JSON.stringify({
        ...JSON.parse(NON_DEFAULT_LAYOUT),
        activeSymbolTabId: 'tab-2',
      });
      await caller.layout.save({ data: newer });

      const snapshots = await caller.layout.listSnapshots();
      expect(snapshots).toHaveLength(1);
      const snapshot = await db.query.userLayoutsHistory.findFirst({
        where: eq(userLayoutsHistory.id, snapshots[0]!.id),
      });
      expect(snapshot?.data).toBe(NON_DEFAULT_LAYOUT);
    });

    it('does not snapshot when the prior row is recent', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await caller.layout.save({ data: NON_DEFAULT_LAYOUT });
      const newer = JSON.stringify({
        ...JSON.parse(NON_DEFAULT_LAYOUT),
        activeSymbolTabId: 'tab-2',
      });
      await caller.layout.save({ data: newer });

      const snapshots = await caller.layout.listSnapshots();
      expect(snapshots).toHaveLength(0);
    });
  });

  describe('listSnapshots + restoreSnapshot', () => {
    it('lists snapshots ordered by snapshotAt desc', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);
      const db = getTestDatabase();

      await db.insert(userLayoutsHistory).values([
        { userId: user.id, data: '{"v":1}', snapshotAt: new Date('2026-04-01') },
        { userId: user.id, data: '{"v":2}', snapshotAt: new Date('2026-04-15') },
        { userId: user.id, data: '{"v":3}', snapshotAt: new Date('2026-04-10') },
      ]);

      const snapshots = await caller.layout.listSnapshots();
      expect(snapshots).toHaveLength(3);
      expect(snapshots[0]!.snapshotAt.toISOString()).toBe('2026-04-15T00:00:00.000Z');
      expect(snapshots[2]!.snapshotAt.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    });

    it('only returns snapshots for the calling user', async () => {
      const { user: u1, session: s1 } = await createAuthenticatedUser({ email: 'u1@test.com' });
      const { user: u2, session: s2 } = await createAuthenticatedUser({ email: 'u2@test.com' });
      const db = getTestDatabase();

      await db.insert(userLayoutsHistory).values([
        { userId: u1.id, data: '{"v":"u1"}' },
        { userId: u2.id, data: '{"v":"u2"}' },
      ]);

      const c1 = createAuthenticatedCaller(u1, s1);
      const c2 = createAuthenticatedCaller(u2, s2);
      expect(await c1.layout.listSnapshots()).toHaveLength(1);
      expect(await c2.layout.listSnapshots()).toHaveLength(1);
    });

    it('restores a snapshot back into user_layouts and snapshots the current state', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);
      const db = getTestDatabase();

      await caller.layout.save({ data: NON_DEFAULT_LAYOUT });
      const [snap] = await db
        .insert(userLayoutsHistory)
        .values({ userId: user.id, data: '{"older":"state"}' })
        .returning();

      await caller.layout.restoreSnapshot({ snapshotId: snap!.id });

      const current = await caller.layout.get();
      expect(current).toEqual({ older: 'state' });

      const snapshots = await caller.layout.listSnapshots();
      const matchesNonDefault = snapshots.find((s) =>
        s.id !== snap!.id,
      );
      expect(matchesNonDefault).toBeDefined();
    });

    it('rejects restore for snapshots belonging to a different user', async () => {
      const { user: u1 } = await createAuthenticatedUser({ email: 'u1@test.com' });
      const { user: u2, session: s2 } = await createAuthenticatedUser({ email: 'u2@test.com' });
      const db = getTestDatabase();

      const [snap] = await db
        .insert(userLayoutsHistory)
        .values({ userId: u1.id, data: '{"v":"u1"}' })
        .returning();

      const c2 = createAuthenticatedCaller(u2, s2);
      await expect(c2.layout.restoreSnapshot({ snapshotId: snap!.id })).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' }),
      );
    });
  });

  describe('audit log', () => {
    it('writes one audit row per save with prev=null on first write', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);
      const db = getTestDatabase();

      await caller.layout.save({ data: NON_DEFAULT_LAYOUT });

      const rows = await db.select().from(userLayoutsAudit).where(eq(userLayoutsAudit.userId, user.id));
      expect(rows).toHaveLength(1);
      expect(rows[0]!.prevDataHash).toBeNull();
      expect(rows[0]!.newDataHash).toBe(createHash('sha256').update(NON_DEFAULT_LAYOUT).digest('hex'));
      expect(rows[0]!.source).toBe('renderer');
    });

    it('records prev hash on subsequent saves and respects custom source/clientVersion', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);
      const db = getTestDatabase();

      await caller.layout.save({ data: NON_DEFAULT_LAYOUT });
      const newer = JSON.stringify({ ...JSON.parse(NON_DEFAULT_LAYOUT), activeSymbolTabId: 'tab-2' });
      await caller.layout.save({ data: newer, source: 'mcp', clientVersion: '1.4.0' });

      const rows = await db
        .select()
        .from(userLayoutsAudit)
        .where(eq(userLayoutsAudit.userId, user.id))
        .orderBy(userLayoutsAudit.id);
      expect(rows).toHaveLength(2);
      expect(rows[1]!.prevDataHash).toBe(createHash('sha256').update(NON_DEFAULT_LAYOUT).digest('hex'));
      expect(rows[1]!.newDataHash).toBe(createHash('sha256').update(newer).digest('hex'));
      expect(rows[1]!.source).toBe('mcp');
      expect(rows[1]!.clientVersion).toBe('1.4.0');
    });

    it('prunes audit rows older than 90 days on write', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);
      const db = getTestDatabase();

      const ancient = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
      const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      await db.insert(userLayoutsAudit).values([
        { userId: user.id, newDataHash: 'a'.repeat(64), ts: ancient },
        { userId: user.id, newDataHash: 'b'.repeat(64), ts: recent },
      ]);

      await caller.layout.save({ data: NON_DEFAULT_LAYOUT });

      const remaining = await db.select().from(userLayoutsAudit).where(eq(userLayoutsAudit.userId, user.id));
      const ancientLeft = remaining.filter((r) => r.ts.getTime() <= ancient.getTime() + 1000);
      expect(ancientLeft).toHaveLength(0);
      expect(remaining.length).toBeGreaterThanOrEqual(2);
    });

    it("records a 'restore' source audit row when restoreSnapshot runs", async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);
      const db = getTestDatabase();

      await caller.layout.save({ data: NON_DEFAULT_LAYOUT });
      const [snap] = await db
        .insert(userLayoutsHistory)
        .values({ userId: user.id, data: '{"older":"state"}' })
        .returning();

      await caller.layout.restoreSnapshot({ snapshotId: snap!.id });

      const rows = await db
        .select()
        .from(userLayoutsAudit)
        .where(eq(userLayoutsAudit.userId, user.id))
        .orderBy(userLayoutsAudit.id);
      expect(rows.some((r) => r.source === 'restore')).toBe(true);
    });

    it('does not surface audit rows from other users when filtering', async () => {
      const { user: u1, session: s1 } = await createAuthenticatedUser({ email: 'a@test.com' });
      const { user: u2, session: s2 } = await createAuthenticatedUser({ email: 'b@test.com' });
      const db = getTestDatabase();

      const c1 = createAuthenticatedCaller(u1, s1);
      const c2 = createAuthenticatedCaller(u2, s2);
      await c1.layout.save({ data: NON_DEFAULT_LAYOUT });
      await c2.layout.save({ data: NON_DEFAULT_LAYOUT });

      const u1Rows = await db.select().from(userLayoutsAudit).where(eq(userLayoutsAudit.userId, u1.id));
      const u2Rows = await db.select().from(userLayoutsAudit).where(eq(userLayoutsAudit.userId, u2.id));
      expect(u1Rows).toHaveLength(1);
      expect(u2Rows).toHaveLength(1);
    });
  });
});
