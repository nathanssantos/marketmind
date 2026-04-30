import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { userLayouts, userLayoutsHistory } from '../../db/schema';
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
});
