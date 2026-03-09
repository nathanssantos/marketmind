import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useGridOrderStore } from '@renderer/store/gridOrderStore';
import { useCallback, useMemo, useRef } from 'react';
import { CHART_CONFIG } from '@shared/constants';

interface UseGridInteractionProps {
  manager: CanvasManager | null;
  enabled: boolean;
  getSnappedPrice: (rawY: number) => { price: number; snapped: boolean; source?: string };
  onGridConfirm: (prices: number[], side: 'BUY' | 'SELL') => void;
}

export const useGridInteraction = ({ manager, enabled, getSnappedPrice, onGridConfirm }: UseGridInteractionProps) => {
  const startYRef = useRef<number | null>(null);
  const endYRef = useRef<number | null>(null);
  const isDrawingRef = useRef(false);

  const gridCount = useGridOrderStore((s) => s.gridCount);
  const gridSide = useGridOrderStore((s) => s.gridSide);
  const setIsDrawingGrid = useGridOrderStore((s) => s.setIsDrawingGrid);
  const setStartPrice = useGridOrderStore((s) => s.setStartPrice);
  const setEndPrice = useGridOrderStore((s) => s.setEndPrice);
  const resetDrawing = useGridOrderStore((s) => s.resetDrawing);

  const computeGridPrices = useCallback((topPrice: number, bottomPrice: number, count: number): number[] => {
    if (count < 2) return [topPrice];
    const step = (topPrice - bottomPrice) / (count - 1);
    return Array.from({ length: count }, (_, i) => bottomPrice + step * i);
  }, []);

  const handleMouseDown = useCallback((x: number, y: number): boolean => {
    if (!enabled || !manager) return false;

    const dimensions = manager.getDimensions();
    if (!dimensions) return false;

    const timeScaleTop = dimensions.height - CHART_CONFIG.CANVAS_PADDING_BOTTOM;
    if (y >= timeScaleTop) return false;

    const priceScaleLeft = dimensions.width - CHART_CONFIG.CANVAS_PADDING_RIGHT;
    if (x >= priceScaleLeft) return false;

    const snap = getSnappedPrice(y);
    startYRef.current = y;
    endYRef.current = y;
    isDrawingRef.current = true;
    setIsDrawingGrid(true);
    setStartPrice(snap.price);
    setEndPrice(snap.price);
    manager.markDirty('overlays');
    return true;
  }, [enabled, manager, getSnappedPrice, setIsDrawingGrid, setStartPrice, setEndPrice]);

  const handleMouseMove = useCallback((y: number): void => {
    if (!isDrawingRef.current || !manager) return;

    endYRef.current = y;
    const snap = getSnappedPrice(y);
    setEndPrice(snap.price);
    manager.markDirty('overlays');
  }, [manager, getSnappedPrice, setEndPrice]);

  const handleMouseUp = useCallback((): void => {
    if (!isDrawingRef.current || !manager) return;

    const startPrice = useGridOrderStore.getState().startPrice;
    const endPrice = useGridOrderStore.getState().endPrice;

    if (startPrice !== null && endPrice !== null && Math.abs(startPrice - endPrice) > 0) {
      const top = Math.max(startPrice, endPrice);
      const bottom = Math.min(startPrice, endPrice);
      const prices = computeGridPrices(top, bottom, gridCount);
      onGridConfirm(prices, gridSide);
    }

    isDrawingRef.current = false;
    startYRef.current = null;
    endYRef.current = null;
    resetDrawing();
  }, [manager, gridCount, gridSide, computeGridPrices, onGridConfirm, resetDrawing]);

  const cancelGrid = useCallback((): void => {
    isDrawingRef.current = false;
    startYRef.current = null;
    endYRef.current = null;
    resetDrawing();
    manager?.markDirty('overlays');
  }, [resetDrawing, manager]);

  const previewPrices = useMemo((): number[] => {
    const { startPrice, endPrice } = useGridOrderStore.getState();
    if (startPrice === null || endPrice === null) return [];
    const top = Math.max(startPrice, endPrice);
    const bottom = Math.min(startPrice, endPrice);
    if (top === bottom) return [];
    return computeGridPrices(top, bottom, gridCount);
  }, [gridCount, computeGridPrices]);

  return {
    isDrawing: isDrawingRef.current,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    cancelGrid,
    previewPrices,
    getPreviewPrices: () => {
      const { startPrice, endPrice } = useGridOrderStore.getState();
      if (startPrice === null || endPrice === null) return [];
      const top = Math.max(startPrice, endPrice);
      const bottom = Math.min(startPrice, endPrice);
      if (top === bottom) return [];
      return computeGridPrices(top, bottom, gridCount);
    },
  };
};
