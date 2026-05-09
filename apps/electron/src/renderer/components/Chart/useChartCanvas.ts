import { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { usePriceStore } from '@renderer/store/priceStore';
import { usePanActivityStore } from '@renderer/store/panActivityStore';
import { CHART_CONFIG } from '@shared/constants';
import { getKlineClose } from '@shared/utils';
import type { Kline, Viewport } from '@marketmind/types';
import type React from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

const VIEWPORT_UPDATE_THROTTLE_MS = 50;
const SIGNIFICANT_CHANGE_THRESHOLD = 0.5;
const NEAR_LEFT_EDGE_THRESHOLD = 100;

const calculateVisibleKlines = (): number => CHART_CONFIG.INITIAL_KLINES_VISIBLE;

export interface UseChartCanvasProps {
  klines: Kline[];
  symbol?: string;
  initialViewport?: Viewport;
  onViewportChange?: (viewport: Viewport) => void;
  onNearLeftEdge?: () => void;
}

export interface UseChartCanvasReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  manager: CanvasManager | null;
  viewport: Viewport;
  isPanning: boolean;
  handleMouseDown: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  handleMouseMove: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  handleMouseUp: () => void;
  handleMouseLeave: () => void;
}

const DEFAULT_VIEWPORT: Viewport = {
  start: 0,
  end: CHART_CONFIG.INITIAL_KLINES_VISIBLE,
  klineWidth: CHART_CONFIG.DEFAULT_KLINE_WIDTH,
  klineSpacing: CHART_CONFIG.KLINE_SPACING,
  width: 0,
  height: 0,
  priceMin: 0,
  priceMax: 0,
};

export const useChartCanvas = ({
  klines,
  symbol,
  initialViewport = DEFAULT_VIEWPORT,
  onViewportChange,
  onNearLeftEdge,
}: UseChartCanvasProps): UseChartCanvasReturn => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const managerRef = useRef<CanvasManager | null>(null);
  const [manager, setManager] = useState<CanvasManager | null>(null);
  
  const [viewport, setViewport] = useState<Viewport>(() => {
    if (initialViewport !== DEFAULT_VIEWPORT) {
      return initialViewport;
    }

    const klineCount = klines.length;
    const visibleCount = Math.min(calculateVisibleKlines(), klineCount);
    const futureSpace = Math.max(
      CHART_CONFIG.MIN_FUTURE_KLINES,
      Math.floor(visibleCount * CHART_CONFIG.INITIAL_FUTURE_EXTENSION),
    );

    return {
      ...DEFAULT_VIEWPORT,
      start: Math.max(0, klineCount - visibleCount),
      end: klineCount + futureSpace,
    };
  });
  
  const [isPanning, setIsPanning] = useState(false);
  const [isPanningOnScale, setIsPanningOnScale] = useState(false);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const onViewportChangeRef = useRef(onViewportChange);
  const klinesLengthRef = useRef(klines.length);
  const lastViewportUpdateRef = useRef<number>(0);

  const onNearLeftEdgeRef = useRef(onNearLeftEdge);

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  useEffect(() => {
    onNearLeftEdgeRef.current = onNearLeftEdge;
  }, [onNearLeftEdge]);

  useEffect(() => {
    klinesLengthRef.current = klines.length;
  }, [klines.length]);

  useEffect(() => {
    if (!canvasRef.current || managerRef.current) return;

    let initialVp = viewport;
    if (klines.length > 0) {
      const visibleCount = Math.min(calculateVisibleKlines(), klines.length);
      const futureSpace = Math.max(
        CHART_CONFIG.MIN_FUTURE_KLINES,
        Math.floor(visibleCount * CHART_CONFIG.INITIAL_FUTURE_EXTENSION),
      );
      initialVp = {
        ...DEFAULT_VIEWPORT,
        start: Math.max(0, klines.length - visibleCount),
        end: klines.length + futureSpace,
      };
      setViewport(initialVp);
      isInitialLoadRef.current = false;
    }

    const newManager = new CanvasManager(
      canvasRef.current,
      initialVp,
      CHART_CONFIG.CANVAS_PADDING,
    );
    newManager.setKlines(klines);
    managerRef.current = newManager;
    setManager(newManager);

    const handleResize = (): void => {
      if (managerRef.current) {
        managerRef.current.resize();
      }
    };

    let resizeRafId: number | null = null;
    const scheduleResize = (): void => {
      if (resizeRafId !== null) return;
      resizeRafId = requestAnimationFrame(() => {
        resizeRafId = null;
        handleResize();
      });
    };

    const resizeObserver = new ResizeObserver(scheduleResize);

    if (canvasRef.current.parentElement) {
      resizeObserver.observe(canvasRef.current.parentElement);
    }

    window.addEventListener('resize', scheduleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', scheduleResize);
      if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
      if (managerRef.current) {
        managerRef.current.destroy();
        managerRef.current = null;
        setManager(null);
      }
    };
  }, []);

  const prevKlineCountRef = useRef<number>(klines.length);
  const wasAtEndRef = useRef<boolean>(true);
  const prevFirstKlineTimestampRef = useRef<number>(klines[0]?.openTime ?? 0);
  const prevLastKlineTimestampRef = useRef<number>(klines[klines.length - 1]?.openTime ?? 0);
  const isInitialLoadRef = useRef<boolean>(true);

  useEffect(() => {
    if (managerRef.current) {
      const prevCount = prevKlineCountRef.current;
      const currentCount = klines.length;
      const firstKlineTimestamp = klines[0]?.openTime ?? 0;
      const prevFirstKlineTimestamp = prevFirstKlineTimestampRef.current;

      const currentViewport = managerRef.current.getViewport();
      const prevVisibleRange = currentViewport.end - currentViewport.start;
      const prevOffsetFromEnd = prevCount - currentViewport.end;
      const wasAtEnd = wasAtEndRef.current || Math.abs(prevOffsetFromEnd) < 1;

      managerRef.current.setKlines(klines);

      const countDiffPercentage = Math.abs(currentCount - prevCount) / Math.max(prevCount, 1);
      const isSignificantChange = countDiffPercentage > SIGNIFICANT_CHANGE_THRESHOLD && prevCount > 0;
      const isCompleteDataChange = firstKlineTimestamp !== prevFirstKlineTimestamp &&
        currentCount > 0 &&
        prevFirstKlineTimestamp > 0;

      const lastKlineTimestamp = klines[klines.length - 1]?.openTime ?? 0;
      const prevLastKlineTimestamp = prevLastKlineTimestampRef.current;
      const isPrepend = isCompleteDataChange &&
        firstKlineTimestamp < prevFirstKlineTimestamp &&
        lastKlineTimestamp === prevLastKlineTimestamp &&
        currentCount > prevCount;

      if (isPrepend) {
        const prependedCount = currentCount - prevCount;
        const currentVp = managerRef.current.getViewport();
        const shiftedViewport = {
          ...currentVp,
          start: currentVp.start + prependedCount,
          end: currentVp.end + prependedCount,
        };
        setViewport(shiftedViewport);
        managerRef.current.setViewport(shiftedViewport);
        onViewportChange?.(shiftedViewport);
      } else if (isInitialLoadRef.current && currentCount > 0) {
        const visibleCount = Math.min(calculateVisibleKlines(), currentCount);
        const futureSpace = Math.max(
          CHART_CONFIG.MIN_FUTURE_KLINES,
          Math.floor(visibleCount * CHART_CONFIG.INITIAL_FUTURE_EXTENSION),
        );
        const newViewport = {
          ...DEFAULT_VIEWPORT,
          start: Math.max(0, currentCount - visibleCount),
          end: currentCount + futureSpace,
        };

        setViewport(newViewport);
        managerRef.current.setViewport(newViewport);
        onViewportChange?.(newViewport);
        managerRef.current.resetVerticalZoom();
        wasAtEndRef.current = true;
        isInitialLoadRef.current = false;
      } else if (isCompleteDataChange || isSignificantChange) {
        if (prevCount > 0 && prevVisibleRange > 0 && !wasAtEnd) {
          const newEnd = currentCount - prevOffsetFromEnd;
          const newStart = newEnd - prevVisibleRange;
          managerRef.current.setViewport({
            ...currentViewport,
            start: Math.max(0, newStart),
            end: Math.max(newStart + 1, newEnd),
          });
          managerRef.current.resetForSymbolChange();
        } else {
          managerRef.current.resetToInitialView();
        }
        const newViewport = managerRef.current.getViewport();
        setViewport(newViewport);
        onViewportChange?.(newViewport);
        wasAtEndRef.current = wasAtEnd;
      } else if (wasAtEnd && currentCount > prevCount) {
        const klinesAdded = currentCount - prevCount;
        const visibleCount = Math.min(calculateVisibleKlines(), currentCount);
        const futureSpace = Math.max(
          CHART_CONFIG.MIN_FUTURE_KLINES,
          Math.floor(visibleCount * CHART_CONFIG.INITIAL_FUTURE_EXTENSION),
        );
        const newViewport = {
          ...currentViewport,
          start: currentViewport.start + klinesAdded,
          end: currentCount + futureSpace,
        };

        setViewport(newViewport);
        managerRef.current.setViewport(newViewport);
        onViewportChange?.(newViewport);
        wasAtEndRef.current = true;
      } else if (!wasAtEnd && currentCount > prevCount && !isPrepend && !isSignificantChange && !isCompleteDataChange) {
        const latestCandleVisible = currentViewport.end >= prevCount;
        if (latestCandleVisible) {
          const klinesAdded = currentCount - prevCount;
          const newViewport = {
            ...currentViewport,
            start: currentViewport.start + klinesAdded,
            end: currentViewport.end + klinesAdded,
          };
          setViewport(newViewport);
          managerRef.current.setViewport(newViewport);
          onViewportChange?.(newViewport);
        }
      } else {
        wasAtEndRef.current = Math.abs(currentViewport.end - currentCount) < 1;
      }

      if (symbol && currentCount > 0) {
        const lastKline = klines[currentCount - 1]!;
        const closePrice = getKlineClose(lastKline);
        if (closePrice > 0) usePriceStore.getState().updatePrice(symbol, closePrice, 'chart');
      }

      prevKlineCountRef.current = currentCount;
      prevFirstKlineTimestampRef.current = firstKlineTimestamp;
      prevLastKlineTimestampRef.current = klines[klines.length - 1]?.openTime ?? 0;
    }
  }, [klines, symbol]);

  const updateViewport = useCallback(
    (newViewport: Viewport): void => {
      setViewport(newViewport);
      onViewportChangeRef.current?.(newViewport);
    },
    [],
  );

  const notifyViewportChange = useCallback(
    (newViewport: Viewport): void => {
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

      // Read rect from the manager's ResizeObserver-maintained cache
      // instead of calling getBoundingClientRect on every wheel event.
      // The latter forces a synchronous layout reflow that competes
      // with the rAF tick during steady-state pan/zoom.
      const rect = managerRef.current.getCachedRect();
      if (!rect) return;

      const mouseX = event.clientX - rect.left;
      const delta = event.deltaY > 0 ? -1 : 1;
      const wasAtEndBeforeZoom = wasAtEndRef.current;
      const cursorNearRightEdge = mouseX >= rect.width * 0.95;

      managerRef.current.zoom(delta, mouseX);
      let newViewport = managerRef.current.getViewport();

      if (wasAtEndBeforeZoom && cursorNearRightEdge) {
        const visibleRange = newViewport.end - newViewport.start;
        newViewport = {
          ...newViewport,
          start: klines.length - visibleRange,
          end: klines.length,
        };
        managerRef.current.setViewport(newViewport);
        wasAtEndRef.current = true;
      } else {
        wasAtEndRef.current = Math.abs(newViewport.end - klines.length) < 1;
      }

      updateViewport(newViewport);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [updateViewport, klines.length]);

  // Stable per-mount id used as the key in the global pan-activity
  // store. Multiple charts can be panning independently — the store
  // tracks them as a Set so streams stay throttled until the LAST
  // chart releases its pan.
  const panSessionId = useId();

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Cached rect — see handleWheel above for why we avoid live
    // getBoundingClientRect during interaction.
    const rect = managerRef.current?.getCachedRect() ?? canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const dimensions = managerRef.current?.getDimensions();

    if (dimensions) {
      const priceScaleLeft = dimensions.width - CHART_CONFIG.CANVAS_PADDING_RIGHT;
      const isOverPriceScale = mouseX >= priceScaleLeft;

      setIsPanningOnScale(isOverPriceScale);
    }

    setIsPanning(true);
    lastMousePosRef.current = { x: event.clientX, y: event.clientY };
    // Tell the live-stream registry to back off — bookTicker / depth /
    // scalpingMetrics widen their throttle window by `panMultiplier`
    // until `endPan` fires below.
    usePanActivityStore.getState().beginPan(panSessionId);
  }, [panSessionId]);

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
            notifyViewportChange(newViewport);
            wasAtEndRef.current = Math.abs(newViewport.end - klinesLengthRef.current) < 1;
            lastViewportUpdateRef.current = now;

            if (newViewport.start < NEAR_LEFT_EDGE_THRESHOLD && onNearLeftEdgeRef.current) {
              onNearLeftEdgeRef.current();
            }
          }
        }
        if (deltaY !== 0) {
          managerRef.current.panVertical(deltaY);
        }
      }
      
      lastMousePosRef.current = { x: event.clientX, y: event.clientY };
    },
    [isPanning, isPanningOnScale, notifyViewportChange],
  );

  const handleMouseUp = useCallback((): void => {
    if (managerRef.current) {
      const newViewport = managerRef.current.getViewport();
      updateViewport(newViewport);
      wasAtEndRef.current = Math.abs(newViewport.end - klinesLengthRef.current) < 1;
    }
    setIsPanning(false);
    setIsPanningOnScale(false);
    lastMousePosRef.current = null;
    usePanActivityStore.getState().endPan(panSessionId);
  }, [updateViewport, panSessionId]);

  const handleMouseLeave = useCallback((): void => {
    if (managerRef.current) {
      const newViewport = managerRef.current.getViewport();
      updateViewport(newViewport);
      wasAtEndRef.current = Math.abs(newViewport.end - klinesLengthRef.current) < 1;
    }
    setIsPanning(false);
    setIsPanningOnScale(false);
    lastMousePosRef.current = null;
    usePanActivityStore.getState().endPan(panSessionId);
  }, [updateViewport, panSessionId]);

  // Safety net: if the chart unmounts mid-pan (panel closed, layout
  // switch, route change), release the pan flag so the registry
  // doesn't stay throttled forever.
  useEffect(() => {
    return () => {
      usePanActivityStore.getState().endPan(panSessionId);
    };
  }, [panSessionId]);

  return {
    canvasRef,
    manager,
    viewport,
    isPanning,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  };
};
