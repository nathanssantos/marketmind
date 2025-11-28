import { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG } from '@shared/constants';
import type { Candle, Viewport } from '@shared/types';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

const VIEWPORT_UPDATE_THROTTLE_MS = 16;
const DEFAULT_VISIBLE_CANDLES = 100;
const SIGNIFICANT_CHANGE_THRESHOLD = 0.1;

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
  
  const [viewport, setViewport] = useState<Viewport>(() => {
    if (initialViewport !== DEFAULT_VIEWPORT) {
      return initialViewport;
    }
    
    const candleCount = candles.length;
    const visibleCount = Math.min(DEFAULT_VISIBLE_CANDLES, candleCount);
    
    return {
      ...DEFAULT_VIEWPORT,
      start: Math.max(0, candleCount - visibleCount),
      end: candleCount,
    };
  });
  
  const [isPanning, setIsPanning] = useState(false);
  const [isPanningOnScale, setIsPanningOnScale] = useState(false);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const onViewportChangeRef = useRef(onViewportChange);
  const candlesLengthRef = useRef(candles.length);
  const lastViewportUpdateRef = useRef<number>(0);

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  useEffect(() => {
    candlesLengthRef.current = candles.length;
  }, [candles.length]);

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

  const prevCandleCountRef = useRef<number>(candles.length);
  const wasAtEndRef = useRef<boolean>(true);
  const prevFirstCandleTimestampRef = useRef<number>(candles[0]?.timestamp ?? 0);

  useEffect(() => {
    if (managerRef.current) {
      const prevCount = prevCandleCountRef.current;
      const currentCount = candles.length;
      const firstCandleTimestamp = candles[0]?.timestamp ?? 0;
      const prevFirstCandleTimestamp = prevFirstCandleTimestampRef.current;
      
      const currentViewport = managerRef.current.getViewport();
      const wasAtEnd = wasAtEndRef.current || Math.abs(currentViewport.end - prevCount) < 1;
      
      managerRef.current.setCandles(candles);
      
      const countDiffPercentage = Math.abs(currentCount - prevCount) / Math.max(prevCount, 1);
      const isSignificantChange = countDiffPercentage > SIGNIFICANT_CHANGE_THRESHOLD;
      const isCompleteDataChange = firstCandleTimestamp !== prevFirstCandleTimestamp && currentCount > 0;
      
      if (initialViewport === DEFAULT_VIEWPORT && (isSignificantChange || isCompleteDataChange)) {
        const visibleCount = Math.min(DEFAULT_VISIBLE_CANDLES, currentCount);
        
        const newViewport = {
          ...DEFAULT_VIEWPORT,
          start: Math.max(0, currentCount - visibleCount),
          end: currentCount,
        };
        
        setViewport(newViewport);
        managerRef.current.setViewport(newViewport);
        onViewportChange?.(newViewport);
        
        managerRef.current.resetVerticalZoom();
        wasAtEndRef.current = true;
      } else if (wasAtEnd && currentCount > prevCount && !isCompleteDataChange) {
        const candlesAdded = currentCount - prevCount;
        const newViewport = {
          ...currentViewport,
          start: currentViewport.start + candlesAdded,
          end: currentCount,
        };
        
        setViewport(newViewport);
        managerRef.current.setViewport(newViewport);
        onViewportChange?.(newViewport);
        wasAtEndRef.current = true;
      } else {
        wasAtEndRef.current = Math.abs(currentViewport.end - currentCount) < 1;
      }
      
      prevCandleCountRef.current = currentCount;
      prevFirstCandleTimestampRef.current = firstCandleTimestamp;
    }
  }, [candles]);

  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.setViewport(viewport);
    }
  }, [viewport]);

  const updateViewport = useCallback(
    (newViewport: Viewport): void => {
      setViewport(newViewport);
      onViewportChangeRef.current?.(newViewport);
    },
    [],
  );

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
      const wasAtEndBeforeZoom = wasAtEndRef.current;

      managerRef.current.zoom(delta, mouseX);
      let newViewport = managerRef.current.getViewport();
      
      if (wasAtEndBeforeZoom) {
        const visibleRange = newViewport.end - newViewport.start;
        newViewport = {
          ...newViewport,
          start: candles.length - visibleRange,
          end: candles.length,
        };
        managerRef.current.setViewport(newViewport);
        wasAtEndRef.current = true;
      } else {
        wasAtEndRef.current = Math.abs(newViewport.end - candles.length) < 1;
      }
      
      updateViewport(newViewport);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [updateViewport, candles.length]);

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
        managerRef.current.zoomVertical(deltaY);
      } else {
        if (deltaX !== 0) {
          managerRef.current.pan(deltaX);
          
          const now = Date.now();
          const timeSinceLastUpdate = now - lastViewportUpdateRef.current;
          
          if (timeSinceLastUpdate > VIEWPORT_UPDATE_THROTTLE_MS) {
            const newViewport = managerRef.current.getViewport();
            updateViewport(newViewport);
            wasAtEndRef.current = Math.abs(newViewport.end - candlesLengthRef.current) < 1;
            lastViewportUpdateRef.current = now;
          }
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
