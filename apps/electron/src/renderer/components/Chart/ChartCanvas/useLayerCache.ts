import { useCallback, useEffect, useRef } from 'react';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';

const isOffscreenCanvasSupported = (): boolean => {
  return typeof OffscreenCanvas !== 'undefined';
};

export type LayerCacheId = 'static' | 'data' | 'indicators' | 'overlays';

export interface LayerCacheEntry {
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
  lastUpdate: number;
  width: number;
  height: number;
}

export interface LayerCacheState {
  static: LayerCacheEntry | null;
  data: LayerCacheEntry | null;
  indicators: LayerCacheEntry | null;
  overlays: LayerCacheEntry | null;
}

export interface UseLayerCacheProps {
  manager: CanvasManager | null;
  enabled?: boolean;
}

export interface UseLayerCacheResult {
  renderToCache: (layerId: LayerCacheId, renderFn: (ctx: OffscreenCanvasRenderingContext2D) => void) => void;
  compositeToMain: () => void;
  invalidateLayer: (layerId: LayerCacheId) => void;
  invalidateAll: () => void;
  isLayerValid: (layerId: LayerCacheId) => boolean;
  getLayerContext: (layerId: LayerCacheId) => OffscreenCanvasRenderingContext2D | null;
}

const LAYER_ORDER: LayerCacheId[] = ['static', 'data', 'indicators', 'overlays'];

export const useLayerCache = ({
  manager,
  enabled = true,
}: UseLayerCacheProps): UseLayerCacheResult => {
  const cacheRef = useRef<LayerCacheState>({
    static: null,
    data: null,
    indicators: null,
    overlays: null,
  });
  const validityRef = useRef<Record<LayerCacheId, boolean>>({
    static: false,
    data: false,
    indicators: false,
    overlays: false,
  });

  const ensureCache = useCallback((layerId: LayerCacheId, width: number, height: number): LayerCacheEntry | null => {
    if (width <= 0 || height <= 0) return null;
    if (!isOffscreenCanvasSupported()) return null;

    const existing = cacheRef.current[layerId];
    if (existing && existing.width === width && existing.height === height) {
      return existing;
    }

    if (existing) {
      existing.canvas.width = width;
      existing.canvas.height = height;
      existing.width = width;
      existing.height = height;
      validityRef.current[layerId] = false;
      return existing;
    }

    try {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const entry: LayerCacheEntry = {
        canvas,
        ctx,
        lastUpdate: 0,
        width,
        height,
      };
      cacheRef.current[layerId] = entry;
      validityRef.current[layerId] = false;
      return entry;
    } catch {
      return null;
    }
  }, []);

  const renderToCache = useCallback((
    layerId: LayerCacheId,
    renderFn: (ctx: OffscreenCanvasRenderingContext2D) => void
  ) => {
    if (!enabled || !manager) return;

    const dimensions = manager.getDimensions();
    if (!dimensions) return;

    const entry = ensureCache(layerId, dimensions.width, dimensions.height);
    if (!entry) return;

    entry.ctx.clearRect(0, 0, entry.width, entry.height);
    renderFn(entry.ctx);
    entry.lastUpdate = performance.now();
    validityRef.current[layerId] = true;
  }, [enabled, manager, ensureCache]);

  const compositeToMain = useCallback(() => {
    if (!manager) return;

    const mainCtx = manager.getContext();
    if (!mainCtx) return;

    for (const layerId of LAYER_ORDER) {
      const entry = cacheRef.current[layerId];
      if (entry && validityRef.current[layerId]) {
        mainCtx.drawImage(entry.canvas, 0, 0);
      }
    }
  }, [manager]);

  const invalidateLayer = useCallback((layerId: LayerCacheId) => {
    validityRef.current[layerId] = false;
  }, []);

  const invalidateAll = useCallback(() => {
    validityRef.current = {
      static: false,
      data: false,
      indicators: false,
      overlays: false,
    };
  }, []);

  const isLayerValid = useCallback((layerId: LayerCacheId): boolean => {
    return validityRef.current[layerId];
  }, []);

  const getLayerContext = useCallback((layerId: LayerCacheId): OffscreenCanvasRenderingContext2D | null => {
    if (!enabled || !manager) return null;

    const dimensions = manager.getDimensions();
    if (!dimensions) return null;

    const entry = ensureCache(layerId, dimensions.width, dimensions.height);
    return entry?.ctx ?? null;
  }, [enabled, manager, ensureCache]);

  useEffect(() => {
    return () => {
      cacheRef.current = {
        static: null,
        data: null,
        indicators: null,
        overlays: null,
      };
    };
  }, []);

  useEffect(() => {
    if (!manager) return;

    const handleDimensionChange = () => {
      invalidateAll();
    };

    const dimensions = manager.getDimensions();
    if (dimensions) {
      for (const layerId of LAYER_ORDER) {
        ensureCache(layerId, dimensions.width, dimensions.height);
      }
    }

    return () => {
      handleDimensionChange;
    };
  }, [manager, invalidateAll, ensureCache]);

  return {
    renderToCache,
    compositeToMain,
    invalidateLayer,
    invalidateAll,
    isLayerValid,
    getLayerContext,
  };
};

export const shouldRerenderStatic = (dirtyFlags: { dimensions: boolean; all: boolean }): boolean => {
  return dirtyFlags.dimensions || dirtyFlags.all;
};

export const shouldRerenderData = (dirtyFlags: { klines: boolean; viewport: boolean; all: boolean }): boolean => {
  return dirtyFlags.klines || dirtyFlags.viewport || dirtyFlags.all;
};

export const shouldRerenderIndicators = (dirtyFlags: { klines: boolean; viewport: boolean; all: boolean }): boolean => {
  return dirtyFlags.klines || dirtyFlags.viewport || dirtyFlags.all;
};

export const shouldRerenderOverlays = (_dirtyFlags: { overlays: boolean; all: boolean }): boolean => {
  return true;
};
