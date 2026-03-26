import type { Kline, MarketEvent } from '@marketmind/types';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useCallback, useMemo } from 'react';
import { buildSessionWindows } from './useSessionBoundariesRenderer';
import { getSessionById } from '@shared/constants/marketSessions';

interface ORBZone {
  sessionId: string;
  high: number;
  low: number;
  mid: number;
  orbEndTimestamp: number;
  sessionCloseTimestamp: number;
  color: string;
  shortName: string;
}

export interface UseORBRendererProps {
  manager: CanvasManager | null;
  colors: ChartThemeColors;
  enabled?: boolean;
  marketEvents: MarketEvent[];
  orbPeriodMinutes?: number;
}

export interface UseORBRendererReturn {
  render: () => void;
}

const ORB_FILL_ALPHA = 0.08;
const ORB_LINE_ALPHA = 0.6;
const ORB_MID_ALPHA = 0.3;
const ORB_LINE_DASH: number[] = [6, 3];
const ORB_MID_DASH: number[] = [2, 4];
const ORB_LABEL_FONT = '9px sans-serif';

const getIntervalMinutes = (klines: Kline[]): number => {
  if (klines.length < 2) return 0;
  const first = klines[0]!;
  const second = klines[1]!;
  const firstTime = typeof first.openTime === 'number' ? first.openTime : new Date(first.openTime).getTime();
  const secondTime = typeof second.openTime === 'number' ? second.openTime : new Date(second.openTime).getTime();
  return (secondTime - firstTime) / 60_000;
};

const buildORBZones = (
  events: MarketEvent[],
  klines: Kline[],
  orbPeriodMinutes: number,
): ORBZone[] => {
  const windows = buildSessionWindows(events);
  const intervalMinutes = getIntervalMinutes(klines);

  if (intervalMinutes <= 0) return [];

  const effectivePeriod = Math.max(orbPeriodMinutes, intervalMinutes);
  const orbPeriodMs = effectivePeriod * 60_000;
  const zones: ORBZone[] = [];

  for (const win of windows) {
    const orbEndTs = win.openTimestamp + orbPeriodMs;
    let high = -Infinity;
    let low = Infinity;
    let found = false;

    for (const kline of klines) {
      const openTime = typeof kline.openTime === 'number' ? kline.openTime : new Date(kline.openTime).getTime();
      if (openTime < win.openTimestamp) continue;
      if (openTime >= orbEndTs) break;

      const kHigh = typeof kline.high === 'number' ? kline.high : Number(kline.high);
      const kLow = typeof kline.low === 'number' ? kline.low : Number(kline.low);
      if (kHigh > high) high = kHigh;
      if (kLow < low) low = kLow;
      found = true;
    }

    if (!found) continue;

    const session = getSessionById(win.sessionId);
    const shortName = session?.shortName ?? win.sessionId;

    zones.push({
      sessionId: win.sessionId,
      high,
      low,
      mid: (high + low) / 2,
      orbEndTimestamp: orbEndTs,
      sessionCloseTimestamp: win.closeTimestamp,
      color: win.color,
      shortName,
    });
  }

  return zones;
};

export const useORBRenderer = ({
  manager,
  colors: _colors,
  enabled = true,
  marketEvents,
  orbPeriodMinutes = 15,
}: UseORBRendererProps): UseORBRendererReturn => {
  const klines = manager?.getKlines() ?? [];
  const intervalMinutes = getIntervalMinutes(klines);
  const isTimeframeSupported = intervalMinutes > 0 && intervalMinutes < 15;

  const orbZones = useMemo(
    () => (enabled && isTimeframeSupported ? buildORBZones(marketEvents, klines, orbPeriodMinutes) : []),
    [enabled, isTimeframeSupported, marketEvents, klines, orbPeriodMinutes],
  );

  const render = useCallback((): void => {
    if (!manager || !enabled || orbZones.length === 0) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    if (!ctx || !dimensions) return;

    const managerKlines = manager.getKlines();
    if (managerKlines.length < 2) return;

    const firstKline = managerKlines[0]!;
    const lastKline = managerKlines[managerKlines.length - 1]!;
    const firstTime = typeof firstKline.openTime === 'number' ? firstKline.openTime : new Date(firstKline.openTime).getTime();
    const lastTime = typeof lastKline.openTime === 'number' ? lastKline.openTime : new Date(lastKline.openTime).getTime();
    const intervalMs = (lastTime - firstTime) / (managerKlines.length - 1);

    const { chartWidth, chartHeight } = dimensions;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartWidth, chartHeight);
    ctx.clip();

    for (const zone of orbZones) {
      const orbStartX = manager.timestampToX(zone.orbEndTimestamp, intervalMs);
      const sessionEndX = manager.timestampToX(zone.sessionCloseTimestamp, intervalMs);

      const leftX = Math.min(orbStartX, sessionEndX);
      const rightX = Math.max(orbStartX, sessionEndX);

      if (rightX < 0 || leftX > chartWidth) continue;

      const clampedLeft = Math.max(0, leftX);
      const clampedRight = Math.min(chartWidth, rightX);
      const drawWidth = clampedRight - clampedLeft;
      if (drawWidth <= 0) continue;

      const highY = manager.priceToY(zone.high);
      const lowY = manager.priceToY(zone.low);
      const midY = manager.priceToY(zone.mid);

      if (highY > chartHeight && lowY > chartHeight) continue;
      if (highY < 0 && lowY < 0) continue;

      const topY = Math.min(highY, lowY);
      const bottomY = Math.max(highY, lowY);
      const zoneHeight = bottomY - topY;

      ctx.globalAlpha = ORB_FILL_ALPHA;
      ctx.fillStyle = zone.color;
      ctx.fillRect(clampedLeft, topY, drawWidth, zoneHeight);

      ctx.globalAlpha = ORB_LINE_ALPHA;
      ctx.strokeStyle = zone.color;
      ctx.lineWidth = 1;
      ctx.setLineDash(ORB_LINE_DASH);

      ctx.beginPath();
      ctx.moveTo(clampedLeft, highY);
      ctx.lineTo(clampedRight, highY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(clampedLeft, lowY);
      ctx.lineTo(clampedRight, lowY);
      ctx.stroke();

      ctx.globalAlpha = ORB_MID_ALPHA;
      ctx.setLineDash(ORB_MID_DASH);
      ctx.beginPath();
      ctx.moveTo(clampedLeft, midY);
      ctx.lineTo(clampedRight, midY);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.globalAlpha = ORB_LINE_ALPHA;
      ctx.font = ORB_LABEL_FONT;
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'left';
      ctx.fillStyle = zone.color;
      const labelX = clampedLeft + 3;
      ctx.fillText(`ORB ${zone.shortName}`, labelX, topY - 2);
    }

    ctx.restore();
  }, [manager, enabled, orbZones]);

  return { render };
};
