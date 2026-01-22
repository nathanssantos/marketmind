import type { Kline, MarketEvent, Order, TradingSetup, Viewport } from '@marketmind/types';
import type { StochasticResult } from '@marketmind/indicators';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { MovingAverageConfig } from '../useMovingAverageRenderer';

export interface TooltipData {
  kline: Kline | null;
  x: number;
  y: number;
  visible: boolean;
  containerWidth?: number;
  containerHeight?: number;
  klineIndex?: number;
  movingAverage?: {
    period: number;
    type: 'SMA' | 'EMA';
    color: string;
    value?: number;
  };
  measurement?: {
    klineCount: number;
    priceChange: number;
    percentChange: number;
    startPrice: number;
    endPrice: number;
  };
  order?: Order;
  currentPrice?: number;
  setup?: TradingSetup | null;
  marketEvent?: MarketEvent;
}

export interface MeasurementArea {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startIndex: number;
  endIndex: number;
}

export interface OrderPreview {
  price: number;
  type: 'long' | 'short';
}

export interface ChartState {
  tooltipData: TooltipData;
  measurementArea: MeasurementArea | null;
  isMeasuring: boolean;
  orderToClose: string | null;
  stochasticData: StochasticResult | null;
}

type ChartAction =
  | { type: 'SET_TOOLTIP'; payload: TooltipData }
  | { type: 'HIDE_TOOLTIP' }
  | { type: 'SET_MEASUREMENT_AREA'; payload: MeasurementArea | null }
  | { type: 'SET_IS_MEASURING'; payload: boolean }
  | { type: 'SET_ORDER_TO_CLOSE'; payload: string | null }
  | { type: 'SET_STOCHASTIC_DATA'; payload: StochasticResult | null };

const initialTooltipData: TooltipData = {
  kline: null,
  x: 0,
  y: 0,
  visible: false,
};

const initialState: ChartState = {
  tooltipData: initialTooltipData,
  measurementArea: null,
  isMeasuring: false,
  orderToClose: null,
  stochasticData: null,
};

const chartReducer = (state: ChartState, action: ChartAction): ChartState => {
  switch (action.type) {
    case 'SET_TOOLTIP':
      return { ...state, tooltipData: action.payload };
    case 'HIDE_TOOLTIP':
      return { ...state, tooltipData: initialTooltipData };
    case 'SET_MEASUREMENT_AREA':
      return { ...state, measurementArea: action.payload };
    case 'SET_IS_MEASURING':
      return { ...state, isMeasuring: action.payload };
    case 'SET_ORDER_TO_CLOSE':
      return { ...state, orderToClose: action.payload };
    case 'SET_STOCHASTIC_DATA':
      return { ...state, stochasticData: action.payload };
    default:
      return state;
  }
};

export interface UseChartStateProps {
  klines: Kline[];
  movingAverages?: MovingAverageConfig[];
  viewport?: Viewport;
}

export interface UseChartStateResult {
  state: ChartState;
  actions: {
    setTooltip: (data: TooltipData) => void;
    hideTooltip: () => void;
    setMeasurementArea: (area: MeasurementArea | null) => void;
    setIsMeasuring: (value: boolean) => void;
    setOrderToClose: (orderId: string | null) => void;
    setStochasticData: (data: StochasticResult | null) => void;
  };
  refs: {
    mousePosition: React.MutableRefObject<{ x: number; y: number } | null>;
    orderPreview: React.MutableRefObject<OrderPreview | null>;
    hoveredMAIndex: React.MutableRefObject<number | undefined>;
    hoveredOrderId: React.MutableRefObject<string | null>;
    lastHoveredOrder: React.MutableRefObject<string | null>;
    lastTooltipOrder: React.MutableRefObject<string | null>;
    interactionTimeout: React.MutableRefObject<NodeJS.Timeout | null>;
    cursor: React.MutableRefObject<'crosshair' | 'ns-resize' | 'grab' | 'grabbing' | 'pointer'>;
    mouseMoveRaf: React.MutableRefObject<number | null>;
    pendingMouseEvent: React.MutableRefObject<{ x: number; y: number; rect: DOMRect } | null>;
    tooltipEnabled: React.MutableRefObject<boolean>;
    tooltipDebounce: React.MutableRefObject<NodeJS.Timeout | null>;
  };
}

export const useChartState = (_props: UseChartStateProps): UseChartStateResult => {
  const [state, dispatch] = useReducer(chartReducer, initialState);

  const mousePositionRef = useRef<{ x: number; y: number } | null>(null);
  const orderPreviewRef = useRef<OrderPreview | null>(null);
  const hoveredMAIndexRef = useRef<number | undefined>(undefined);
  const hoveredOrderIdRef = useRef<string | null>(null);
  const lastHoveredOrderRef = useRef<string | null>(null);
  const lastTooltipOrderRef = useRef<string | null>(null);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cursorRef = useRef<'crosshair' | 'ns-resize' | 'grab' | 'grabbing' | 'pointer'>('crosshair');
  const mouseMoveRafRef = useRef<number | null>(null);
  const pendingMouseEventRef = useRef<{ x: number; y: number; rect: DOMRect } | null>(null);
  const tooltipEnabledRef = useRef(true);
  const tooltipDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const actions = useMemo(
    () => ({
      setTooltip: (data: TooltipData) => dispatch({ type: 'SET_TOOLTIP', payload: data }),
      hideTooltip: () => dispatch({ type: 'HIDE_TOOLTIP' }),
      setMeasurementArea: (area: MeasurementArea | null) =>
        dispatch({ type: 'SET_MEASUREMENT_AREA', payload: area }),
      setIsMeasuring: (value: boolean) => dispatch({ type: 'SET_IS_MEASURING', payload: value }),
      setOrderToClose: (orderId: string | null) =>
        dispatch({ type: 'SET_ORDER_TO_CLOSE', payload: orderId }),
      setStochasticData: (data: StochasticResult | null) =>
        dispatch({ type: 'SET_STOCHASTIC_DATA', payload: data }),
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
      lastTooltipOrder: lastTooltipOrderRef,
      interactionTimeout: interactionTimeoutRef,
      cursor: cursorRef,
      mouseMoveRaf: mouseMoveRafRef,
      pendingMouseEvent: pendingMouseEventRef,
      tooltipEnabled: tooltipEnabledRef,
      tooltipDebounce: tooltipDebounceRef,
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
      if (tooltipDebounceRef.current) {
        clearTimeout(tooltipDebounceRef.current);
        tooltipDebounceRef.current = null;
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
