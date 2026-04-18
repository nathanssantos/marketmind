import { DEFAULT_USER_INDICATOR_SEEDS } from '@marketmind/trading-core';
import { TRPCError } from '@trpc/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupTables, setupTestDatabase, teardownTestDatabase } from '../helpers/test-db';
import { createAuthenticatedUser } from '../helpers/test-fixtures';
import { createAuthenticatedCaller, createUnauthenticatedCaller } from '../helpers/test-caller';

describe('User Indicators Router', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
  });

  describe('list', () => {
    it('seeds defaults on first call', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.userIndicators.list();

      expect(result.length).toBe(DEFAULT_USER_INDICATOR_SEEDS.length);
      const labels = result.map((i) => i.label).sort();
      const expected = DEFAULT_USER_INDICATOR_SEEDS.map((s) => s.label).sort();
      expect(labels).toEqual(expected);
      expect(result.every((i) => !i.isCustom)).toBe(true);
    });

    it('does not re-seed on subsequent calls', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const first = await caller.userIndicators.list();
      const second = await caller.userIndicators.list();

      expect(second.length).toBe(first.length);
      expect(second.map((i) => i.id).sort()).toEqual(first.map((i) => i.id).sort());
    });

    it('isolates indicators per user', async () => {
      const { user: u1, session: s1 } = await createAuthenticatedUser({ email: 'u1@test.com' });
      const { user: u2, session: s2 } = await createAuthenticatedUser({ email: 'u2@test.com' });

      const c1 = createAuthenticatedCaller(u1, s1);
      const c2 = createAuthenticatedCaller(u2, s2);

      const r1 = await c1.userIndicators.list();
      const r2 = await c2.userIndicators.list();

      const intersection = r1.filter((a) => r2.some((b) => b.id === a.id));
      expect(intersection).toEqual([]);
    });

    it('requires authentication', async () => {
      const caller = createUnauthenticatedCaller();
      await expect(caller.userIndicators.list()).rejects.toThrow(TRPCError);
    });
  });

  describe('create', () => {
    it('creates a custom indicator', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);
      await caller.userIndicators.list();

      const result = await caller.userIndicators.create({
        catalogType: 'ema',
        label: 'EMA 33',
        params: { period: 33, color: '#abcdef', lineWidth: 2 },
      });

      expect(result.catalogType).toBe('ema');
      expect(result.label).toBe('EMA 33');
      expect(result.params.period).toBe(33);
      expect(result.isCustom).toBe(true);
    });

    it('rejects unknown catalog types', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.userIndicators.create({
          catalogType: 'not-a-real-indicator',
          label: 'Bogus',
          params: {},
        }),
      ).rejects.toThrow(/Unknown indicator type/);
    });
  });

  describe('update', () => {
    it('updates label and params', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const created = await caller.userIndicators.create({
        catalogType: 'rsi',
        label: 'Custom RSI',
        params: { period: 10, color: '#ff0000', lineWidth: 1 },
      });

      const updated = await caller.userIndicators.update({
        id: created.id,
        label: 'Updated RSI',
        params: { period: 20, color: '#00ff00', lineWidth: 2 },
      });

      expect(updated.label).toBe('Updated RSI');
      expect(updated.params.period).toBe(20);
    });

    it('rejects update of another user indicator', async () => {
      const { user: u1, session: s1 } = await createAuthenticatedUser({ email: 'u1@test.com' });
      const { user: u2, session: s2 } = await createAuthenticatedUser({ email: 'u2@test.com' });

      const c1 = createAuthenticatedCaller(u1, s1);
      const c2 = createAuthenticatedCaller(u2, s2);

      const owned = await c1.userIndicators.create({
        catalogType: 'ema',
        label: 'E',
        params: { period: 5 },
      });

      await expect(
        c2.userIndicators.update({ id: owned.id, label: 'Hijacked' }),
      ).rejects.toThrow(/not found/i);
    });
  });

  describe('delete', () => {
    it('deletes an indicator', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const created = await caller.userIndicators.create({
        catalogType: 'atr',
        label: 'ATR 5',
        params: { period: 5 },
      });

      await caller.userIndicators.delete({ id: created.id });

      const list = await caller.userIndicators.list();
      expect(list.find((i) => i.id === created.id)).toBeUndefined();
    });
  });

  describe('duplicate', () => {
    it('creates a clone with " (copy)" suffix and isCustom=true', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const source = await caller.userIndicators.create({
        catalogType: 'ema',
        label: 'EMA 21',
        params: { period: 21, color: '#aabbcc', lineWidth: 2 },
      });

      const copy = await caller.userIndicators.duplicate({ id: source.id });

      expect(copy.id).not.toBe(source.id);
      expect(copy.catalogType).toBe(source.catalogType);
      expect(copy.label).toBe('EMA 21 (copy)');
      expect(copy.params).toEqual(source.params);
      expect(copy.isCustom).toBe(true);
    });

    it('rejects duplicating an indicator that does not belong to the caller', async () => {
      const { user: u1, session: s1 } = await createAuthenticatedUser({ email: 'd1@test.com' });
      const { user: u2, session: s2 } = await createAuthenticatedUser({ email: 'd2@test.com' });
      const c1 = createAuthenticatedCaller(u1, s1);
      const c2 = createAuthenticatedCaller(u2, s2);

      const owned = await c1.userIndicators.create({
        catalogType: 'rsi',
        label: 'RSI',
        params: { period: 14 },
      });

      await expect(c2.userIndicators.duplicate({ id: owned.id })).rejects.toThrow(/not found/i);
    });
  });

  describe('reset', () => {
    it('restores default seeds after deletion', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const before = await caller.userIndicators.list();
      for (const ind of before) await caller.userIndicators.delete({ id: ind.id });
      expect((await caller.userIndicators.list()).length).toBe(DEFAULT_USER_INDICATOR_SEEDS.length);

      await caller.userIndicators.create({ catalogType: 'ema', label: 'Extra', params: { period: 7 } });

      const result = await caller.userIndicators.reset();
      expect(result.length).toBe(DEFAULT_USER_INDICATOR_SEEDS.length);
      expect(result.every((i) => !i.isCustom)).toBe(true);
    });
  });
});
