import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Kline, Viewport } from '@marketmind/types';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { ChartColors } from '@renderer/hooks/useChartColors';
import { useLayerCache, type LayerCacheId } from './useLayerCache';
import { useVirtualizedKlines } from './useVirtualizedKlines';
import { useRenderLoop, type RenderLoopStats } from './useRenderLoop';
import { useTouchGestures } from './useTouchGestures';
import { useKeyboardNavigation } from './useKeyboardNavigation';
import {
  createBackgroundLayer,
  createDataLayer,
  type IndicatorRenderFunctions,
  type OverlayRenderFunctions,
} from './layers';

export interface UseOptimizedRenderingProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  manager: CanvasManager | null;
  klines: Kline[];
  colors: ChartColors;
  chartType: 'kline' | 'line';
  showGrid: boolean;
  showVolume: boolean;
  symbol?: string;
  marketType?: string;
  timeframe?: string;
  highlightedCandles?: Set<number>;
  indicatorRenderFunctions: IndicatorRenderFunctions;
  overlayRenderFunctions: OverlayRenderFunctions;
  enableLayerCache?: boolean;
  enableVirtualization?: boolean;
  enableTouchGestures?: boolean;
  enableKeyboardNavigation?: boolean;
  targetFPS?: number;
  onViewportChange?: () => void;
  onStatsUpdate?: (stats: RenderLoopStats) => void;
}

export interface UseOptimizedRenderingResult {
  requestRender: () => void;
  invalidateLayer: (layerId: LayerCacheId) => void;
  invalidateAll: () => void;
  focusCanvas: () => void;
  isTouching: boolean;
  stats: () => RenderLoopStats;
  virtualizedKlinesCount: number;
}

export const useOptimizedRendering = ({
  canvasRef,
  manager,
  klines,
  colors,
  chartType,
  showGrid,
  showVolume,
  symbol,
  marketType,
  timeframe,
  highlightedCandles,
  indicatorRenderFunctions,
  overlayRenderFunctions,
  enableLayerCache = true,
  enableVirtualization = true,
  enableTouchGestures = true,
  enableKeyboardNavigation = true,
  targetFPS = 60,
  onViewportChange,
  onStatsUpdate,
}: UseOptimizedRenderingProps): UseOptimizedRenderingResult => {
  const lastViewportRef = useRef<Viewport | null>(null);

  const viewport = useMemo((): Viewport => {
    if (!manager) return { start: 0, end: 100, klineWidth: 10, klineSpacing: 2, width: 800, height: 600, priceMin: 0, priceMax: 100 };
    return manager.getViewport();
  }, [manager]);

  const {
    renderToCache,
    compositeToMain,
    invalidateLayer,
    invalidateAll,
    isLayerValid,
  } = useLayerCache({
    manager,
    enabled: enableLayerCache,
  });

  const { visibleKlines, startIndex } = useVirtualizedKlines({
    klines,
    viewport,
    buffer: 50,
    enabled: enableVirtualization,
  });

  const { isTouching } = useTouchGestures({
    canvasRef,
    manager,
    enabled: enableTouchGestures,
    onViewportChange,
  });

  const { focusCanvas } = useKeyboardNavigation({
    canvasRef,
    manager,
    enabled: enableKeyboardNavigation,
    onViewportChange,
  });

  const backgroundLayer = useMemo(() => createBackgroundLayer({
    manager,
    colors,
    showGrid,
    symbol,
    marketType,
    timeframe,
  }), [manager, colors, showGrid, symbol, marketType, timeframe]);

  const dataLayer = useMemo(() => createDataLayer({
    manager,
    colors,
    klines: enableVirtualization ? visibleKlines : klines,
    viewport,
    chartType,
    showVolume,
    highlightedCandles,
    virtualizedData: enableVirtualization ? {
      visibleKlines,
      startIndex,
      endIndex: startIndex + visibleKlines.length,
      totalCount: klines.length,
      isBuffered: true,
    } : undefined,
  }), [manager, colors, klines, visibleKlines, viewport, chartType, showVolume, highlightedCandles, enableVirtualization, startIndex]);

  const renderFrame = useCallback(() => {
    if (!manager) return;

    const ctx = manager.getContext();
    if (!ctx) return;

    const currentViewport = manager.getViewport();
    const viewportChanged = !lastViewportRef.current ||
      lastViewportRef.current.start !== currentViewport.start ||
      lastViewportRef.current.end !== currentViewport.end ||
      lastViewportRef.current.klineWidth !== currentViewport.klineWidth;

    if (viewportChanged) {
      lastViewportRef.current = { ...currentViewport };
      invalidateLayer('data');
      invalidateLayer('indicators');
    }

    manager.clear();

    if (enableLayerCache) {
      if (!isLayerValid('static')) {
        renderToCache('static', (cacheCtx) => {
          backgroundLayer.render(cacheCtx);
        });
      }

      if (!isLayerValid('data')) {
        renderToCache('data', (cacheCtx) => {
          dataLayer.render(cacheCtx);
        });
      }

      if (!isLayerValid('indicators')) {
        renderToCache('indicators', () => {
          Object.values(indicatorRenderFunctions).forEach(fn => fn?.());
        });
      }

      compositeToMain();

      Object.values(overlayRenderFunctions).forEach(fn => fn?.());
    } else {
      backgroundLayer.render(ctx);
      dataLayer.render(ctx);
      Object.values(indicatorRenderFunctions).forEach(fn => fn?.());
      Object.values(overlayRenderFunctions).forEach(fn => fn?.());
    }

    manager.clearDirtyFlags();
  }, [
    manager,
    enableLayerCache,
    backgroundLayer,
    dataLayer,
    indicatorRenderFunctions,
    overlayRenderFunctions,
    renderToCache,
    compositeToMain,
    isLayerValid,
    invalidateLayer,
  ]);

  const { requestRender, getStats } = useRenderLoop({
    onRender: renderFrame,
    targetFPS,
    enabled: !!manager,
    onStatsUpdate,
  });

  useEffect(() => {
    invalidateLayer('data');
    invalidateLayer('indicators');
    requestRender();
  }, [klines]);

  useEffect(() => {
    invalidateAll();
    requestRender();
  }, [colors, chartType, showGrid, showVolume]);

  useEffect(() => {
    if (!manager) return;

    manager.setRenderCallback(() => {
      requestRender();
    });

    return () => {
      manager.setRenderCallback(null);
    };
  }, [manager, requestRender]);

  return {
    requestRender,
    invalidateLayer,
    invalidateAll,
    focusCanvas,
    isTouching,
    stats: getStats,
    virtualizedKlinesCount: visibleKlines.length,
  };
};
