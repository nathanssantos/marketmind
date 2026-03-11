import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { AdvancedControlsConfig } from '../AdvancedControls';
import type { MovingAverageConfig } from '../useMovingAverageRenderer';
import type { BackendExecution } from '../useOrderLinesRenderer';
import type { UseChartIndicatorsResult } from './useChartIndicators';
import type { TooltipData, OrderPreview } from './useChartState';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { calculateMovingAverage } from '@marketmind/indicators';
import type { Kline, MarketEvent, Order, MarketType } from '@marketmind/types';
import type { StochasticResult } from '@marketmind/indicators';

export type RenderLayerId =
  | 'background'
  | 'grid'
  | 'volume'
  | 'klines'
  | 'indicators'
  | 'overlays'
  | 'panels'
  | 'interaction';

export interface RenderLayer {
  id: RenderLayerId;
  zIndex: number;
  render: () => void;
  shouldRender: () => boolean;
}

export interface UseChartRenderingProps {
  manager: CanvasManager | null;
  colors: ChartThemeColors;
  klines: Kline[];
  chartType: 'kline' | 'line';
  advancedConfig?: AdvancedControlsConfig;
  movingAverages: MovingAverageConfig[];
  showGrid: boolean;
  showVolume: boolean;
  showStochastic: boolean;
  showRSI: boolean;
  showBollingerBands: boolean;
  showATR: boolean;
  showVWAP: boolean;
  showCurrentPriceLine: boolean;
  showFibonacciProjection: boolean;
  showEventRow: boolean;
  timeframe: string;
  symbol?: string;
  marketType?: MarketType;
  indicatorData: UseChartIndicatorsResult;
  stochasticData: StochasticResult | null;
  marketEvents: MarketEvent[];
  orders?: Order[];
  backendExecutions: BackendExecution[];
  tooltipData: TooltipData;
  orderPreviewRef: React.MutableRefObject<OrderPreview | null>;
  hoveredMAIndexRef: React.MutableRefObject<number | undefined>;
  highlightedCandlesRef: React.MutableRefObject<number[]>;
  isAutoTradingActive: boolean;
  orderDragHandler: {
    isDragging: boolean;
    draggedOrder: Order | null;
    dragType: string | null;
    previewPrice: number | null;
  };
  currentPriceRef: React.MutableRefObject<number>;
}

export interface UseChartRenderingResult {
  renderAll: () => void;
  renderLayer: (layerId: RenderLayerId) => void;
  maValuesCache: Map<string, (number | null)[]>;
}

export const useChartRendering = (props: UseChartRenderingProps): UseChartRenderingResult => {
  const { manager, klines, movingAverages } = props;

  const lastRenderTimeRef = useRef<Record<RenderLayerId, number>>({
    background: 0,
    grid: 0,
    volume: 0,
    klines: 0,
    indicators: 0,
    overlays: 0,
    panels: 0,
    interaction: 0,
  });

  const maValuesCache = useMemo(() => {
    const cache = new Map<string, (number | null)[]>();
    for (const ma of movingAverages) {
      if (ma.visible === false) continue;
      const key = `${ma.type}-${ma.period}`;
      cache.set(key, calculateMovingAverage(klines, ma.period, ma.type));
    }
    return cache;
  }, [klines, movingAverages]);

  const renderAll = useCallback(() => {
    if (!manager) return;

    const now = performance.now();
    lastRenderTimeRef.current = {
      background: now,
      grid: now,
      volume: now,
      klines: now,
      indicators: now,
      overlays: now,
      panels: now,
      interaction: now,
    };
  }, [manager]);

  const renderLayer = useCallback(
    (layerId: RenderLayerId) => {
      if (!manager) return;
      lastRenderTimeRef.current[layerId] = performance.now();
    },
    [manager]
  );

  return {
    renderAll,
    renderLayer,
    maValuesCache,
  };
};

export interface LayerDirtyState {
  background: boolean;
  grid: boolean;
  volume: boolean;
  klines: boolean;
  indicators: boolean;
  overlays: boolean;
  panels: boolean;
  interaction: boolean;
}

export const useLayerDirtyTracking = () => {
  const dirtyRef = useRef<LayerDirtyState>({
    background: true,
    grid: true,
    volume: true,
    klines: true,
    indicators: true,
    overlays: true,
    panels: true,
    interaction: true,
  });

  const markDirty = useCallback((layer: RenderLayerId) => {
    dirtyRef.current[layer] = true;
  }, []);

  const markAllDirty = useCallback(() => {
    dirtyRef.current = {
      background: true,
      grid: true,
      volume: true,
      klines: true,
      indicators: true,
      overlays: true,
      panels: true,
      interaction: true,
    };
  }, []);

  const markClean = useCallback((layer: RenderLayerId) => {
    dirtyRef.current[layer] = false;
  }, []);

  const markAllClean = useCallback(() => {
    dirtyRef.current = {
      background: false,
      grid: false,
      volume: false,
      klines: false,
      indicators: false,
      overlays: false,
      panels: false,
      interaction: false,
    };
  }, []);

  const isDirty = useCallback((layer: RenderLayerId) => dirtyRef.current[layer], []);

  const anyDirty = useCallback(
    () => Object.values(dirtyRef.current).some(Boolean),
    []
  );

  return {
    markDirty,
    markAllDirty,
    markClean,
    markAllClean,
    isDirty,
    anyDirty,
    dirtyState: dirtyRef,
  };
};

export interface OffscreenCacheEntry {
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
  lastUpdate: number;
}

export const useOffscreenCache = (width: number, height: number) => {
  const cacheRef = useRef<Map<string, OffscreenCacheEntry>>(new Map());

  const getOrCreate = useCallback(
    (key: string): OffscreenCacheEntry | null => {
      if (width <= 0 || height <= 0) return null;

      const existing = cacheRef.current.get(key);
      if (existing) {
        if (existing.canvas.width !== width || existing.canvas.height !== height) {
          existing.canvas.width = width;
          existing.canvas.height = height;
        }
        return existing;
      }

      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const entry: OffscreenCacheEntry = {
        canvas,
        ctx,
        lastUpdate: 0,
      };
      cacheRef.current.set(key, entry);
      return entry;
    },
    [width, height]
  );

  const invalidate = useCallback((key: string) => {
    cacheRef.current.delete(key);
  }, []);

  const invalidateAll = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  const drawToMain = useCallback(
    (key: string, mainCtx: CanvasRenderingContext2D, dx = 0, dy = 0) => {
      const entry = cacheRef.current.get(key);
      if (!entry) return false;
      mainCtx.drawImage(entry.canvas, dx, dy);
      return true;
    },
    []
  );

  useEffect(() => {
    return () => {
      cacheRef.current.clear();
    };
  }, []);

  return {
    getOrCreate,
    invalidate,
    invalidateAll,
    drawToMain,
  };
};

export const useAnimationFrame = (
  callback: (timestamp: number) => void,
  enabled: boolean
) => {
  const frameRef = useRef<number | undefined>(undefined);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      return;
    }

    const animate = (timestamp: number) => {
      callbackRef.current(timestamp);
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [enabled]);
};

export const useThrottledRender = (
  renderFn: () => void,
  minInterval: number = 16
) => {
  const lastRenderRef = useRef(0);
  const scheduledRef = useRef<number | null>(null);

  const throttledRender = useCallback(() => {
    const now = performance.now();
    const elapsed = now - lastRenderRef.current;

    if (elapsed >= minInterval) {
      lastRenderRef.current = now;
      renderFn();
    } else if (!scheduledRef.current) {
      const remaining = minInterval - elapsed;
      scheduledRef.current = window.setTimeout(() => {
        scheduledRef.current = null;
        lastRenderRef.current = performance.now();
        renderFn();
      }, remaining);
    }
  }, [renderFn, minInterval]);

  useEffect(() => {
    return () => {
      if (scheduledRef.current) {
        clearTimeout(scheduledRef.current);
      }
    };
  }, []);

  return throttledRender;
};
