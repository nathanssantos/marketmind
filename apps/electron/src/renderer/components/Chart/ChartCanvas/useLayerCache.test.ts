import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';

class MockOffscreenCanvas {
  width: number;
  height: number;
  private ctx: {
    clearRect: ReturnType<typeof vi.fn>;
    drawImage: ReturnType<typeof vi.fn>;
    fillRect: ReturnType<typeof vi.fn>;
  };

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.ctx = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
    };
  }

  getContext() {
    return this.ctx;
  }
}

const createMockManager = (dimensions = { width: 800, height: 600 }) => {
  const ctx = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
  };
  return {
    getDimensions: vi.fn().mockReturnValue(dimensions),
    getContext: vi.fn().mockReturnValue(ctx),
    _ctx: ctx,
  } as unknown as CanvasManager;
};

let originalOffscreenCanvas: typeof globalThis.OffscreenCanvas | undefined;

beforeAll(() => {
  originalOffscreenCanvas = globalThis.OffscreenCanvas;
  (globalThis as unknown as { OffscreenCanvas: typeof MockOffscreenCanvas }).OffscreenCanvas = MockOffscreenCanvas as unknown as typeof OffscreenCanvas;
});

afterAll(() => {
  if (originalOffscreenCanvas) {
    globalThis.OffscreenCanvas = originalOffscreenCanvas;
  } else {
    delete (globalThis as unknown as { OffscreenCanvas?: typeof OffscreenCanvas }).OffscreenCanvas;
  }
});

describe('useLayerCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should return all methods', async () => {
      const { useLayerCache } = await import('./useLayerCache');
      const manager = createMockManager();
      const { result } = renderHook(() => useLayerCache({ manager }));

      expect(result.current.renderToCache).toBeDefined();
      expect(result.current.compositeToMain).toBeDefined();
      expect(result.current.invalidateLayer).toBeDefined();
      expect(result.current.invalidateAll).toBeDefined();
      expect(result.current.isLayerValid).toBeDefined();
      expect(result.current.getLayerContext).toBeDefined();
    });

    it('should handle null manager gracefully', async () => {
      const { useLayerCache } = await import('./useLayerCache');
      const { result } = renderHook(() => useLayerCache({ manager: null }));

      expect(() => {
        result.current.renderToCache('static', vi.fn());
        result.current.compositeToMain();
        result.current.invalidateLayer('static');
        result.current.invalidateAll();
      }).not.toThrow();
    });

    it('should not render when disabled', async () => {
      const { useLayerCache } = await import('./useLayerCache');
      const manager = createMockManager();
      const { result } = renderHook(() => useLayerCache({ manager, enabled: false }));
      const renderFn = vi.fn();

      act(() => {
        result.current.renderToCache('static', renderFn);
      });

      expect(renderFn).not.toHaveBeenCalled();
    });
  });

  describe('renderToCache', () => {
    it('should call render function with offscreen context', async () => {
      const { useLayerCache } = await import('./useLayerCache');
      const manager = createMockManager();
      const { result } = renderHook(() => useLayerCache({ manager }));
      const renderFn = vi.fn();

      act(() => {
        result.current.renderToCache('static', renderFn);
      });

      expect(renderFn).toHaveBeenCalledTimes(1);
      expect(renderFn).toHaveBeenCalledWith(expect.objectContaining({
        clearRect: expect.any(Function),
      }));
    });

    it('should mark layer as valid after rendering', async () => {
      const { useLayerCache } = await import('./useLayerCache');
      const manager = createMockManager();
      const { result } = renderHook(() => useLayerCache({ manager }));

      expect(result.current.isLayerValid('static')).toBe(false);

      act(() => {
        result.current.renderToCache('static', vi.fn());
      });

      expect(result.current.isLayerValid('static')).toBe(true);
    });

    it('should render to different layers independently', async () => {
      const { useLayerCache } = await import('./useLayerCache');
      const manager = createMockManager();
      const { result } = renderHook(() => useLayerCache({ manager }));
      const staticRenderFn = vi.fn();
      const dataRenderFn = vi.fn();

      act(() => {
        result.current.renderToCache('static', staticRenderFn);
        result.current.renderToCache('data', dataRenderFn);
      });

      expect(staticRenderFn).toHaveBeenCalledTimes(1);
      expect(dataRenderFn).toHaveBeenCalledTimes(1);
      expect(result.current.isLayerValid('static')).toBe(true);
      expect(result.current.isLayerValid('data')).toBe(true);
    });
  });

  describe('invalidateLayer', () => {
    it('should mark layer as invalid', async () => {
      const { useLayerCache } = await import('./useLayerCache');
      const manager = createMockManager();
      const { result } = renderHook(() => useLayerCache({ manager }));

      act(() => {
        result.current.renderToCache('static', vi.fn());
      });
      expect(result.current.isLayerValid('static')).toBe(true);

      act(() => {
        result.current.invalidateLayer('static');
      });
      expect(result.current.isLayerValid('static')).toBe(false);
    });

    it('should not affect other layers', async () => {
      const { useLayerCache } = await import('./useLayerCache');
      const manager = createMockManager();
      const { result } = renderHook(() => useLayerCache({ manager }));

      act(() => {
        result.current.renderToCache('static', vi.fn());
        result.current.renderToCache('data', vi.fn());
        result.current.invalidateLayer('static');
      });

      expect(result.current.isLayerValid('static')).toBe(false);
      expect(result.current.isLayerValid('data')).toBe(true);
    });
  });

  describe('invalidateAll', () => {
    it('should mark all layers as invalid', async () => {
      const { useLayerCache } = await import('./useLayerCache');
      const manager = createMockManager();
      const { result } = renderHook(() => useLayerCache({ manager }));

      act(() => {
        result.current.renderToCache('static', vi.fn());
        result.current.renderToCache('data', vi.fn());
        result.current.renderToCache('indicators', vi.fn());
        result.current.renderToCache('overlays', vi.fn());
      });

      expect(result.current.isLayerValid('static')).toBe(true);
      expect(result.current.isLayerValid('data')).toBe(true);
      expect(result.current.isLayerValid('indicators')).toBe(true);
      expect(result.current.isLayerValid('overlays')).toBe(true);

      act(() => {
        result.current.invalidateAll();
      });

      expect(result.current.isLayerValid('static')).toBe(false);
      expect(result.current.isLayerValid('data')).toBe(false);
      expect(result.current.isLayerValid('indicators')).toBe(false);
      expect(result.current.isLayerValid('overlays')).toBe(false);
    });
  });

  describe('compositeToMain', () => {
    it('should composite all valid layers to main canvas', async () => {
      const { useLayerCache } = await import('./useLayerCache');
      const manager = createMockManager();
      const mainCtx = (manager.getContext() as unknown as { drawImage: ReturnType<typeof vi.fn> });
      const { result } = renderHook(() => useLayerCache({ manager }));

      act(() => {
        result.current.renderToCache('static', vi.fn());
        result.current.renderToCache('data', vi.fn());
        result.current.compositeToMain();
      });

      expect(mainCtx.drawImage).toHaveBeenCalledTimes(2);
    });

    it('should skip invalid layers during compositing', async () => {
      const { useLayerCache } = await import('./useLayerCache');
      const manager = createMockManager();
      const mainCtx = (manager.getContext() as unknown as { drawImage: ReturnType<typeof vi.fn> });
      const { result } = renderHook(() => useLayerCache({ manager }));

      act(() => {
        result.current.renderToCache('static', vi.fn());
        result.current.renderToCache('data', vi.fn());
        result.current.invalidateLayer('static');
        result.current.compositeToMain();
      });

      expect(mainCtx.drawImage).toHaveBeenCalledTimes(1);
    });

    it('should composite layers in correct order', async () => {
      const { useLayerCache } = await import('./useLayerCache');
      const manager = createMockManager();
      const drawImageCalls: number[] = [];
      const mainCtx = {
        drawImage: vi.fn().mockImplementation(() => {
          drawImageCalls.push(drawImageCalls.length);
        }),
      };
      (manager.getContext as ReturnType<typeof vi.fn>).mockReturnValue(mainCtx);
      const { result } = renderHook(() => useLayerCache({ manager }));

      act(() => {
        result.current.renderToCache('overlays', vi.fn());
        result.current.renderToCache('static', vi.fn());
        result.current.renderToCache('indicators', vi.fn());
        result.current.renderToCache('data', vi.fn());
        result.current.compositeToMain();
      });

      expect(mainCtx.drawImage).toHaveBeenCalledTimes(4);
    });
  });

  describe('getLayerContext', () => {
    it('should return layer context when available', async () => {
      const { useLayerCache } = await import('./useLayerCache');
      const manager = createMockManager();
      const { result } = renderHook(() => useLayerCache({ manager }));

      const ctx = result.current.getLayerContext('static');
      expect(ctx).toBeDefined();
      expect(ctx?.clearRect).toBeDefined();
    });

    it('should return null when disabled', async () => {
      const { useLayerCache } = await import('./useLayerCache');
      const manager = createMockManager();
      const { result } = renderHook(() => useLayerCache({ manager, enabled: false }));

      const ctx = result.current.getLayerContext('static');
      expect(ctx).toBeNull();
    });

    it('should return null when manager is null', async () => {
      const { useLayerCache } = await import('./useLayerCache');
      const { result } = renderHook(() => useLayerCache({ manager: null }));

      const ctx = result.current.getLayerContext('static');
      expect(ctx).toBeNull();
    });
  });
});

describe('shouldRerender helpers', () => {
  it('shouldRerenderStatic returns correct values', async () => {
    const { shouldRerenderStatic } = await import('./useLayerCache');
    expect(shouldRerenderStatic({ dimensions: true, all: false })).toBe(true);
    expect(shouldRerenderStatic({ dimensions: false, all: true })).toBe(true);
    expect(shouldRerenderStatic({ dimensions: false, all: false })).toBe(false);
  });

  it('shouldRerenderData returns correct values', async () => {
    const { shouldRerenderData } = await import('./useLayerCache');
    expect(shouldRerenderData({ klines: true, viewport: false, all: false })).toBe(true);
    expect(shouldRerenderData({ klines: false, viewport: true, all: false })).toBe(true);
    expect(shouldRerenderData({ klines: false, viewport: false, all: true })).toBe(true);
    expect(shouldRerenderData({ klines: false, viewport: false, all: false })).toBe(false);
  });

  it('shouldRerenderIndicators returns correct values', async () => {
    const { shouldRerenderIndicators } = await import('./useLayerCache');
    expect(shouldRerenderIndicators({ klines: true, viewport: false, all: false })).toBe(true);
    expect(shouldRerenderIndicators({ klines: false, viewport: true, all: false })).toBe(true);
    expect(shouldRerenderIndicators({ klines: false, viewport: false, all: true })).toBe(true);
  });

  it('shouldRerenderOverlays returns correct values', async () => {
    const { shouldRerenderOverlays } = await import('./useLayerCache');
    expect(shouldRerenderOverlays({ overlays: false, all: false })).toBe(false);
    expect(shouldRerenderOverlays({ overlays: true, all: false })).toBe(true);
    expect(shouldRerenderOverlays({ overlays: false, all: true })).toBe(true);
    expect(shouldRerenderOverlays({ overlays: true, all: true })).toBe(true);
  });
});
