import { logger } from './logger';

/**
 * Serializes write mutations per (walletId, symbol) so rapid back-to-back
 * scalp ops (close + reverse + create) can't race against each other.
 *
 * Why: when the user fires "close LONG, open SHORT" in <100ms, the
 * createOrder + closeTradeExecution mutations both reach the backend
 * concurrently. They each submit to Binance, then update the DB based
 * on what they OBSERVE — but they observe pre-other-mutation state, so
 * the DB ends up reflecting whichever one wrote last (usually wrong).
 *
 * Layer also helps when an ORDER_TRADE_UPDATE is lost (reconnect gap,
 * IP ban, etc.): the queued operation runs in series, observes the
 * in-DB state, applies the next change. No event multiplexing across
 * concurrent mutations.
 *
 * Note: this is in-process only. If the backend ever runs multi-instance
 * we'd need Postgres advisory locks. For now (single-instance trading),
 * an in-memory promise chain per key suffices.
 */

type Resolver = () => void;

interface Slot {
  /** The promise the next caller should await before running. */
  tail: Promise<void>;
  /** When did this slot last unlock? Used for stale-lock cleanup. */
  lastReleasedAt: number;
}

const slots = new Map<string, Slot>();

const STALE_SLOT_TTL_MS = 60_000;

const cleanupStale = (): void => {
  // Only remove slots that have been released AT LEAST ONCE (lastReleasedAt > 0)
  // and have stayed unused past the TTL. A freshly-created slot has
  // lastReleasedAt=0 — without this guard, the cleanup would delete it
  // on the very next withWriteLock call from another caller, defeating
  // the lock entirely.
  const now = Date.now();
  for (const [key, slot] of slots) {
    if (slot.lastReleasedAt > 0 && now - slot.lastReleasedAt > STALE_SLOT_TTL_MS) {
      slots.delete(key);
    }
  }
};

/**
 * Run `fn` exclusively for this (walletId, symbol). If another op is
 * already running or queued, wait its turn before executing.
 *
 * The lock is automatically released when `fn` resolves OR throws.
 *
 * @example
 *   await withWriteLock(walletId, symbol, async () => {
 *     await submitOrder(...);
 *     await db.update(...);
 *   });
 */
export const withWriteLock = async <T>(
  walletId: string,
  symbol: string,
  fn: () => Promise<T>,
): Promise<T> => {
  const key = `${walletId}:${symbol}`;
  cleanupStale();
  const existing = slots.get(key);
  const previousTail = existing?.tail ?? Promise.resolve();

  let release: Resolver = () => undefined;
  const newTail = new Promise<void>((resolve) => {
    release = resolve;
  });

  slots.set(key, { tail: newTail, lastReleasedAt: 0 });

  await previousTail;

  const startedAt = Date.now();
  try {
    const result = await fn();
    return result;
  } finally {
    const slot = slots.get(key);
    if (slot?.tail === newTail) {
      slot.lastReleasedAt = Date.now();
    }
    release();
    const heldMs = Date.now() - startedAt;
    if (heldMs > 5_000) {
      logger.warn({ walletId, symbol, heldMs }, '[WriteOpMutex] Held lock unusually long');
    }
  }
};

export const __resetWriteOpMutexForTests = (): void => {
  slots.clear();
};
