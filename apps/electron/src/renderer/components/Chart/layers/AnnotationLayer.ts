import type { Viewport } from '@shared/types';

export interface SetupMarker {
  klineIndex: number;
  price: number;
  type: 'ENTRY' | 'EXIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
  direction: 'LONG' | 'SHORT';
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
    stopLossColor = '#ef4444',
    takeProfitColor = '#10b981',
    markerSize = 8,
    showLabels = true,
    fontSize = 11,
  } = config;

  return (ctx: CanvasRenderingContext2D, viewport: Viewport) => {
    if (markers.length === 0) return;

    const { width, height, priceMin, priceMax, start, end } = viewport;

    ctx.save();
    ctx.font = `${fontSize}px sans-serif`;

    markers.forEach((marker) => {
      if (marker.klineIndex < start || marker.klineIndex > end) return;
      if (marker.price < priceMin || marker.price > priceMax) return;

      const x = ((marker.klineIndex - start) / (end - start)) * width;
      const y = height - ((marker.price - priceMin) / (priceMax - priceMin)) * height;

      let color: string;
      let shape: 'triangle-up' | 'triangle-down' | 'circle' | 'square';

      switch (marker.type) {
        case 'ENTRY':
          color = marker.direction === 'LONG' ? entryColor : exitColor;
          shape = marker.direction === 'LONG' ? 'triangle-up' : 'triangle-down';
          break;
        case 'EXIT':
          color = marker.direction === 'LONG' ? exitColor : entryColor;
          shape = marker.direction === 'LONG' ? 'triangle-down' : 'triangle-up';
          break;
        case 'STOP_LOSS':
          color = stopLossColor;
          shape = 'square';
          break;
        case 'TAKE_PROFIT':
          color = takeProfitColor;
          shape = 'circle';
          break;
      }

      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      ctx.beginPath();
      switch (shape) {
        case 'triangle-up':
          ctx.moveTo(x, y - markerSize);
          ctx.lineTo(x - markerSize, y + markerSize);
          ctx.lineTo(x + markerSize, y + markerSize);
          break;
        case 'triangle-down':
          ctx.moveTo(x, y + markerSize);
          ctx.lineTo(x - markerSize, y - markerSize);
          ctx.lineTo(x + markerSize, y - markerSize);
          break;
        case 'circle':
          ctx.arc(x, y, markerSize, 0, Math.PI * 2);
          break;
        case 'square':
          ctx.rect(x - markerSize, y - markerSize, markerSize * 2, markerSize * 2);
          break;
      }
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

        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 1;
        ctx.fillText(marker.label, x + markerSize + 4 + padding, y + fontSize / 3);
      }
    });

    ctx.restore();
  };
};
