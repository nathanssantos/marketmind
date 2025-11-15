import type { Candle, Viewport } from '@shared/types';
import { CHART_CONFIG } from '@shared/constants';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CanvasManager } from '@renderer/utils/canvas/CanvasManager';

export interface UseChartCanvasProps {
  candles: Candle[];
  initialViewport?: Viewport;
  onViewportChange?: (viewport: Viewport) => void;
}

export interface UseChartCanvasReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  manager: CanvasManager | null;
  viewport: Viewport;
  handleWheel: (event: React.WheelEvent<HTMLCanvasElement>) => void;
  handleMouseDown: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  handleMouseMove: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  handleMouseUp: () => void;
  handleMouseLeave: () => void;
}

const DEFAULT_VIEWPORT: Viewport = {
  start: 0,
  end: 100,
  candleWidth: CHART_CONFIG.DEFAULT_CANDLE_WIDTH,
  candleSpacing: CHART_CONFIG.CANDLE_SPACING,
};

export const useChartCanvas = ({
  candles,
  initialViewport = DEFAULT_VIEWPORT,
  onViewportChange,
}: UseChartCanvasProps): UseChartCanvasReturn => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const managerRef = useRef<CanvasManager | null>(null);
  const [viewport, setViewport] = useState<Viewport>(initialViewport);
  const [isPanning, setIsPanning] = useState(false);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    if (!managerRef.current) {
      const manager = new CanvasManager(
        canvasRef.current,
        viewport,
        CHART_CONFIG.CANVAS_PADDING,
        CHART_CONFIG.VOLUME_HEIGHT_RATIO,
      );
      manager.setCandles(candles);
      managerRef.current = manager;
    } else {
      managerRef.current.setCandles(candles);
      managerRef.current.setViewport(viewport);
    }

    const handleResize = (): void => {
      if (managerRef.current) {
        managerRef.current.resize();
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (canvasRef.current.parentElement) {
      resizeObserver.observe(canvasRef.current.parentElement);
    }

    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [candles, viewport]);

  const updateViewport = useCallback(
    (newViewport: Viewport): void => {
      setViewport(newViewport);
      onViewportChange?.(newViewport);
    },
    [onViewportChange],
  );

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLCanvasElement>): void => {
      event.preventDefault();

      if (!managerRef.current) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = event.clientX - rect.left;
      const delta = event.deltaY > 0 ? -1 : 1;

      managerRef.current.zoom(delta, mouseX);
      updateViewport(managerRef.current.getViewport());
    },
    [updateViewport],
  );

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>): void => {
    setIsPanning(true);
    lastMousePosRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>): void => {
      if (!isPanning || !lastMousePosRef.current || !managerRef.current) return;

      const deltaX = event.clientX - lastMousePosRef.current.x;
      
      managerRef.current.pan(deltaX);
      updateViewport(managerRef.current.getViewport());
      
      lastMousePosRef.current = { x: event.clientX, y: event.clientY };
    },
    [isPanning, updateViewport],
  );

  const handleMouseUp = useCallback((): void => {
    setIsPanning(false);
    lastMousePosRef.current = null;
  }, []);

  const handleMouseLeave = useCallback((): void => {
    setIsPanning(false);
    lastMousePosRef.current = null;
  }, []);

  return {
    canvasRef,
    manager: managerRef.current,
    viewport,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  };
};
