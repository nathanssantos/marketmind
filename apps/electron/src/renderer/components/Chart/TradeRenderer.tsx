import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { Order } from '@marketmind/types';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isOrderActive, isOrderLong, getOrderPrice, getOrderQuantity } from '@shared/utils';

interface TradeRendererProps {
  canvasManager: CanvasManager | null;
  orders: Order[];
  currentSymbol: string;
  width: number;
  height: number;
  mousePosition: { x: number; y: number } | null;
  onTradeHover: (order: Order | null) => void;
}

const TRADE_TAG_FONT = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
const TRADE_TAG_PADDING = 3;
const LINE_WIDTH = 1.5;
const DASH_PATTERN = [5, 5];
const HIT_THRESHOLD = 8;
const TRIANGLE_SIZE = 6;
const CIRCLE_RADIUS = 4;
const DEFAULT_ALPHA = 0.8;
const HOVER_ALPHA = 1;
const CONNECTION_ALPHA = 0.5;
const TAG_OFFSET_Y = 12;
const TEXT_HEIGHT = 14;
const HALF_DIVISOR = 2;

const TRADE_COLORS = {
  LONG: {
    profit: '#22c55e',
    loss: '#ef4444',
    pending: '#f59e0b',
    entry: '#22c55e',
    stopLoss: '#ef4444',
    takeProfit: '#3b82f6',
  },
  SHORT: {
    profit: '#22c55e',
    loss: '#ef4444',
    pending: '#f59e0b',
    entry: '#ef4444',
    stopLoss: '#22c55e',
    takeProfit: '#3b82f6',
  },
} as const;

const getOrderPnl = (order: Order): number => {
  if (typeof order.pnl === 'string') return parseFloat(order.pnl) || 0;
  if (typeof order.pnl === 'number') return order.pnl;
  return 0;
};

const getOrderDirection = (order: Order): 'LONG' | 'SHORT' => {
  return isOrderLong(order) ? 'LONG' : 'SHORT';
};

export const TradeRenderer = ({
  canvasManager,
  orders,
  currentSymbol,
  width,
  height,
  mousePosition,
  onTradeHover,
}: TradeRendererProps): ReactElement => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredOrder, setHoveredOrder] = useState<Order | null>(null);
  const tradeTagsRef = useRef<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());
  const lastHoveredIdRef = useRef<string | null>(null);

  const relevantOrders = orders.filter(
    (o) => o.symbol === currentSymbol && (isOrderActive(o) || o.closedAt)
  );

  const checkTagHit = useCallback(
    (tagBounds: { x: number; y: number; width: number; height: number } | undefined, mouseX: number, mouseY: number): boolean => {
      if (!tagBounds) return false;
      return mouseX >= tagBounds.x && mouseX <= tagBounds.x + tagBounds.width && mouseY >= tagBounds.y && mouseY <= tagBounds.y + tagBounds.height;
    },
    []
  );

  const getOrderTime = (order: Order): number | null => {
    const filledAt = order.filledAt;
    const createdAt = order.createdAt;
    if (filledAt instanceof Date) return filledAt.getTime();
    if (createdAt instanceof Date) return createdAt.getTime();
    return null;
  };

  const checkTradeHit = useCallback(
    (order: Order, mouseX: number, mouseY: number, manager: CanvasManager): boolean => {
      const entryPrice = getOrderPrice(order);
      const entryTime = getOrderTime(order);
      if (!entryTime) return false;

      const entryIndex = manager.timeToIndex(entryTime);
      if (entryIndex < 0) return false;

      const x = manager.indexToCenterX(entryIndex);
      const y = manager.priceToY(entryPrice);

      return Math.abs(mouseX - x) < HIT_THRESHOLD && Math.abs(mouseY - y) < HIT_THRESHOLD;
    },
    []
  );

  useEffect(() => {
    if (!canvasManager || relevantOrders.length === 0 || !mousePosition) {
      const newId = null;
      if (lastHoveredIdRef.current !== newId) {
        lastHoveredIdRef.current = newId;
        setHoveredOrder(null);
        onTradeHover(null);
      }
      return;
    }

    const { x: mouseX, y: mouseY } = mousePosition;
    let found: Order | null = null;

    for (const order of relevantOrders) {
      if (!order.id) continue;
      const tagBounds = tradeTagsRef.current.get(order.id);
      if (checkTagHit(tagBounds, mouseX, mouseY)) {
        found = order;
        break;
      }

      if (checkTradeHit(order, mouseX, mouseY, canvasManager)) {
        found = order;
        break;
      }
    }

    const newId = found?.id ?? null;
    if (lastHoveredIdRef.current !== newId) {
      lastHoveredIdRef.current = newId;
      setHoveredOrder(found);
      onTradeHover(found);
    }
  }, [canvasManager, relevantOrders, mousePosition, onTradeHover, checkTagHit, checkTradeHit]);

  const drawTradeTag = useCallback(
    (ctx: CanvasRenderingContext2D, order: Order, x: number, y: number, color: string, isHovered: boolean): void => {
      if (!isHovered) return;

      ctx.font = TRADE_TAG_FONT;
      ctx.textBaseline = 'middle';

      const direction = getOrderDirection(order);
      const qty = getOrderQuantity(order);
      const price = getOrderPrice(order);
      const pnl = getOrderPnl(order);
      const pnlText = order.closedAt ? ` | ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}` : '';
      const text = `${direction} ${qty.toFixed(4)} @ ${price.toFixed(2)}${pnlText}`;

      const metrics = ctx.measureText(text);
      const textWidth = metrics.width;
      const boxWidth = textWidth + TRADE_TAG_PADDING * HALF_DIVISOR;
      const boxHeight = TEXT_HEIGHT + TRADE_TAG_PADDING;

      const tagX = x - boxWidth / HALF_DIVISOR;
      const tagY = direction === 'LONG' ? y - TAG_OFFSET_Y - boxHeight : y + TAG_OFFSET_Y;

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(tagX, tagY, boxWidth, boxHeight);

      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 1;
      ctx.fillText(text, tagX + TRADE_TAG_PADDING, tagY + boxHeight / HALF_DIVISOR);

      if (order.id) {
        tradeTagsRef.current.set(order.id, {
          x: tagX,
          y: tagY,
          width: boxWidth,
          height: boxHeight,
        });
      }
    },
    []
  );

  const drawTriangle = useCallback(
    (ctx: CanvasRenderingContext2D, x: number, y: number, direction: 'LONG' | 'SHORT', color: string): void => {
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = LINE_WIDTH;

      ctx.beginPath();
      if (direction === 'LONG') {
        ctx.moveTo(x, y - TRIANGLE_SIZE - 2);
        ctx.lineTo(x - TRIANGLE_SIZE, y);
        ctx.lineTo(x + TRIANGLE_SIZE, y);
      } else {
        ctx.moveTo(x, y + TRIANGLE_SIZE + 2);
        ctx.lineTo(x - TRIANGLE_SIZE, y);
        ctx.lineTo(x + TRIANGLE_SIZE, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    },
    []
  );

  const drawTrade = useCallback(
    (ctx: CanvasRenderingContext2D, order: Order, manager: CanvasManager, isHovered: boolean): void => {
      const entryPrice = getOrderPrice(order);
      const entryTime = getOrderTime(order);
      if (!entryTime) return;

      const entryIndex = manager.timeToIndex(entryTime);
      if (entryIndex < 0) return;

      const x = manager.indexToCenterX(entryIndex);
      const y = manager.priceToY(entryPrice);

      const direction = getOrderDirection(order);
      const colors = TRADE_COLORS[direction];
      const isActive = isOrderActive(order);
      const isClosed = !!order.closedAt;
      const pnl = getOrderPnl(order);

      let markerColor: string;
      if (isActive) {
        markerColor = colors.pending;
      } else if (pnl >= 0) {
        markerColor = colors.profit;
      } else {
        markerColor = colors.loss;
      }

      const alpha = isHovered ? HOVER_ALPHA : DEFAULT_ALPHA;
      ctx.globalAlpha = alpha;

      drawTriangle(ctx, x, y, direction, markerColor);

      const dimensions = manager.getDimensions();
      if (!dimensions) return;
      const chartRight = dimensions.chartWidth;

      if (isActive) {
        if (order.stopLoss) {
          const slY = manager.priceToY(order.stopLoss);
          ctx.strokeStyle = colors.stopLoss;
          ctx.lineWidth = 1;
          ctx.setLineDash(DASH_PATTERN);
          ctx.globalAlpha = alpha * 0.6;
          ctx.beginPath();
          ctx.moveTo(x, slY);
          ctx.lineTo(chartRight, slY);
          ctx.stroke();
        }

        if (order.takeProfit) {
          const tpY = manager.priceToY(order.takeProfit);
          ctx.strokeStyle = colors.takeProfit;
          ctx.lineWidth = 1;
          ctx.setLineDash(DASH_PATTERN);
          ctx.globalAlpha = alpha * 0.6;
          ctx.beginPath();
          ctx.moveTo(x, tpY);
          ctx.lineTo(chartRight, tpY);
          ctx.stroke();
        }

        ctx.setLineDash([]);
      }

      if (isClosed && order.closedAt instanceof Date) {
        const exitPrice = order.exitPrice || order.currentPrice || entryPrice;
        const exitTime = order.closedAt.getTime();
        const exitIndex = manager.timeToIndex(exitTime);

        if (exitIndex >= 0) {
          const exitX = manager.indexToCenterX(exitIndex);
          const exitY = manager.priceToY(exitPrice);

          ctx.strokeStyle = markerColor;
          ctx.lineWidth = 1;
          ctx.setLineDash(DASH_PATTERN);
          ctx.globalAlpha = CONNECTION_ALPHA;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(exitX, exitY);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = markerColor;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(exitX, exitY, CIRCLE_RADIUS, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      drawTradeTag(ctx, order, x, y, markerColor, isHovered);

      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    },
    [drawTriangle, drawTradeTag]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasManager) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (relevantOrders.length === 0) {
      return;
    }

    const dimensions = canvasManager.getDimensions();
    if (!dimensions) return;

    const clipWidth = dimensions.chartWidth;
    const clipHeight = dimensions.chartHeight;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, clipWidth, clipHeight);
    ctx.clip();

    tradeTagsRef.current.clear();

    relevantOrders.forEach((order) => {
      const isHovered = hoveredOrder?.id === order.id;
      drawTrade(ctx, order, canvasManager, isHovered);
    });

    ctx.restore();
  }, [canvasManager, relevantOrders, width, height, hoveredOrder, drawTrade]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 4,
      }}
    />
  );
};
