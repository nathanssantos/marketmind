import type { Kline, Viewport } from '@marketmind/types';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CanvasManager } from './CanvasManager';

const mkKline = (i: number): Kline => ({
  openTime: 1_700_000_000_000 + i * 60_000,
  closeTime: 1_700_000_000_000 + i * 60_000 + 60_000,
  open: '100',
  high: '105',
  low: '95',
  close: '102',
  volume: '1000',
  quoteVolume: '0',
  trades: 10,
  takerBuyBaseVolume: '0',
  takerBuyQuoteVolume: '0',
});

const buildKlines = (n: number): Kline[] => Array.from({ length: n }, (_, i) => mkKline(i));

const viewport: Viewport = {
  start: 0,
  end: 100,
  klineWidth: 8,
  klineSpacing: 2,
  width: 1000,
  height: 600,
  priceMin: 0,
  priceMax: 0,
};

const mountManager = (): { canvas: HTMLCanvasElement; manager: CanvasManager } => {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 600;
  canvas.style.width = '1000px';
  canvas.style.height = '600px';
  document.body.appendChild(canvas);
  const manager = new CanvasManager(canvas, { ...viewport }, 40);
  return { canvas, manager };
};

describe('CanvasManager lifecycle — real browser', () => {
  let NativeResizeObserver: typeof ResizeObserver;
  let disconnectSpy: ReturnType<typeof vi.fn>;
  let observeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    NativeResizeObserver = window.ResizeObserver;
    disconnectSpy = vi.fn();
    observeSpy = vi.fn();
    class SpyResizeObserver {
      private cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
      }
      observe = (target: Element, options?: ResizeObserverOptions): void => {
        observeSpy(target, options);
      };
      unobserve = (_target: Element): void => {};
      disconnect = (): void => {
        disconnectSpy();
      };
    }
    (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
      SpyResizeObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = NativeResizeObserver;
    if (globalThis.__canvasManagerInstances) globalThis.__canvasManagerInstances.clear();
    for (const node of Array.from(document.body.childNodes)) {
      document.body.removeChild(node);
    }
  });

  test('destroy disconnects the ResizeObserver', () => {
    const { manager } = mountManager();
    expect(observeSpy).toHaveBeenCalledTimes(1);
    expect(disconnectSpy).not.toHaveBeenCalled();
    manager.destroy();
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  test('destroy removes instance from the global registry', () => {
    const { manager } = mountManager();
    expect(globalThis.__canvasManagerInstances?.has(manager)).toBe(true);
    manager.destroy();
    expect(globalThis.__canvasManagerInstances?.has(manager)).toBe(false);
  });

  test('destroy cancels a pending render frame', () => {
    const { manager } = mountManager();
    manager.setKlines(buildKlines(50));
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
    manager.setRenderCallback(() => {});
    manager.markDirty('all');
    manager.destroy();
    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
  });

  test('repeated mount/destroy cycles leave no residual instances or observers', () => {
    const CYCLES = 20;
    for (let i = 0; i < CYCLES; i += 1) {
      const { manager, canvas } = mountManager();
      manager.setKlines(buildKlines(50));
      manager.setRenderCallback(() => {});
      manager.destroy();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
    expect(globalThis.__canvasManagerInstances?.size ?? 0).toBe(0);
    expect(observeSpy).toHaveBeenCalledTimes(CYCLES);
    expect(disconnectSpy).toHaveBeenCalledTimes(CYCLES);
  });

  test('destroy clears klines, bounds, and dimensions', () => {
    const { manager } = mountManager();
    manager.setKlines(buildKlines(50));
    expect(manager.getKlines().length).toBeGreaterThan(0);
    manager.destroy();
    expect(manager.getKlines()).toEqual([]);
    expect(manager.getBounds()).toBeNull();
    expect(manager.getDimensions()).toBeNull();
    expect(manager.getContext()).toBeNull();
  });

  test('destroy nulls the renderCallback so no further paints happen', () => {
    const { manager } = mountManager();
    const cb = vi.fn();
    manager.setRenderCallback(cb);
    manager.destroy();
    manager.markDirty('all');
    expect(cb).not.toHaveBeenCalled();
  });
});
