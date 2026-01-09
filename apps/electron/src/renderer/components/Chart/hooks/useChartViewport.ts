import type { Kline, Viewport } from '@marketmind/types';
import { useCallback, useMemo, useState } from 'react';
import { CHART_CONFIG } from '../../../../shared/constants/chartConfig';

export interface UseChartViewportProps {
  klines: Kline[];
  width: number;
  height: number;
  initialZoom?: number;
  initialPan?: number;
  padding?: number;
}

export interface UseChartViewportResult {
  viewport: Viewport;
  zoom: number;
  pan: number;
  zoomIn: () => void;
  zoomOut: () => void;
  panLeft: () => void;
  panRight: () => void;
  reset: () => void;
  fitToData: () => void;
}

export const useChartViewport = ({
  klines,
  width,
  height,
  initialZoom = 1,
  initialPan = 0,
  padding = CHART_CONFIG.PRICE_RANGE_PADDING,
}: UseChartViewportProps): UseChartViewportResult => {
  const [zoom, setZoom] = useState(initialZoom);
  const [pan, setPan] = useState(initialPan);

  const viewport = useMemo<Viewport>(() => {
    if (klines.length === 0) {
      return {
        start: 0,
        end: 100,
        priceMin: 0,
        priceMax: 100,
        width,
        height,
        klineWidth: 8,
        klineSpacing: 2,
      };
    }

    const visibleCount = klines.length / zoom;
    const start = Math.max(0, klines.length - visibleCount - pan);
    const end = Math.min(klines.length, start + visibleCount);

    const visibleStart = Math.floor(start);
    const visibleEnd = Math.ceil(end);

    let priceMin = Infinity;
    let priceMax = -Infinity;

    for (let i = visibleStart; i < visibleEnd && i < klines.length; i++) {
      const k = klines[i];
      if (!k) continue;
      const open = Number(k.open);
      const high = Number(k.high);
      const low = Number(k.low);
      const close = Number(k.close);
      if (high > priceMax) priceMax = high;
      if (low < priceMin) priceMin = low;
      if (open > priceMax) priceMax = open;
      if (open < priceMin) priceMin = open;
      if (close > priceMax) priceMax = close;
      if (close < priceMin) priceMin = close;
    }

    if (priceMin === Infinity) priceMin = 0;
    if (priceMax === -Infinity) priceMax = 100;
    const priceRange = priceMax - priceMin;

    const klineWidth = Math.max(1, Math.min(20, width / visibleCount * 0.8));
    const klineSpacing = Math.max(0.5, klineWidth * 0.25);

    return {
      start,
      end,
      priceMin: priceMin - priceRange * padding,
      priceMax: priceMax + priceRange * padding,
      width,
      height,
      klineWidth,
      klineSpacing,
    };
  }, [klines, width, height, zoom, pan, padding]);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(z * 1.2, 10));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(z / 1.2, 0.1));
  }, []);

  const panLeft = useCallback(() => {
    setPan((p) => Math.max(p - 10, 0));
  }, []);

  const panRight = useCallback(() => {
    setPan((p) => p + 10);
  }, []);

  const reset = useCallback(() => {
    setZoom(initialZoom);
    setPan(initialPan);
  }, [initialZoom, initialPan]);

  const fitToData = useCallback(() => {
    setZoom(1);
    setPan(0);
  }, []);

  return {
    viewport,
    zoom,
    pan,
    zoomIn,
    zoomOut,
    panLeft,
    panRight,
    reset,
    fitToData,
  };
};
