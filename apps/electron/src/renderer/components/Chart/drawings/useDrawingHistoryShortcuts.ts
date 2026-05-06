import { useDrawingStore } from '@renderer/store/drawingStore';
import { useKeyboardShortcut } from '@renderer/hooks/useKeyboardShortcut';

interface UseDrawingHistoryShortcutsProps {
  symbol: string;
  interval: string;
  enabled?: boolean;
}

/**
 * Wires Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z (plus Cmd/Ctrl+Y) to the
 * drawing history. Both undo and redo route through `useDrawingStore`,
 * which records every `addDrawing` / `updateDrawing` / `deleteDrawing`
 * into a per-(symbol, interval) stack capped at 100 ops.
 *
 * The store-side `isApplyingHistory` flag suppresses re-recording when
 * the inverse op fires through the same actions, so the redo stack
 * survives a roundtrip.
 *
 * Backend sync happens for free: `drawingSyncManager` subscribes to
 * `drawingsByKey` and diffs every change, so an undo/redo automatically
 * propagates to the server without bypass logic.
 */
export const useDrawingHistoryShortcuts = ({
  symbol,
  interval,
  enabled = true,
}: UseDrawingHistoryShortcutsProps): void => {
  useKeyboardShortcut(enabled && symbol && interval ? {
    id: 'drawing.undo',
    keys: 'Mod+z',
    scope: 'global',
    group: 'drawing',
    description: 'Undo last drawing change',
    descriptionKey: 'shortcuts.drawing.undo',
    preventDefault: true,
    action: () => { useDrawingStore.getState().undo(symbol, interval); },
  } : null);

  useKeyboardShortcut(enabled && symbol && interval ? {
    id: 'drawing.redo-shift',
    keys: 'Mod+Shift+z',
    scope: 'global',
    group: 'drawing',
    description: 'Redo last undone drawing change',
    descriptionKey: 'shortcuts.drawing.redo',
    preventDefault: true,
    action: () => { useDrawingStore.getState().redo(symbol, interval); },
  } : null);

  useKeyboardShortcut(enabled && symbol && interval ? {
    id: 'drawing.redo-y',
    keys: 'Mod+y',
    scope: 'global',
    group: 'drawing',
    description: 'Redo last undone drawing change',
    descriptionKey: 'shortcuts.drawing.redo',
    preventDefault: true,
    hidden: true,
    action: () => { useDrawingStore.getState().redo(symbol, interval); },
  } : null);
};
