import type { Kline, Viewport } from '@shared/types';
import { useCallback, useMemo, useState } from 'react';

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
  padding = 0.05,
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
      };
    }

    const visibleCount = klines.length / zoom;
    const start = Math.max(0, klines.length - visibleCount - pan);
    const end = Math.min(klines.length, start + visibleCount);

    const visibleKlines = klines.slice(Math.floor(start), Math.ceil(end));
    const prices = visibleKlines.flatMap((k) => [k.open, k.high, k.low, k.close]);
    const priceMin = Math.min(...prices);
    const priceMax = Math.max(...prices);
    const priceRange = priceMax - priceMin;

    return {
      start,
      end,
      priceMin: priceMin - priceRange * padding,
      priceMax: priceMax + priceRange * padding,
      width,
      height,
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
