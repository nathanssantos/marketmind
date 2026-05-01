import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useKeyboardShortcut } from '@renderer/hooks/useKeyboardShortcut';
import { CHART_CANVAS_DATA_ATTR, type ShortcutDefinition } from '@renderer/services/keyboardShortcuts';

export interface UseKeyboardNavigationProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  manager: CanvasManager | null;
  enabled?: boolean;
  onViewportChange?: () => void;
}

export interface UseKeyboardNavigationResult {
  focusCanvas: () => void;
}

const PAN_STEP = 50;
const ZOOM_STEP = 1;

export const useKeyboardNavigation = ({
  canvasRef,
  manager,
  enabled = true,
  onViewportChange,
}: UseKeyboardNavigationProps): UseKeyboardNavigationResult => {
  const onViewportChangeRef = useRef(onViewportChange);
  const managerRef = useRef(manager);

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
    managerRef.current = manager;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;
    canvas.setAttribute('tabindex', '0');
    canvas.setAttribute(CHART_CANVAS_DATA_ATTR, '');
    return () => {
      canvas.removeAttribute(CHART_CANVAS_DATA_ATTR);
    };
  }, [canvasRef, enabled]);

  const fireViewportChange = useCallback(() => onViewportChangeRef.current?.(), []);

  const baseDefs = useMemo<Omit<ShortcutDefinition, 'action'>[]>(() => [
    { id: 'chart.panLeft', keys: 'ArrowLeft', scope: 'chart-focus', group: 'chart', description: 'Pan left', descriptionKey: 'shortcuts.chart.panLeft' },
    { id: 'chart.panRight', keys: 'ArrowRight', scope: 'chart-focus', group: 'chart', description: 'Pan right', descriptionKey: 'shortcuts.chart.panRight' },
    { id: 'chart.panLeftFast', keys: 'Mod+ArrowLeft', scope: 'chart-focus', group: 'chart', description: 'Pan left (fast)', descriptionKey: 'shortcuts.chart.panLeftFast' },
    { id: 'chart.panRightFast', keys: 'Mod+ArrowRight', scope: 'chart-focus', group: 'chart', description: 'Pan right (fast)', descriptionKey: 'shortcuts.chart.panRightFast' },
    { id: 'chart.panUp', keys: 'Mod+ArrowUp', scope: 'chart-focus', group: 'chart', description: 'Pan up', descriptionKey: 'shortcuts.chart.panUp' },
    { id: 'chart.panDown', keys: 'Mod+ArrowDown', scope: 'chart-focus', group: 'chart', description: 'Pan down', descriptionKey: 'shortcuts.chart.panDown' },
    { id: 'chart.zoomIn', keys: '+', scope: 'chart-focus', group: 'chart', description: 'Zoom in', descriptionKey: 'shortcuts.chart.zoomIn' },
    { id: 'chart.zoomOut', keys: '-', scope: 'chart-focus', group: 'chart', description: 'Zoom out', descriptionKey: 'shortcuts.chart.zoomOut' },
    { id: 'chart.resetZoom', keys: 'Mod+0', scope: 'chart-focus', group: 'chart', description: 'Reset vertical zoom', descriptionKey: 'shortcuts.chart.resetZoom' },
    { id: 'chart.goToStart', keys: 'Home', scope: 'chart-focus', group: 'chart', description: 'Go to start', descriptionKey: 'shortcuts.chart.goToStart' },
    { id: 'chart.goToEnd', keys: 'End', scope: 'chart-focus', group: 'chart', description: 'Go to latest', descriptionKey: 'shortcuts.chart.goToEnd' },
  ], []);

  useKeyboardShortcut(enabled ? {
    ...baseDefs[0]!,
    action: () => { managerRef.current?.pan(PAN_STEP); fireViewportChange(); },
  } : null);
  useKeyboardShortcut(enabled ? {
    ...baseDefs[1]!,
    action: () => { managerRef.current?.pan(-PAN_STEP); fireViewportChange(); },
  } : null);
  useKeyboardShortcut(enabled ? {
    ...baseDefs[2]!,
    action: () => { managerRef.current?.pan(PAN_STEP * 3); fireViewportChange(); },
  } : null);
  useKeyboardShortcut(enabled ? {
    ...baseDefs[3]!,
    action: () => { managerRef.current?.pan(-PAN_STEP * 3); fireViewportChange(); },
  } : null);
  useKeyboardShortcut(enabled ? {
    ...baseDefs[4]!,
    action: () => { managerRef.current?.panVertical(PAN_STEP); },
  } : null);
  useKeyboardShortcut(enabled ? {
    ...baseDefs[5]!,
    action: () => { managerRef.current?.panVertical(-PAN_STEP); },
  } : null);
  useKeyboardShortcut(enabled ? {
    ...baseDefs[6]!,
    action: () => { managerRef.current?.zoom(ZOOM_STEP); fireViewportChange(); },
  } : null);
  useKeyboardShortcut(enabled ? {
    ...baseDefs[7]!,
    action: () => { managerRef.current?.zoom(-ZOOM_STEP); fireViewportChange(); },
  } : null);
  useKeyboardShortcut(enabled ? {
    ...baseDefs[8]!,
    action: () => { managerRef.current?.resetVerticalZoom(); fireViewportChange(); },
  } : null);
  useKeyboardShortcut(enabled ? {
    ...baseDefs[9]!,
    action: () => {
      const m = managerRef.current;
      if (!m) return;
      m.setViewport({ ...m.getViewport(), start: 0 });
      fireViewportChange();
    },
  } : null);
  useKeyboardShortcut(enabled ? {
    ...baseDefs[10]!,
    action: () => {
      const m = managerRef.current;
      if (!m) return;
      const vp = m.getViewport();
      const range = vp.end - vp.start;
      const count = m.getKlineCount();
      if (count <= 0) return;
      m.setViewport({ ...vp, start: Math.max(0, count - range), end: count });
      fireViewportChange();
    },
  } : null);

  const focusCanvas = useCallback(() => {
    canvasRef.current?.focus();
  }, [canvasRef]);

  return { focusCanvas };
};

export const KEYBOARD_SHORTCUTS = {
  PAN_LEFT: 'ArrowLeft',
  PAN_RIGHT: 'ArrowRight',
  PAN_UP: 'Ctrl/Cmd + ArrowUp',
  PAN_DOWN: 'Ctrl/Cmd + ArrowDown',
  ZOOM_IN: '+',
  ZOOM_OUT: '-',
  RESET_ZOOM: 'Ctrl/Cmd + 0',
  GO_TO_START: 'Home',
  GO_TO_END: 'End',
} as const;
