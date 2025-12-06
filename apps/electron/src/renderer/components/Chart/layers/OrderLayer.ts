import type { Viewport } from '@shared/types';
import type { Order } from '@shared/types/trading';
import { getOrderPrice, getOrderType, isOrderLong, isOrderPending } from '@shared/utils';

export interface OrderLayerConfig {
  longColor?: string;
  shortColor?: string;
  pendingOpacity?: number;
  lineWidth?: number;
  showLabels?: boolean;
  fontSize?: number;
}

export const createOrderRenderer = (
  orders: Order[],
  config: OrderLayerConfig = {},
  theme: { bullish: string; bearish: string; text: string }
) => {
  const {
    longColor = theme.bullish,
    shortColor = theme.bearish,
    pendingOpacity = 0.5,
    lineWidth = 2,
    showLabels = true,
    fontSize = 12,
  } = config;

  return (ctx: CanvasRenderingContext2D, viewport: Viewport) => {
    if (orders.length === 0) return;

    const { width, height, priceMin, priceMax } = viewport;

    ctx.save();
    ctx.lineWidth = lineWidth;
    ctx.font = `${fontSize}px sans-serif`;

    orders.forEach((order) => {
      const price = getOrderPrice(order);
      const isLong = isOrderLong(order);
      const isPending = isOrderPending(order);
      const orderType = getOrderType(order);

      if (price < priceMin || price > priceMax) return;

      const y = height - ((price - priceMin) / (priceMax - priceMin)) * height;

      const color = isLong ? longColor : shortColor;
      ctx.strokeStyle = color;
      ctx.globalAlpha = isPending ? pendingOpacity : 1;

      ctx.setLineDash(isPending ? [5, 5] : []);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();

      if (showLabels) {
        const label = `${orderType} ${price.toFixed(2)}`;
        const padding = 4;
        const textMetrics = ctx.measureText(label);
        const textWidth = textMetrics.width;
        const textHeight = fontSize;

        ctx.fillStyle = color;
        ctx.globalAlpha = isPending ? pendingOpacity * 0.8 : 0.8;
        ctx.fillRect(
          width - textWidth - padding * 2,
          y - textHeight / 2 - padding,
          textWidth + padding * 2,
          textHeight + padding * 2
        );

        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 1;
        ctx.fillText(label, width - textWidth - padding, y + fontSize / 3);
      }
    });

    ctx.restore();
  };
};
