import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useDrawingStore } from '@renderer/store/drawingStore';
import { useEffect } from 'react';
import type { BackendExecution } from '../useOrderLinesRenderer';
import type { useOrderDragHandler } from '../useOrderDragHandler';
import type { useSlTpPlacementMode } from '@renderer/hooks/useSlTpPlacementMode';

export interface UseChartKeyboardShortcutsProps {
  manager: CanvasManager | null;
  symbol?: string;
  timeframe: string;
  slTpPlacement: ReturnType<typeof useSlTpPlacementMode>;
  tsPlacementActive: boolean;
  tsPlacementDeactivate: () => void;
  orderDragHandler: ReturnType<typeof useOrderDragHandler>;
  allExecutions: BackendExecution[];
}

export const useChartKeyboardShortcuts = ({
  manager,
  symbol,
  timeframe,
  slTpPlacement,
  tsPlacementActive,
  tsPlacementDeactivate,
  orderDragHandler,
  allExecutions,
}: UseChartKeyboardShortcutsProps): void => {
  useEffect(() => {
    if (!slTpPlacement.active) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        slTpPlacement.deactivate();
        manager?.markDirty('overlays');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slTpPlacement.active, slTpPlacement.deactivate, manager]);

  useEffect(() => {
    if (!tsPlacementActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        tsPlacementDeactivate();
        manager?.markDirty('overlays');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tsPlacementActive, tsPlacementDeactivate, manager]);

  useEffect(() => {
    if (tsPlacementActive) tsPlacementDeactivate();
  }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (orderDragHandler.isDragging) orderDragHandler.cancelDrag();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [orderDragHandler.isDragging, orderDragHandler.cancelDrag]);

  useEffect(() => {
    const handleDeleteDrawing = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        const drawingState = useDrawingStore.getState();
        if (drawingState.selectedDrawingId && symbol) {
          drawingState.deleteDrawing(drawingState.selectedDrawingId, symbol, timeframe);
          manager?.markDirty('overlays');
        }
      }
    };

    window.addEventListener('keydown', handleDeleteDrawing);
    return () => window.removeEventListener('keydown', handleDeleteDrawing);
  }, [symbol, manager, timeframe]);

  useEffect(() => {
    if (!slTpPlacement.active || !slTpPlacement.executionId) return;
    const targetExec = allExecutions.find(e => e.id === slTpPlacement.executionId);
    if (!targetExec || targetExec.status !== 'open') {
      slTpPlacement.deactivate();
    }
  }, [allExecutions, slTpPlacement]);
};
