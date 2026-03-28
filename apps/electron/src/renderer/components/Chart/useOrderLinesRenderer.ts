import type { Order, TradingSetup } from '@marketmind/types';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { getKlineClose, getOrderId, isOrderActive, isOrderPending } from '@shared/utils';
import { ORDER_LINE_ANIMATION } from '@shared/constants';
import type { RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { useOrderFlashStore } from '@renderer/store/orderFlashStore';

import type {
  BackendExecution,
  OrderCloseButton,
  OrderHitbox,
  SLTPHitbox,
  SLTPCloseButton,
  SlTpButtonHitbox,
  TrailingStopLineConfig,
  GroupedPosition,
} from './orderLineTypes';
import {
  getClickedOrderId as hitTestGetClickedOrderId,
  getOrderAtPosition as hitTestGetOrderAtPosition,
  getHoveredOrder as hitTestGetHoveredOrder,
  getSLTPAtPosition as hitTestGetSLTPAtPosition,
  getSlTpButtonAtPosition as hitTestGetSlTpButtonAtPosition,
} from './orderLineHitTest';
import type { RenderContext } from './orderLineRenderSections';
import {
  groupActivePositions,
  renderPendingOrders,
  renderHoveredPendingOrder,
  renderPositions,
  renderHoveredPosition,
  renderPositionSLTP,
  renderPendingSetups,
  renderTrailingStops,
  renderLiquidationLines,
  renderPriceTags,
} from './orderLineRenderSections';

export type { BackendExecution, TrailingStopLineConfig } from './orderLineTypes';
export type { PendingSetup } from './orderLineTypes';

export const useOrderLinesRenderer = (
  manager: CanvasManager | null,
  hasTradingEnabled: boolean,
  hoveredOrderIdRef: RefObject<string | null>,
  backendExecutions: BackendExecution[] = [],
  pendingSetups: TradingSetup[] = [],
  showProfitLossAreas: boolean = true,
  orderLoadingMapRef?: RefObject<Map<string, number>>,
  orderFlashMapRef?: RefObject<Map<string, number>>,
  trailingStopConfig?: TrailingStopLineConfig | null,
  draggedOrderIdRef?: RefObject<string | null>
) => {
  const activeOrders = useMemo((): Order[] => {
    return backendExecutions
      .filter(exec => exec.status === 'open' || exec.status === 'pending')
      .map(exec => {
        const openedTime = exec.openedAt
          ? (typeof exec.openedAt === 'string' ? new Date(exec.openedAt).getTime() : exec.openedAt.getTime())
          : null;
        const validOpenedTime = openedTime && openedTime > 1000000000000 ? openedTime : null;
        const openedAtTime = validOpenedTime || Date.now();
        return {
          id: exec.id,
          symbol: exec.symbol,
          orderId: '0',
          orderListId: '-1',
          clientOrderId: exec.id,
          price: exec.entryPrice,
          origQty: exec.quantity,
          executedQty: exec.status === 'pending' ? '0' : exec.quantity,
          cummulativeQuoteQty: '0',
          status: exec.status === 'pending' ? 'NEW' as const : 'FILLED' as const,
          timeInForce: 'GTC' as const,
          type: (exec.entryOrderType ?? (exec.status === 'pending' ? 'LIMIT' : 'MARKET')) as Order['type'],
          side: exec.side === 'LONG' ? 'BUY' : 'SELL',
          time: openedAtTime,
          updateTime: Date.now(),
          isWorking: true,
          origQuoteOrderQty: '0',
          entryPrice: parseFloat(exec.entryPrice),
          quantity: parseFloat(exec.quantity),
          orderDirection: exec.side === 'LONG' ? 'long' : 'short',
          stopLoss: exec.stopLoss ? parseFloat(exec.stopLoss) : undefined,
          takeProfit: exec.takeProfit ? parseFloat(exec.takeProfit) : undefined,
          isAutoTrade: !!exec.setupType,
          walletId: '',
          setupType: exec.setupType ?? undefined,
          isPendingLimitOrder: exec.status === 'pending',
          leverage: exec.leverage ?? 1,
          liquidationPrice: exec.liquidationPrice ? parseFloat(exec.liquidationPrice) : undefined,
        } as Order;
      });
  }, [backendExecutions]);

  const closeButtonsRef = useRef<OrderCloseButton[]>([]);
  const orderHitboxesRef = useRef<OrderHitbox[]>([]);
  const sltpHitboxesRef = useRef<SLTPHitbox[]>([]);
  const sltpCloseButtonsRef = useRef<SLTPCloseButton[]>([]);
  const slTpButtonHitboxesRef = useRef<SlTpButtonHitbox[]>([]);
  const tsCloseButtonsRef = useRef<Array<{ x: number; y: number; size: number }>>([]);

  const renderOrderLines = (): boolean => {
    const hasOrders = activeOrders.length > 0;
    const hasPendingSetups = pendingSetups.filter(s => s.visible).length > 0;
    if (!manager || (!hasOrders && !hasPendingSetups)) return false;
    if (!hasTradingEnabled && activeOrders.length === 0 && !hasPendingSetups) return false;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const klines = manager.getKlines();
    if (!ctx || !dimensions || !klines.length) return false;

    const { chartWidth, chartHeight } = dimensions;
    const lastKline = klines[klines.length - 1];
    if (!lastKline) return false;

    const currentPrice = getKlineClose(lastKline);
    const now = performance.now();

    closeButtonsRef.current = [];
    orderHitboxesRef.current = [];
    sltpHitboxesRef.current = [];
    sltpCloseButtonsRef.current = [];
    slTpButtonHitboxesRef.current = [];
    tsCloseButtonsRef.current = [];

    const rc: RenderContext = {
      ctx,
      manager,
      chartWidth,
      chartHeight,
      klines,
      currentPrice,
      now,
      isOrderLoading: (orderId: string) => orderLoadingMapRef?.current?.has(orderId) ?? false,
      getFlashAlpha: (orderId: string) => {
        const localFlashTime = orderFlashMapRef?.current?.get(orderId);
        const storeFlashTime = useOrderFlashStore.getState().getFlashTime(orderId);
        const flashTime = Math.max(localFlashTime ?? 0, storeFlashTime ?? 0) || 0;
        if (!flashTime) return 0;
        const elapsed = now - flashTime;
        if (elapsed >= ORDER_LINE_ANIMATION.FLASH_DURATION_MS) {
          orderFlashMapRef?.current?.delete(orderId);
          if (storeFlashTime) useOrderFlashStore.getState().clearFlash(orderId);
          return 0;
        }
        rc.needsAnimation = true;
        return (1 - elapsed / ORDER_LINE_ANIMATION.FLASH_DURATION_MS) * 0.6;
      },
      priceTags: [],
      closeButtons: closeButtonsRef.current,
      orderHitboxes: orderHitboxesRef.current,
      sltpHitboxes: sltpHitboxesRef.current,
      sltpCloseButtons: sltpCloseButtonsRef.current,
      slTpButtonHitboxes: slTpButtonHitboxesRef.current,
      tsCloseButtons: tsCloseButtonsRef.current,
      needsAnimation: false,
      showProfitLossAreas,
    };

    const pendingOrders = activeOrders.filter((order) => isOrderPending(order));
    const activeOrdersList = activeOrders.filter((order) => isOrderActive(order));

    const hoveredOrderId = hoveredOrderIdRef.current;
    const pendingOrdersToRender = hoveredOrderId
      ? pendingOrders.filter(o => getOrderId(o) !== hoveredOrderId)
      : pendingOrders;
    const hoveredPendingOrder = hoveredOrderId
      ? pendingOrders.find(o => getOrderId(o) === hoveredOrderId)
      : null;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartWidth, chartHeight);
    ctx.clip();

    const groupedPositions = groupActivePositions(activeOrdersList, currentPrice);

    renderPendingOrders(rc, pendingOrdersToRender);

    let hoveredPosition: GroupedPosition | null = null;
    const positionsToRender: GroupedPosition[] = [];
    const allPositions: GroupedPosition[] = [];

    groupedPositions.forEach((position) => {
      allPositions.push(position);
      const isHovered = hoveredOrderId && position.orderIds.includes(hoveredOrderId);
      if (isHovered) {
        hoveredPosition = position;
      } else {
        positionsToRender.push(position);
      }
    });

    renderPositions(rc, positionsToRender);

    const isDraggedOrder = hoveredPendingOrder && draggedOrderIdRef?.current === getOrderId(hoveredPendingOrder);
    if (hoveredPendingOrder && !isDraggedOrder) {
      renderHoveredPendingOrder(rc, hoveredPendingOrder);
    }

    if (hoveredPosition) {
      renderHoveredPosition(rc, hoveredPosition);
    }

    renderPositionSLTP(rc, allPositions);
    renderPendingSetups(rc, pendingSetups);

    ctx.restore();

    if (trailingStopConfig?.enabled) {
      renderTrailingStops(rc, activeOrders, trailingStopConfig);
    }

    renderLiquidationLines(rc, allPositions);
    renderPriceTags(rc);

    if (orderLoadingMapRef?.current) {
      for (const loading of orderLoadingMapRef.current.values()) {
        if (loading) { rc.needsAnimation = true; break; }
      }
    }

    return rc.needsAnimation;
  };

  const getClickedOrderId = (x: number, y: number): string | null =>
    hitTestGetClickedOrderId(x, y, tsCloseButtonsRef.current, sltpCloseButtonsRef.current, closeButtonsRef.current);

  const getOrderAtPosition = (x: number, y: number): Order | null =>
    hitTestGetOrderAtPosition(x, y, manager, hasTradingEnabled, orderHitboxesRef.current);

  const getHoveredOrder = (x: number, y: number): Order | null =>
    hitTestGetHoveredOrder(x, y, orderHitboxesRef.current);

  const getSLTPAtPosition = (x: number, y: number): { orderId: string; type: 'stopLoss' | 'takeProfit'; price: number } | null =>
    hitTestGetSLTPAtPosition(x, y, sltpHitboxesRef.current);

  const getSlTpButtonAtPosition = (x: number, y: number): { executionId: string; type: 'stopLoss' | 'takeProfit' } | null =>
    hitTestGetSlTpButtonAtPosition(x, y, slTpButtonHitboxesRef.current);

  return { renderOrderLines, getClickedOrderId, getOrderAtPosition, getHoveredOrder, getSLTPAtPosition, getSlTpButtonAtPosition };
};
