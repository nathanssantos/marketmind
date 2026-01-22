import { useCallback, useEffect, useRef } from 'react';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';

export interface UseTouchGesturesProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  manager: CanvasManager | null;
  enabled?: boolean;
  onViewportChange?: () => void;
}

export interface UseTouchGesturesResult {
  isTouching: boolean;
}

interface TouchState {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  initialDistance: number;
  initialMidpoint: { x: number; y: number };
  touchCount: number;
}

const getTouchDistance = (touch1: Touch, touch2: Touch): number => {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

const getTouchMidpoint = (touch1: Touch, touch2: Touch): { x: number; y: number } => ({
  x: (touch1.clientX + touch2.clientX) / 2,
  y: (touch1.clientY + touch2.clientY) / 2,
});

export const useTouchGestures = ({
  canvasRef,
  manager,
  enabled = true,
  onViewportChange,
}: UseTouchGesturesProps): UseTouchGesturesResult => {
  const touchStateRef = useRef<TouchState | null>(null);
  const isTouchingRef = useRef(false);
  const onViewportChangeRef = useRef(onViewportChange);

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (!enabled || !manager) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const touches = event.touches;

    if (touches.length === 1) {
      const touch = touches[0]!;
      touchStateRef.current = {
        startX: touch.clientX - rect.left,
        startY: touch.clientY - rect.top,
        lastX: touch.clientX - rect.left,
        lastY: touch.clientY - rect.top,
        initialDistance: 0,
        initialMidpoint: { x: 0, y: 0 },
        touchCount: 1,
      };
      isTouchingRef.current = true;
    } else if (touches.length === 2) {
      const touch1 = touches[0]!;
      const touch2 = touches[1]!;
      const distance = getTouchDistance(touch1, touch2);
      const midpoint = getTouchMidpoint(touch1, touch2);

      touchStateRef.current = {
        startX: midpoint.x - rect.left,
        startY: midpoint.y - rect.top,
        lastX: midpoint.x - rect.left,
        lastY: midpoint.y - rect.top,
        initialDistance: distance,
        initialMidpoint: { x: midpoint.x - rect.left, y: midpoint.y - rect.top },
        touchCount: 2,
      };
      isTouchingRef.current = true;
      event.preventDefault();
    }
  }, [enabled, manager, canvasRef]);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (!enabled || !manager || !touchStateRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const touches = event.touches;
    const state = touchStateRef.current;

    if (touches.length === 1 && state.touchCount === 1) {
      const touch = touches[0]!;
      const currentX = touch.clientX - rect.left;
      const currentY = touch.clientY - rect.top;
      const deltaX = currentX - state.lastX;
      const deltaY = currentY - state.lastY;

      if (Math.abs(deltaX) > 0) {
        manager.pan(deltaX);
        onViewportChangeRef.current?.();
      }
      if (Math.abs(deltaY) > 0) {
        manager.panVertical(deltaY);
      }

      state.lastX = currentX;
      state.lastY = currentY;
      event.preventDefault();
    } else if (touches.length === 2 && state.touchCount === 2) {
      const touch1 = touches[0]!;
      const touch2 = touches[1]!;
      const currentDistance = getTouchDistance(touch1, touch2);
      const midpoint = getTouchMidpoint(touch1, touch2);
      const currentMidX = midpoint.x - rect.left;

      const scaleFactor = currentDistance / state.initialDistance;
      const zoomDelta = (scaleFactor - 1) * 2;

      if (Math.abs(zoomDelta) > 0.01) {
        manager.zoom(zoomDelta, currentMidX);
        state.initialDistance = currentDistance;
        onViewportChangeRef.current?.();
      }

      event.preventDefault();
    }
  }, [enabled, manager, canvasRef]);

  const handleTouchEnd = useCallback((event: TouchEvent) => {
    if (!enabled) return;

    const touches = event.touches;

    if (touches.length === 0) {
      touchStateRef.current = null;
      isTouchingRef.current = false;
    } else if (touches.length === 1 && touchStateRef.current?.touchCount === 2) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const touch = touches[0]!;
      touchStateRef.current = {
        startX: touch.clientX - rect.left,
        startY: touch.clientY - rect.top,
        lastX: touch.clientX - rect.left,
        lastY: touch.clientY - rect.top,
        initialDistance: 0,
        initialMidpoint: { x: 0, y: 0 },
        touchCount: 1,
      };
    }
  }, [enabled, canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd, canvasRef]);

  return {
    isTouching: isTouchingRef.current,
  };
};

export const isTouchDevice = (): boolean => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};
