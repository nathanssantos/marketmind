import { useCallback, useEffect, useRef } from 'react';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';

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
  const isFocusedRef = useRef(false);

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled || !manager || !isFocusedRef.current) return;

    const isModifierPressed = event.ctrlKey || event.metaKey || event.altKey;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        manager.pan(isModifierPressed ? PAN_STEP * 3 : PAN_STEP);
        onViewportChangeRef.current?.();
        break;

      case 'ArrowRight':
        event.preventDefault();
        manager.pan(isModifierPressed ? -PAN_STEP * 3 : -PAN_STEP);
        onViewportChangeRef.current?.();
        break;

      case 'ArrowUp':
        if (isModifierPressed) {
          event.preventDefault();
          manager.panVertical(PAN_STEP);
        }
        break;

      case 'ArrowDown':
        if (isModifierPressed) {
          event.preventDefault();
          manager.panVertical(-PAN_STEP);
        }
        break;

      case '+':
      case '=':
        event.preventDefault();
        manager.zoom(ZOOM_STEP);
        onViewportChangeRef.current?.();
        break;

      case '-':
      case '_':
        event.preventDefault();
        manager.zoom(-ZOOM_STEP);
        onViewportChangeRef.current?.();
        break;

      case '0':
        if (isModifierPressed) {
          event.preventDefault();
          manager.resetVerticalZoom();
          onViewportChangeRef.current?.();
        }
        break;

      case 'Home':
        event.preventDefault();
        manager.setViewport({ ...manager.getViewport(), start: 0 });
        onViewportChangeRef.current?.();
        break;

      case 'End': {
        event.preventDefault();
        const endViewport = manager.getViewport();
        const endVisibleRange = endViewport.end - endViewport.start;
        const klineCount = manager.getKlineCount();
        if (klineCount > 0) {
          manager.setViewport({
            ...endViewport,
            start: Math.max(0, klineCount - endVisibleRange),
            end: klineCount,
          });
          onViewportChangeRef.current?.();
        }
        break;
      }

      default:
        break;
    }
  }, [enabled, manager]);

  const handleFocus = useCallback(() => {
    isFocusedRef.current = true;
  }, []);

  const handleBlur = useCallback(() => {
    isFocusedRef.current = false;
  }, []);

  const focusCanvas = useCallback(() => {
    canvasRef.current?.focus();
  }, [canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;

    canvas.setAttribute('tabindex', '0');

    canvas.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('focus', handleFocus);
    canvas.addEventListener('blur', handleBlur);

    return () => {
      canvas.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('focus', handleFocus);
      canvas.removeEventListener('blur', handleBlur);
    };
  }, [enabled, handleKeyDown, handleFocus, handleBlur, canvasRef]);

  return {
    focusCanvas,
  };
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
