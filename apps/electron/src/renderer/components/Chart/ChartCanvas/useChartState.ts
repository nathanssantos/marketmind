import type { Kline, Viewport } from '@marketmind/types';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

export interface OrderPreview {
  price: number;
  type: 'long' | 'short';
}

export interface ChartState {
  orderToClose: string | null;
}

type ChartAction = { type: 'SET_ORDER_TO_CLOSE'; payload: string | null };

const initialState: ChartState = { orderToClose: null };

const chartReducer = (state: ChartState, action: ChartAction): ChartState => {
  switch (action.type) {
    case 'SET_ORDER_TO_CLOSE':
      return { ...state, orderToClose: action.payload };
    default:
      return state;
  }
};

export interface UseChartStateProps {
  klines: Kline[];
  viewport?: Viewport;
}

export interface UseChartStateResult {
  state: ChartState;
  actions: {
    setOrderToClose: (orderId: string | null) => void;
  };
  refs: {
    mousePosition: React.MutableRefObject<{ x: number; y: number } | null>;
    orderPreview: React.MutableRefObject<OrderPreview | null>;
    hoveredMAIndex: React.MutableRefObject<number | undefined>;
    hoveredOrderId: React.MutableRefObject<string | null>;
    lastHoveredOrder: React.MutableRefObject<string | null>;
    interactionTimeout: React.MutableRefObject<NodeJS.Timeout | null>;
    cursor: React.MutableRefObject<'crosshair' | 'ns-resize' | 'grab' | 'grabbing' | 'pointer'>;
    mouseMoveRaf: React.MutableRefObject<number | null>;
    pendingMouseEvent: React.MutableRefObject<{ x: number; y: number; rect: DOMRect } | null>;
  };
}

export const useChartState = (_props: UseChartStateProps): UseChartStateResult => {
  const [state, dispatch] = useReducer(chartReducer, initialState);

  const mousePositionRef = useRef<{ x: number; y: number } | null>(null);
  const orderPreviewRef = useRef<OrderPreview | null>(null);
  const hoveredMAIndexRef = useRef<number | undefined>(undefined);
  const hoveredOrderIdRef = useRef<string | null>(null);
  const lastHoveredOrderRef = useRef<string | null>(null);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cursorRef = useRef<'crosshair' | 'ns-resize' | 'grab' | 'grabbing' | 'pointer'>('crosshair');
  const mouseMoveRafRef = useRef<number | null>(null);
  const pendingMouseEventRef = useRef<{ x: number; y: number; rect: DOMRect } | null>(null);

  const actions = useMemo(
    () => ({
      setOrderToClose: (orderId: string | null) =>
        dispatch({ type: 'SET_ORDER_TO_CLOSE', payload: orderId }),
    }),
    []
  );

  const refs = useMemo(
    () => ({
      mousePosition: mousePositionRef,
      orderPreview: orderPreviewRef,
      hoveredMAIndex: hoveredMAIndexRef,
      hoveredOrderId: hoveredOrderIdRef,
      lastHoveredOrder: lastHoveredOrderRef,
      interactionTimeout: interactionTimeoutRef,
      cursor: cursorRef,
      mouseMoveRaf: mouseMoveRafRef,
      pendingMouseEvent: pendingMouseEventRef,
    }),
    []
  );

  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
        interactionTimeoutRef.current = null;
      }
      if (mouseMoveRafRef.current !== null) {
        cancelAnimationFrame(mouseMoveRafRef.current);
        mouseMoveRafRef.current = null;
      }
    };
  }, []);

  return { state, actions, refs };
};

export interface CursorManager {
  getCursor: () => 'crosshair' | 'ns-resize' | 'grab' | 'grabbing' | 'pointer';
  setCursor: (cursor: 'crosshair' | 'ns-resize' | 'grab' | 'grabbing' | 'pointer') => void;
}

export const useCursorManager = (
  canvasRef: React.RefObject<HTMLCanvasElement | null>
): CursorManager => {
  const cursorRef = useRef<'crosshair' | 'ns-resize' | 'grab' | 'grabbing' | 'pointer'>('crosshair');

  const getCursor = useCallback(() => cursorRef.current, []);

  const setCursor = useCallback(
    (newCursor: 'crosshair' | 'ns-resize' | 'grab' | 'grabbing' | 'pointer') => {
      if (cursorRef.current !== newCursor) {
        cursorRef.current = newCursor;
        if (canvasRef.current) {
          canvasRef.current.style.cursor = newCursor;
        }
      }
    },
    [canvasRef]
  );

  return { getCursor, setCursor };
};
