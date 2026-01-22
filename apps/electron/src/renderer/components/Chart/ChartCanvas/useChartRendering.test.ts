import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayerDirtyTracking, useOffscreenCache } from './useChartRendering';

describe('useLayerDirtyTracking', () => {
  it('should initialize all layers as dirty', () => {
    const { result } = renderHook(() => useLayerDirtyTracking());

    expect(result.current.isDirty('background')).toBe(true);
    expect(result.current.isDirty('grid')).toBe(true);
    expect(result.current.isDirty('volume')).toBe(true);
    expect(result.current.isDirty('klines')).toBe(true);
    expect(result.current.isDirty('indicators')).toBe(true);
    expect(result.current.isDirty('overlays')).toBe(true);
    expect(result.current.isDirty('panels')).toBe(true);
    expect(result.current.isDirty('interaction')).toBe(true);
    expect(result.current.anyDirty()).toBe(true);
  });

  it('should mark specific layer as clean', () => {
    const { result } = renderHook(() => useLayerDirtyTracking());

    act(() => {
      result.current.markClean('grid');
    });

    expect(result.current.isDirty('grid')).toBe(false);
    expect(result.current.isDirty('klines')).toBe(true);
  });

  it('should mark all layers as clean', () => {
    const { result } = renderHook(() => useLayerDirtyTracking());

    act(() => {
      result.current.markAllClean();
    });

    expect(result.current.isDirty('background')).toBe(false);
    expect(result.current.isDirty('grid')).toBe(false);
    expect(result.current.isDirty('klines')).toBe(false);
    expect(result.current.anyDirty()).toBe(false);
  });

  it('should mark specific layer as dirty', () => {
    const { result } = renderHook(() => useLayerDirtyTracking());

    act(() => {
      result.current.markAllClean();
    });

    expect(result.current.anyDirty()).toBe(false);

    act(() => {
      result.current.markDirty('klines');
    });

    expect(result.current.isDirty('klines')).toBe(true);
    expect(result.current.isDirty('grid')).toBe(false);
    expect(result.current.anyDirty()).toBe(true);
  });

  it('should mark all layers as dirty', () => {
    const { result } = renderHook(() => useLayerDirtyTracking());

    act(() => {
      result.current.markAllClean();
    });

    expect(result.current.anyDirty()).toBe(false);

    act(() => {
      result.current.markAllDirty();
    });

    expect(result.current.isDirty('background')).toBe(true);
    expect(result.current.isDirty('grid')).toBe(true);
    expect(result.current.isDirty('klines')).toBe(true);
    expect(result.current.anyDirty()).toBe(true);
  });
});

describe('useOffscreenCache', () => {
  const originalOffscreenCanvas = globalThis.OffscreenCanvas;

  class MockOffscreenCanvas {
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
    getContext() {
      return {
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        drawImage: vi.fn(),
      };
    }
  }

  beforeEach(() => {
    (globalThis as unknown as Record<string, unknown>).OffscreenCanvas = MockOffscreenCanvas;
  });

  afterEach(() => {
    (globalThis as unknown as Record<string, unknown>).OffscreenCanvas = originalOffscreenCanvas;
  });

  it('should return null for invalid dimensions', () => {
    const { result } = renderHook(() => useOffscreenCache(0, 0));

    const entry = result.current.getOrCreate('test');
    expect(entry).toBeNull();
  });

  it('should create offscreen canvas for valid dimensions', () => {
    const { result } = renderHook(() => useOffscreenCache(800, 600));

    const entry = result.current.getOrCreate('test');
    expect(entry).not.toBeNull();
    expect(entry?.canvas.width).toBe(800);
    expect(entry?.canvas.height).toBe(600);
  });

  it('should return cached entry on subsequent calls', () => {
    const { result } = renderHook(() => useOffscreenCache(800, 600));

    const entry1 = result.current.getOrCreate('test');
    const entry2 = result.current.getOrCreate('test');

    expect(entry1).toBe(entry2);
  });

  it('should resize cached canvas when dimensions change', () => {
    const { result, rerender } = renderHook(
      ({ width, height }) => useOffscreenCache(width, height),
      { initialProps: { width: 800, height: 600 } }
    );

    const entry1 = result.current.getOrCreate('test');
    expect(entry1?.canvas.width).toBe(800);

    rerender({ width: 1000, height: 800 });

    const entry2 = result.current.getOrCreate('test');
    expect(entry2?.canvas.width).toBe(1000);
    expect(entry2?.canvas.height).toBe(800);
  });

  it('should invalidate specific cache entry', () => {
    const { result } = renderHook(() => useOffscreenCache(800, 600));

    const entry1 = result.current.getOrCreate('test');
    expect(entry1).not.toBeNull();

    act(() => {
      result.current.invalidate('test');
    });

    const entry2 = result.current.getOrCreate('test');
    expect(entry2).not.toBe(entry1);
  });

  it('should invalidate all cache entries', () => {
    const { result } = renderHook(() => useOffscreenCache(800, 600));

    const entry1 = result.current.getOrCreate('test1');
    const entry2 = result.current.getOrCreate('test2');
    expect(entry1).not.toBeNull();
    expect(entry2).not.toBeNull();

    act(() => {
      result.current.invalidateAll();
    });

    const newEntry1 = result.current.getOrCreate('test1');
    const newEntry2 = result.current.getOrCreate('test2');
    expect(newEntry1).not.toBe(entry1);
    expect(newEntry2).not.toBe(entry2);
  });
});
