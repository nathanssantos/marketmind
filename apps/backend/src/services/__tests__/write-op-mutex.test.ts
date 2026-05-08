import { describe, it, expect, beforeEach, vi } from 'vitest';
import { withWriteLock, __resetWriteOpMutexForTests } from '../write-op-mutex';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() },
}));

describe('writeOpMutex', () => {
  beforeEach(() => {
    __resetWriteOpMutexForTests();
  });

  it('runs single op and returns its value', async () => {
    const result = await withWriteLock('w1', 'BTCUSDT', async () => 42);
    expect(result).toBe(42);
  });

  it('serializes back-to-back ops on the same (walletId, symbol)', async () => {
    const order: number[] = [];
    let bStarted = false;
    const a = withWriteLock('w1', 'BTCUSDT', async () => {
      order.push(1);
      await new Promise((r) => setTimeout(r, 20));
      // If b was running in parallel, bStarted would be true here.
      expect(bStarted).toBe(false);
      order.push(2);
      return 'a';
    });
    const b = withWriteLock('w1', 'BTCUSDT', async () => {
      bStarted = true;
      order.push(3);
      await new Promise((r) => setTimeout(r, 5));
      order.push(4);
      return 'b';
    });
    expect(await a).toBe('a');
    expect(await b).toBe('b');
    expect(order).toEqual([1, 2, 3, 4]);
  });

  it('does NOT serialize ops on different keys', async () => {
    const order: number[] = [];
    const a = withWriteLock('w1', 'BTCUSDT', async () => {
      order.push(1);
      await new Promise((r) => setTimeout(r, 30));
      order.push(2);
    });
    const b = withWriteLock('w1', 'ETHUSDT', async () => {
      order.push(3);
      await new Promise((r) => setTimeout(r, 5));
      order.push(4);
    });
    await Promise.all([a, b]);
    // 'b' (ETHUSDT) should run in parallel with 'a' (BTCUSDT) — different
    // mutex slot, no serialization. Expect interleaving.
    expect(order).toContain(1);
    expect(order).toContain(2);
    expect(order).toContain(3);
    expect(order).toContain(4);
    // 'b' finishes before 'a' (b sleeps 5ms vs a 30ms).
    expect(order.indexOf(4)).toBeLessThan(order.indexOf(2));
  });

  it('releases lock on rejection so the queue advances', async () => {
    const a = withWriteLock('w1', 'BTCUSDT', async () => {
      throw new Error('boom');
    });
    await expect(a).rejects.toThrow('boom');

    // Next op must NOT block.
    const b = await withWriteLock('w1', 'BTCUSDT', async () => 'ok');
    expect(b).toBe('ok');
  });

  it('preserves FIFO order across many concurrent enqueues', async () => {
    const order: number[] = [];
    const ops = Array.from({ length: 10 }, (_, i) =>
      withWriteLock('w1', 'BTCUSDT', async () => {
        order.push(i);
        await new Promise((r) => setTimeout(r, 1));
      }),
    );
    await Promise.all(ops);
    expect(order).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});
