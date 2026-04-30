import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { perfMonitor } from '@renderer/utils/canvas/perfMonitor';
import { useDialogMount } from './useDialogMount';

const FLAG_KEY = 'chart.perf';

const createLocalStorageMock = () => {
  const store: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (idx: number) => Object.keys(store)[idx] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
};

let nowValue = 0;

describe('useDialogMount', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    localStorage.setItem(FLAG_KEY, '1');
    nowValue = 0;
    vi.stubGlobal('performance', { now: () => nowValue });
    perfMonitor.refreshFlag();
    perfMonitor.reset();
  });

  afterEach(() => {
    perfMonitor.reset();
    vi.unstubAllGlobals();
  });

  it('records a mount sample on first open', () => {
    nowValue = 0;
    const { rerender } = renderHook(
      ({ open }: { open: boolean }) => useDialogMount('TestDialog', open),
      { initialProps: { open: false } },
    );
    nowValue = 0;
    rerender({ open: true });
    // Effect ran with same now value (0), then we advance and trigger another
    // render so any subsequent read sees a different clock. The recorded sample
    // is captured the moment the effect runs; advancing clock here only affects
    // future opens.
    const stat = perfMonitor.getSnapshot().dialogMounts.find((d) => d.name === 'TestDialog');
    expect(stat?.opens).toBe(1);
    expect(stat?.lastMs).toBe(0);
  });

  it('measures elapsed time between body capture and effect commit', () => {
    // Auto-advance the clock 25ms on every read so the body's read and the
    // effect's read see different timestamps.
    let clock = 0;
    vi.stubGlobal('performance', { now: () => { const v = clock; clock += 25; return v; } });

    const { rerender } = renderHook(
      ({ open }: { open: boolean }) => useDialogMount('TestDialog', open),
      { initialProps: { open: false } },
    );
    rerender({ open: true });

    const stat = perfMonitor.getSnapshot().dialogMounts.find((d) => d.name === 'TestDialog');
    expect(stat?.opens).toBe(1);
    expect(stat?.lastMs).toBe(25);
  });

  it('records a second sample after close → reopen', () => {
    let clock = 0;
    vi.stubGlobal('performance', { now: () => { const v = clock; clock += 7; return v; } });

    const { rerender } = renderHook(
      ({ open }: { open: boolean }) => useDialogMount('TestDialog', open),
      { initialProps: { open: false } },
    );
    rerender({ open: true });
    rerender({ open: false });
    rerender({ open: true });

    const stat = perfMonitor.getSnapshot().dialogMounts.find((d) => d.name === 'TestDialog');
    expect(stat?.opens).toBe(2);
  });

  it('does not record when dialog never opens', () => {
    renderHook(
      ({ open }: { open: boolean }) => useDialogMount('TestDialog', open),
      { initialProps: { open: false } },
    );
    expect(perfMonitor.getSnapshot().dialogMounts).toHaveLength(0);
  });

  it('skips when perfMonitor is disabled even if isOpen', () => {
    localStorage.removeItem(FLAG_KEY);
    perfMonitor.refreshFlag();
    renderHook(() => useDialogMount('TestDialog', true));
    expect(perfMonitor.getSnapshot().dialogMounts).toHaveLength(0);
  });
});
