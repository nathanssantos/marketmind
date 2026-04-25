import type { PositionSide, Viewport } from '@marketmind/types';
import { ORDER_LINE_COLORS } from '@shared/constants/chartColors';

export interface SetupMarker {
  klineIndex: number;
  price: number;
  type: 'ENTRY' | 'EXIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
  direction: PositionSide;
  label?: string;
}

export interface AnnotationLayerConfig {
  entryColor?: string;
  exitColor?: string;
  stopLossColor?: string;
  takeProfitColor?: string;
  markerSize?: number;
  showLabels?: boolean;
  fontSize?: number;
}

export const createSetupMarkerRenderer = (
  markers: SetupMarker[],
  config: AnnotationLayerConfig = {},
  theme: { bullish: string; bearish: string; text: string }
) => {
  const {
    entryColor = theme.bullish,
    exitColor = theme.bearish,
    stopLossColor = ORDER_LINE_COLORS.SL_LOSS_LINE,
    takeProfitColor = ORDER_LINE_COLORS.TP_LINE,
    markerSize = 8,
    showLabels = true,
    fontSize = 11,
  } = config;

  return (ctx: CanvasRenderingContext2D, viewport: Viewport) => {
    if (markers.length === 0) return;

    const { width, height, priceMin, priceMax, start, end } = viewport;

    ctx.save();
    ctx.font = `${fontSize}px sans-serif`;

    const markerStyleHandlers: Record<
      SetupMarker['type'],
      (marker: SetupMarker) => { color: string; shape: 'triangle-up' | 'triangle-down' | 'circle' | 'square' }
    > = {
      ENTRY: (marker) => ({
        color: marker.direction === 'LONG' ? entryColor : exitColor,
        shape: marker.direction === 'LONG' ? 'triangle-up' : 'triangle-down',
      }),
      EXIT: (marker) => ({
        color: marker.direction === 'LONG' ? exitColor : entryColor,
        shape: marker.direction === 'LONG' ? 'triangle-down' : 'triangle-up',
      }),
      STOP_LOSS: () => ({
        color: stopLossColor,
        shape: 'square' as const,
      }),
      TAKE_PROFIT: () => ({
        color: takeProfitColor,
        shape: 'circle' as const,
      }),
    };

    const shapeDrawHandlers: Record<
      'triangle-up' | 'triangle-down' | 'circle' | 'square',
      (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => void
    > = {
      'triangle-up': (ctx, x, y, size) => {
        ctx.moveTo(x, y - size);
        ctx.lineTo(x - size, y + size);
        ctx.lineTo(x + size, y + size);
      },
      'triangle-down': (ctx, x, y, size) => {
        ctx.moveTo(x, y + size);
        ctx.lineTo(x - size, y - size);
        ctx.lineTo(x + size, y - size);
      },
      circle: (ctx, x, y, size) => {
        ctx.arc(x, y, size, 0, Math.PI * 2);
      },
      square: (ctx, x, y, size) => {
        ctx.rect(x - size, y - size, size * 2, size * 2);
      },
    };

    markers.forEach((marker) => {
      if (marker.klineIndex < start || marker.klineIndex > end) return;
      if (marker.price < priceMin || marker.price > priceMax) return;

      const x = ((marker.klineIndex - start) / (end - start)) * width;
      const y = height - ((marker.price - priceMin) / (priceMax - priceMin)) * height;

      const handler = markerStyleHandlers[marker.type];
      if (!handler) return;
      
      const { color, shape } = handler(marker);

      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      ctx.beginPath();
      shapeDrawHandlers[shape](ctx, x, y, markerSize);
      ctx.closePath();
      ctx.fill();

      if (showLabels && marker.label) {
        const textMetrics = ctx.measureText(marker.label);
        const padding = 4;

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(
          x + markerSize + 4,
          y - fontSize / 2 - padding,
          textMetrics.width + padding * 2,
          fontSize + padding * 2
        );

        ctx.fillStyle = ORDER_LINE_COLORS.TEXT_WHITE;
        ctx.globalAlpha = 1;
        ctx.fillText(marker.label, x + markerSize + 4 + padding, y + fontSize / 3);
      }
    });

    ctx.restore();
  };
};
