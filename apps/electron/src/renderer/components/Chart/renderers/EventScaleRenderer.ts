import type { MarketEvent } from '@marketmind/types';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { getEventIconManager } from '@renderer/services/calendar';
import { CHART_CONFIG } from '@shared/constants';

export interface EventScaleRendererOptions {
  backgroundColor: string;
  borderColor: string;
}

interface EventHitbox {
  event: MarketEvent;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EventScaleRendererReturn {
  render: (ctx: CanvasRenderingContext2D, manager: CanvasManager, events: MarketEvent[], eventRowY: number, chartWidth: number) => void;
  getEventAtPosition: (x: number, y: number) => MarketEvent | null;
}

export const createEventScaleRenderer = (options: EventScaleRendererOptions): EventScaleRendererReturn => {
  const { backgroundColor, borderColor } = options;
  const iconManager = getEventIconManager();
  let hitboxes: EventHitbox[] = [];

  const render = (
    ctx: CanvasRenderingContext2D,
    manager: CanvasManager,
    events: MarketEvent[],
    eventRowY: number,
    chartWidth: number,
  ): void => {
    hitboxes = [];

    if (events.length === 0) return;

    const klines = manager.getKlines();
    if (klines.length === 0) return;

    const firstKline = klines[0];
    const lastKline = klines[klines.length - 1];

    if (!firstKline || !lastKline) return;

    const firstKlineTime = typeof firstKline.openTime === 'number'
      ? firstKline.openTime
      : new Date(firstKline.openTime).getTime();
    const lastKlineTime = typeof lastKline.openTime === 'number'
      ? lastKline.openTime
      : new Date(lastKline.openTime).getTime();

    const intervalMs = klines.length > 1
      ? (lastKlineTime - firstKlineTime) / (klines.length - 1)
      : 60000;

    ctx.save();

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, eventRowY, chartWidth, CHART_CONFIG.EVENT_ROW_HEIGHT);

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, eventRowY);
    ctx.lineTo(chartWidth, eventRowY);
    ctx.stroke();

    const iconSize = CHART_CONFIG.EVENT_ICON_SIZE;
    const iconY = eventRowY + CHART_CONFIG.EVENT_ROW_HEIGHT / 2;
    const minIconSpacing = iconSize + 4;

    const visibleEvents: Array<{ event: MarketEvent; x: number }> = [];

    for (const event of events) {
      const eventIndex = manager.timestampToIndex(event.timestamp, intervalMs);
      const x = manager.indexToCenterX(eventIndex);

      if (x < 0 || x > chartWidth) continue;

      visibleEvents.push({ event, x });
    }

    const priorityOrder: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };
    visibleEvents.sort((a, b) => a.x - b.x || (priorityOrder[b.event.priority] ?? 0) - (priorityOrder[a.event.priority] ?? 0));

    let lastDrawnX = -Infinity;

    for (const { event, x } of visibleEvents) {
      if (x - lastDrawnX < minIconSpacing) continue;

      const drawn = iconManager.drawIcon(ctx, event.icon, x, iconY, iconSize);

      if (drawn) {
        lastDrawnX = x;
        hitboxes.push({
          event,
          x: x - iconSize / 2,
          y: eventRowY,
          width: iconSize,
          height: CHART_CONFIG.EVENT_ROW_HEIGHT,
        });
      }
    }

    ctx.restore();
  };

  const getEventAtPosition = (x: number, y: number): MarketEvent | null => {
    for (const hitbox of hitboxes) {
      if (
        x >= hitbox.x &&
        x <= hitbox.x + hitbox.width &&
        y >= hitbox.y &&
        y <= hitbox.y + hitbox.height
      ) {
        return hitbox.event;
      }
    }
    return null;
  };

  return { render, getEventAtPosition };
};
