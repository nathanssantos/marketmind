import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { getDrawingClipboard, setDrawingClipboard, useDrawingStore } from '@renderer/store/drawingStore';
import { useEffect } from 'react';
import { useKeyboardShortcut } from '@renderer/hooks/useKeyboardShortcut';
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
  useKeyboardShortcut({
    id: 'trading.cancelSlTpPlacement',
    keys: 'Escape',
    scope: 'when-condition',
    group: 'trading',
    description: 'Cancel SL/TP placement mode',
    descriptionKey: 'shortcuts.trading.cancelSlTpPlacement',
    allowInTypingTarget: true,
    when: () => slTpPlacement.active,
    action: () => {
      slTpPlacement.deactivate();
      manager?.markDirty('overlays');
    },
  });

  useKeyboardShortcut({
    id: 'trading.cancelTrailingStopPlacement',
    keys: 'Escape',
    scope: 'when-condition',
    group: 'trading',
    description: 'Cancel trailing stop placement mode',
    descriptionKey: 'shortcuts.trading.cancelTrailingStopPlacement',
    allowInTypingTarget: true,
    when: () => tsPlacementActive,
    action: () => {
      tsPlacementDeactivate();
      manager?.markDirty('overlays');
    },
  });

  useKeyboardShortcut({
    id: 'trading.cancelOrderDrag',
    keys: 'Escape',
    scope: 'when-condition',
    group: 'trading',
    description: 'Cancel order drag',
    descriptionKey: 'shortcuts.trading.cancelOrderDrag',
    allowInTypingTarget: true,
    when: () => orderDragHandler.isDragging,
    action: () => orderDragHandler.cancelDrag(),
  });

  useKeyboardShortcut(symbol ? {
    id: 'drawing.delete',
    keys: 'Delete',
    scope: 'when-condition',
    group: 'drawing',
    description: 'Delete selected drawing',
    descriptionKey: 'shortcuts.drawing.delete',
    when: () => {
      const state = useDrawingStore.getState();
      if (!state.selectedDrawingId) return false;
      const drawings = state.getDrawingsForSymbol(symbol, timeframe);
      const selected = drawings.find((d) => d.id === state.selectedDrawingId);
      return !!selected && !selected.locked;
    },
    action: () => {
      const state = useDrawingStore.getState();
      if (!state.selectedDrawingId) return;
      state.deleteDrawing(state.selectedDrawingId, symbol, timeframe);
      manager?.markDirty('overlays');
    },
  } : null);

  useKeyboardShortcut(symbol ? {
    id: 'drawing.deleteBackspace',
    keys: 'Backspace',
    scope: 'when-condition',
    group: 'drawing',
    description: 'Delete selected drawing (Backspace)',
    descriptionKey: 'shortcuts.drawing.delete',
    hidden: true,
    when: () => {
      const state = useDrawingStore.getState();
      if (!state.selectedDrawingId) return false;
      const drawings = state.getDrawingsForSymbol(symbol, timeframe);
      const selected = drawings.find((d) => d.id === state.selectedDrawingId);
      return !!selected && !selected.locked;
    },
    action: () => {
      const state = useDrawingStore.getState();
      if (!state.selectedDrawingId) return;
      state.deleteDrawing(state.selectedDrawingId, symbol, timeframe);
      manager?.markDirty('overlays');
    },
  } : null);

  useKeyboardShortcut(symbol ? {
    id: 'drawing.copy',
    keys: 'Mod+C',
    scope: 'when-condition',
    group: 'drawing',
    description: 'Copy selected drawing',
    descriptionKey: 'shortcuts.drawing.copy',
    when: () => {
      const state = useDrawingStore.getState();
      if (!state.selectedDrawingId) return false;
      const drawings = state.getDrawingsForSymbol(symbol, timeframe);
      return drawings.some((d) => d.id === state.selectedDrawingId);
    },
    action: () => {
      const state = useDrawingStore.getState();
      if (!state.selectedDrawingId) return;
      const drawings = state.getDrawingsForSymbol(symbol, timeframe);
      const selected = drawings.find((d) => d.id === state.selectedDrawingId);
      if (selected) setDrawingClipboard(selected);
    },
  } : null);

  useKeyboardShortcut(symbol ? {
    id: 'drawing.paste',
    keys: 'Mod+V',
    scope: 'when-condition',
    group: 'drawing',
    description: 'Paste drawing',
    descriptionKey: 'shortcuts.drawing.paste',
    when: () => getDrawingClipboard() !== null,
    action: () => {
      const source = getDrawingClipboard();
      if (!source) return;
      useDrawingStore.getState().duplicateDrawing(source, {
        offsetIndex: 3,
        targetSymbol: symbol,
        targetInterval: timeframe,
      });
      manager?.markDirty('overlays');
    },
  } : null);

  useEffect(() => {
    if (tsPlacementActive) tsPlacementDeactivate();
  }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!slTpPlacement.active || !slTpPlacement.executionId) return;
    const targetExec = allExecutions.find((e) => e.id === slTpPlacement.executionId);
    if (targetExec && targetExec.status !== 'open') {
      slTpPlacement.deactivate();
    }
  }, [allExecutions, slTpPlacement]);
};
