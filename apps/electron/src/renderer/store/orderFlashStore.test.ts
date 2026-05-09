import { afterEach, describe, expect, it, vi } from 'vitest';
import { useOrderFlashStore } from './orderFlashStore';

describe('orderFlashStore', () => {
  afterEach(() => {
    // Reset state between tests since the store is module-singleton.
    const { flashes } = useOrderFlashStore.getState();
    flashes.clear();
  });

  it('flashOrder records the timestamp and exposes it via getFlashTime', () => {
    const before = performance.now();
    useOrderFlashStore.getState().flashOrder('order-1');
    const t = useOrderFlashStore.getState().getFlashTime('order-1');
    expect(t).toBeDefined();
    expect(t!).toBeGreaterThanOrEqual(before);
  });

  it('keeps the underlying Map identity stable across mutations (no per-write allocation)', () => {
    const initialMapRef = useOrderFlashStore.getState().flashes;
    useOrderFlashStore.getState().flashOrder('order-1');
    useOrderFlashStore.getState().flashOrder('order-2');
    useOrderFlashStore.getState().clearFlash('order-1');
    expect(useOrderFlashStore.getState().flashes).toBe(initialMapRef);
  });

  it('notifies subscribers on flashOrder and clearFlash', () => {
    const listener = vi.fn();
    const unsub = useOrderFlashStore.subscribe(listener);
    useOrderFlashStore.getState().flashOrder('a');
    expect(listener).toHaveBeenCalledTimes(1);
    useOrderFlashStore.getState().clearFlash('a');
    expect(listener).toHaveBeenCalledTimes(2);
    unsub();
  });

  it('does NOT notify on clearFlash for an id that was never flashed', () => {
    const listener = vi.fn();
    const unsub = useOrderFlashStore.subscribe(listener);
    useOrderFlashStore.getState().clearFlash('never-flashed');
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });

  it('subscribers see the live Map reference in the state arg', () => {
    let captured: Map<string, number> | null = null;
    const unsub = useOrderFlashStore.subscribe((state) => {
      captured = state.flashes;
    });
    useOrderFlashStore.getState().flashOrder('x');
    expect(captured).toBe(useOrderFlashStore.getState().flashes);
    expect(captured!.get('x')).toBeDefined();
    unsub();
  });

  it('unsubscribe stops further notifications', () => {
    const listener = vi.fn();
    const unsub = useOrderFlashStore.subscribe(listener);
    useOrderFlashStore.getState().flashOrder('a');
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
    useOrderFlashStore.getState().flashOrder('b');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
