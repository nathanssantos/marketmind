import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { perfMonitor } from './perfMonitor';

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

describe('perfMonitor', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    localStorage.setItem(FLAG_KEY, '1');
    perfMonitor.refreshFlag();
    perfMonitor.reset();
  });

  afterEach(() => {
    perfMonitor.reset();
    vi.unstubAllGlobals();
  });

  it('is disabled by default without the flag', () => {
    localStorage.removeItem(FLAG_KEY);
    perfMonitor.refreshFlag();
    expect(perfMonitor.isEnabled()).toBe(false);
    expect(perfMonitor.beginFrame()).toBe(0);
    expect(perfMonitor.mark()).toBe(0);
    perfMonitor.recordComponentRender('X');
    expect(perfMonitor.getSnapshot().componentRenders).toHaveLength(0);
  });

  it('increments droppedFrames when frame exceeds 33ms', () => {
    const perf = performance as Performance & { now: () => number };
    const spy = vi.spyOn(perf, 'now');
    spy.mockReturnValueOnce(0);
    const startA = perfMonitor.beginFrame();
    spy.mockReturnValueOnce(10);
    perfMonitor.endFrame(startA);

    spy.mockReturnValueOnce(1000);
    const startB = perfMonitor.beginFrame();
    spy.mockReturnValueOnce(1050);
    perfMonitor.endFrame(startB);

    spy.mockReturnValueOnce(2000);
    const snap = perfMonitor.getSnapshot();
    expect(snap.droppedFrames).toBe(1);
    spy.mockRestore();
  });

  it('pushes sections that exceed 20ms into longSections ring buffer', () => {
    const perf = performance as Performance & { now: () => number };
    const spy = vi.spyOn(perf, 'now');

    spy.mockReturnValueOnce(0);
    const startFast = perfMonitor.mark();
    spy.mockReturnValueOnce(5);
    perfMonitor.measure('fast', startFast);

    spy.mockReturnValueOnce(100);
    const startSlow = perfMonitor.mark();
    spy.mockReturnValueOnce(150);
    perfMonitor.measure('slow', startSlow);

    spy.mockReturnValue(200);
    const snap = perfMonitor.getSnapshot();
    expect(snap.longSections).toHaveLength(1);
    expect(snap.longSections[0]?.name).toBe('slow');
    expect(snap.longSections[0]?.ms).toBe(50);
    spy.mockRestore();
  });

  it('ring-buffers longSections at cap 20', () => {
    const perf = performance as Performance & { now: () => number };
    const spy = vi.spyOn(perf, 'now');

    for (let i = 0; i < 25; i += 1) {
      spy.mockReturnValueOnce(i * 100);
      const start = perfMonitor.mark();
      spy.mockReturnValueOnce(i * 100 + 50);
      perfMonitor.measure(`section-${i}`, start);
    }

    spy.mockReturnValue(3000);
    const snap = perfMonitor.getSnapshot();
    expect(snap.longSections).toHaveLength(20);
    expect(snap.longSections[0]?.name).toBe('section-5');
    expect(snap.longSections[19]?.name).toBe('section-24');
    spy.mockRestore();
  });

  it('records component renders and reports rate', () => {
    const perf = performance as Performance & { now: () => number };
    const spy = vi.spyOn(perf, 'now');
    spy.mockReturnValue(100);
    perfMonitor.recordComponentRender('Portfolio');
    perfMonitor.recordComponentRender('Portfolio');
    perfMonitor.recordComponentRender('OrdersList');
    spy.mockReturnValue(200);
    const snap = perfMonitor.getSnapshot();
    const names = snap.componentRenders.map((c) => c.name);
    expect(names).toContain('Portfolio');
    expect(names).toContain('OrdersList');
    spy.mockRestore();
  });

  it('records dialog mount times and exposes lastMs/avgMs/maxMs', () => {
    perfMonitor.recordDialogMount('Settings', 12);
    perfMonitor.recordDialogMount('Settings', 30);
    perfMonitor.recordDialogMount('Backtest', 7);
    const snap = perfMonitor.getSnapshot();
    expect(snap.dialogMounts).toHaveLength(2);
    const settings = snap.dialogMounts.find((d) => d.name === 'Settings')!;
    expect(settings.opens).toBe(2);
    expect(settings.lastMs).toBe(30);
    expect(settings.maxMs).toBe(30);
    expect(settings.avgMs).toBe(21);
    expect(snap.dialogMounts[0]!.name).toBe('Settings');
  });

  it('skips dialog mounts when disabled', () => {
    localStorage.removeItem(FLAG_KEY);
    perfMonitor.refreshFlag();
    perfMonitor.recordDialogMount('Settings', 99);
    expect(perfMonitor.getSnapshot().dialogMounts).toHaveLength(0);
  });

  it('clears dialog mounts on reset', () => {
    perfMonitor.recordDialogMount('Settings', 12);
    perfMonitor.reset();
    expect(perfMonitor.getSnapshot().dialogMounts).toHaveLength(0);
  });

  it('exposes window.__mmPerf', () => {
    expect((window as unknown as { __mmPerf: typeof perfMonitor }).__mmPerf).toBe(perfMonitor);
  });

  it('clears state on reset', () => {
    const perf = performance as Performance & { now: () => number };
    const spy = vi.spyOn(perf, 'now');
    spy.mockReturnValueOnce(0);
    const start = perfMonitor.mark();
    spy.mockReturnValueOnce(50);
    perfMonitor.measure('heavy', start);
    spy.mockReturnValue(100);
    expect(perfMonitor.getSnapshot().longSections.length).toBe(1);

    perfMonitor.reset();
    expect(perfMonitor.getSnapshot().longSections).toHaveLength(0);
    expect(perfMonitor.getSnapshot().droppedFrames).toBe(0);
    spy.mockRestore();
  });
});
