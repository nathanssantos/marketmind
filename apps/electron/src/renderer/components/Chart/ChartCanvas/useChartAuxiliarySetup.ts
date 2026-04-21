import type { Kline, Order } from '@marketmind/types';
import { useSlTpPlacementMode } from '@renderer/hooks/useSlTpPlacementMode';
import { useGridOrderStore } from '@renderer/store/gridOrderStore';
import { useTrailingStopPlacementStore } from '@renderer/store/trailingStopPlacementStore';
import type { MutableRefObject } from 'react';
import { useCallback } from 'react';
import { useGridInteraction } from '../useGridInteraction';
import { useGridPreviewRenderer } from '../useGridPreviewRenderer';
import { useOrderDragHandler } from '../useOrderDragHandler';
import { usePriceMagnet } from '../usePriceMagnet';
import { useDrawingInteraction } from '../drawings/useDrawingInteraction';
import { useDrawingsRenderer } from '../drawings/useDrawingsRenderer';
import { useBackendDrawings } from '@renderer/hooks/useBackendDrawings';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { BackendExecution } from '../useOrderLinesRenderer';
import type { ChartColors } from '@renderer/hooks/useChartColors';

export interface UseChartAuxiliarySetupProps {
  manager: CanvasManager | null;
  klines: Kline[];
  symbol: string;
  timeframe: string;
  colors: ChartColors;
  hasTradingEnabled: boolean;
  allExecutions: BackendExecution[];
  draggableOrders: Order[];
  handleUpdateOrder: (id: string, updates: Partial<Order>) => void;
  handleGridConfirm: (prices: number[], side: 'BUY' | 'SELL') => Promise<void>;
  dragSlEnabled: boolean;
  dragTpEnabled: boolean;
  slTightenOnly: boolean;
  symbolFiltersData: { tickSize: number } | undefined;
  getOrderAtPosition: (x: number, y: number) => Order | null;
  draggedOrderIdRef: MutableRefObject<string | null>;
}

export const useChartAuxiliarySetup = ({
  manager,
  klines,
  symbol,
  timeframe,
  colors,
  hasTradingEnabled,
  allExecutions,
  draggableOrders,
  handleUpdateOrder,
  handleGridConfirm,
  dragSlEnabled,
  dragTpEnabled,
  slTightenOnly,
  symbolFiltersData,
  getOrderAtPosition: getOrderAtPositionFn,
  draggedOrderIdRef,
}: UseChartAuxiliarySetupProps) => {

  const memoizedPriceToY = useCallback((price: number) => manager?.priceToY(price) ?? 0, [manager]);
  const memoizedYToPrice = useCallback((y: number) => manager?.yToPrice(y) ?? 0, [manager]);
  const memoizedGetOrderAtPosition = useCallback((x: number, y: number) => getOrderAtPositionFn(x, y), [getOrderAtPositionFn]);
  const memoizedMarkDirty = useCallback((layer: 'klines' | 'viewport' | 'dimensions' | 'overlays' | 'all') => manager?.markDirty(layer), [manager]);

  const orderDragHandler = useOrderDragHandler({
    orders: draggableOrders,
    updateOrder: handleUpdateOrder,
    priceToY: memoizedPriceToY,
    yToPrice: memoizedYToPrice,
    enabled: hasTradingEnabled && draggableOrders.length > 0,
    slDragEnabled: dragSlEnabled,
    tpDragEnabled: dragTpEnabled,
    slTightenOnly: dragSlEnabled ? slTightenOnly : false,
    getOrderAtPosition: memoizedGetOrderAtPosition,
    markDirty: memoizedMarkDirty,
    draggedOrderIdRef,
  });

  const slTpPlacement = useSlTpPlacementMode();

  const tsPlacementActive = useTrailingStopPlacementStore((s) => s.isPlacing);
  const tsPlacementPreviewPrice = useTrailingStopPlacementStore((s) => s.previewPrice);
  const tsPlacementDeactivate = useTrailingStopPlacementStore((s) => s.deactivate);
  const tsPlacementSetPreview = useTrailingStopPlacementStore((s) => s.setPreviewPrice);

  const isGridModeActive = useGridOrderStore((s) => s.isGridModeActive);
  const gridSnapEnabled = useGridOrderStore((s) => s.snapEnabled);
  const gridSnapDistancePx = useGridOrderStore((s) => s.snapDistancePx);

  const tickSize = symbolFiltersData?.tickSize ?? 0;

  const { getSnappedPrice } = usePriceMagnet({
    manager,
    enabled: isGridModeActive && gridSnapEnabled,
    snapDistancePx: gridSnapDistancePx,
    executions: allExecutions,
    tickSize: tickSize > 0 ? tickSize : undefined,
  });

  const gridInteraction = useGridInteraction({
    manager,
    enabled: isGridModeActive && hasTradingEnabled,
    getSnappedPrice,
    onGridConfirm: (prices, side) => { void handleGridConfirm(prices, side); },
  });

  const { renderGridPreview } = useGridPreviewRenderer({
    manager,
    getPreviewPrices: gridInteraction.getPreviewPrices,
  });

  const drawingInteraction = useDrawingInteraction({
    manager,
    klines,
    symbol,
    interval: timeframe,
  });

  useBackendDrawings(symbol, timeframe, klines);

  const { render: renderDrawings } = useDrawingsRenderer({
    manager,
    symbol,
    interval: timeframe,
    klines,
    colors: { bullish: colors.bullish, bearish: colors.bearish, crosshair: colors.crosshair },
    themeColors: colors,
    pendingDrawingRef: drawingInteraction.pendingDrawingRef,
    lastSnapRef: drawingInteraction.lastSnapRef,
  });

  return {
    orderDragHandler,
    slTpPlacement,
    tsPlacementActive,
    tsPlacementPreviewPrice,
    tsPlacementDeactivate,
    tsPlacementSetPreview,
    isGridModeActive,
    gridInteraction,
    renderGridPreview,
    drawingInteraction,
    renderDrawings,
  };
};
