import { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG } from '@shared/constants';
import type { Candle, Viewport } from '@shared/types';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseChartCanvasProps {
  candles: Candle[];
  initialViewport?: Viewport;
  onViewportChange?: (viewport: Viewport) => void;
}

export interface UseChartCanvasReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  manager: CanvasManager | null;
  viewport: Viewport;
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
  const [manager, setManager] = useState<CanvasManager | null>(null);
  
  // Initialize viewport to show last candles if no custom viewport provided
  const [viewport, setViewport] = useState<Viewport>(() => {
    if (initialViewport !== DEFAULT_VIEWPORT) {
      return initialViewport;
    }
    
    // Show last 100 candles (or all if less than 100)
    const candleCount = candles.length;
    const visibleCount = Math.min(100, candleCount);
    
    return {
      ...DEFAULT_VIEWPORT,
      start: Math.max(0, candleCount - visibleCount),
      end: candleCount,
    };
  });
  
  const [isPanning, setIsPanning] = useState(false);
  const [isPanningOnScale, setIsPanningOnScale] = useState(false);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize canvas manager only once
  useEffect(() => {
    if (!canvasRef.current || managerRef.current) return;

    const newManager = new CanvasManager(
      canvasRef.current,
      viewport,
      CHART_CONFIG.CANVAS_PADDING,
    );
    newManager.setCandles(candles);
    managerRef.current = newManager;
    setManager(newManager);

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
      if (managerRef.current) {
        managerRef.current.destroy();
        managerRef.current = null;
        setManager(null);
      }
    };
  }, []);

  // Update candles when they change
  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.setCandles(candles);
    }
  }, [candles]);

  // Update viewport when it changes
  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.setViewport(viewport);
    }
  }, [viewport]);

  const updateViewport = useCallback(
    (newViewport: Viewport): void => {
      setViewport(newViewport);
      onViewportChange?.(newViewport);
    },
    [onViewportChange],
  );

  // Handle wheel events with native addEventListener to prevent passive listener issues
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (event: WheelEvent): void => {
      event.preventDefault();

      if (!managerRef.current) return;

      const rect = canvas.getBoundingClientRect();
      if (!rect) return;

      const mouseX = event.clientX - rect.left;
      const delta = event.deltaY > 0 ? -1 : 1;

      managerRef.current.zoom(delta, mouseX);
      updateViewport(managerRef.current.getViewport());
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [updateViewport]);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const dimensions = managerRef.current?.getDimensions();
    
    if (dimensions) {
      const priceScaleLeft = dimensions.width - CHART_CONFIG.CANVAS_PADDING_RIGHT;
      const isOverPriceScale = mouseX >= priceScaleLeft;
      
      setIsPanningOnScale(isOverPriceScale);
    }
    
    setIsPanning(true);
    lastMousePosRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>): void => {
      if (!isPanning || !lastMousePosRef.current || !managerRef.current) return;

      const deltaX = event.clientX - lastMousePosRef.current.x;
      const deltaY = event.clientY - lastMousePosRef.current.y;

      if (isPanningOnScale) {
        // Zoom vertical when dragging on price scale
        managerRef.current.zoomVertical(deltaY);
      } else {
        // Pan horizontal and vertical on chart area
        if (deltaX !== 0) {
          managerRef.current.pan(deltaX);
          updateViewport(managerRef.current.getViewport());
        }
        if (deltaY !== 0) {
          managerRef.current.panVertical(deltaY);
        }
      }
      
      lastMousePosRef.current = { x: event.clientX, y: event.clientY };
    },
    [isPanning, isPanningOnScale, updateViewport],
  );

  const handleMouseUp = useCallback((): void => {
    setIsPanning(false);
    setIsPanningOnScale(false);
    lastMousePosRef.current = null;
  }, []);

  const handleMouseLeave = useCallback((): void => {
    setIsPanning(false);
    setIsPanningOnScale(false);
    lastMousePosRef.current = null;
  }, []);

  return {
    canvasRef,
    manager,
    viewport,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  };
};
