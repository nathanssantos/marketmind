import type { Kline, MarketEvent } from '@marketmind/types';
import { getSessionById } from '@shared/constants/marketSessions';
import { buildSessionWindows } from '@renderer/components/Chart/useSessionBoundariesRenderer';
import type { GenericRenderer } from './types';
import { getInstanceParam } from './types';

const ORB_FILL_ALPHA = 0.08;
const ORB_LINE_ALPHA = 0.6;
const ORB_MID_ALPHA = 0.3;
const ORB_LINE_DASH: number[] = [6, 3];
const ORB_MID_DASH: number[] = [2, 4];
const ORB_LABEL_FONT = '9px sans-serif';
const ORB_LABEL_X_TOLERANCE = 30;
const ORB_LABEL_Y_TOLERANCE = 14;
const DEFAULT_ORB_PERIOD_MINUTES = 15;

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

const getIntervalMinutes = (klines: Kline[]): number => {
  if (klines.length < 2) return 0;
  const first = klines[0]!;
  const second = klines[1]!;
  const firstTime = typeof first.openTime === 'number' ? first.openTime : new Date(first.openTime).getTime();
  const secondTime = typeof second.openTime === 'number' ? second.openTime : new Date(second.openTime).getTime();
  return (secondTime - firstTime) / 60_000;
};

const buildORBZones = (events: MarketEvent[], klines: Kline[], orbPeriodMinutes: number): ORBZone[] => {
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

export const renderORB: GenericRenderer = (ctx, input) => {
  const { manager, external } = ctx;
  const events = external?.marketEvents;
  if (!events || events.length === 0) return;

  const klines = manager.getKlines();
  if (!klines || klines.length < 2) return;

  const intervalMinutes = getIntervalMinutes(klines);
  if (intervalMinutes <= 0 || intervalMinutes >= 15) return;

  const orbPeriodMinutes =
    (getInstanceParam<number>(input.instance, input.definition, 'orbPeriodMinutes') ??
      DEFAULT_ORB_PERIOD_MINUTES) as number;

  const zones = buildORBZones(events, klines, orbPeriodMinutes);
  if (zones.length === 0) return;

  const dimensions = manager.getDimensions();
  const canvasCtx = manager.getContext();
  if (!canvasCtx || !dimensions) return;

  const firstKline = klines[0]!;
  const lastKline = klines[klines.length - 1]!;
  const firstTime = typeof firstKline.openTime === 'number' ? firstKline.openTime : new Date(firstKline.openTime).getTime();
  const lastTime = typeof lastKline.openTime === 'number' ? lastKline.openTime : new Date(lastKline.openTime).getTime();
  const intervalMs = (lastTime - firstTime) / (klines.length - 1);

  const { chartWidth, chartHeight } = dimensions;

  canvasCtx.save();
  canvasCtx.beginPath();
  canvasCtx.rect(0, 0, chartWidth, chartHeight);
  canvasCtx.clip();

  const labelGroups: { x: number; y: number; names: string[]; color: string }[] = [];

  for (const zone of zones) {
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

    canvasCtx.globalAlpha = ORB_FILL_ALPHA;
    canvasCtx.fillStyle = zone.color;
    canvasCtx.fillRect(clampedLeft, topY, drawWidth, zoneHeight);

    canvasCtx.globalAlpha = ORB_LINE_ALPHA;
    canvasCtx.strokeStyle = zone.color;
    canvasCtx.lineWidth = 1;
    canvasCtx.setLineDash(ORB_LINE_DASH);

    canvasCtx.beginPath();
    canvasCtx.moveTo(clampedLeft, highY);
    canvasCtx.lineTo(clampedRight, highY);
    canvasCtx.stroke();

    canvasCtx.beginPath();
    canvasCtx.moveTo(clampedLeft, lowY);
    canvasCtx.lineTo(clampedRight, lowY);
    canvasCtx.stroke();

    canvasCtx.globalAlpha = ORB_MID_ALPHA;
    canvasCtx.setLineDash(ORB_MID_DASH);
    canvasCtx.beginPath();
    canvasCtx.moveTo(clampedLeft, midY);
    canvasCtx.lineTo(clampedRight, midY);
    canvasCtx.stroke();

    const labelX = clampedLeft + 3;
    const labelY = topY - 2;
    const existing = labelGroups.find(
      (g) => Math.abs(g.x - labelX) < ORB_LABEL_X_TOLERANCE && Math.abs(g.y - labelY) < ORB_LABEL_Y_TOLERANCE,
    );
    if (existing) {
      if (!existing.names.includes(zone.shortName)) existing.names.push(zone.shortName);
    } else {
      labelGroups.push({ x: labelX, y: labelY, names: [zone.shortName], color: zone.color });
    }
  }

  canvasCtx.setLineDash([]);
  canvasCtx.globalAlpha = ORB_LINE_ALPHA;
  canvasCtx.font = ORB_LABEL_FONT;
  canvasCtx.textBaseline = 'bottom';
  canvasCtx.textAlign = 'left';
  for (const group of labelGroups) {
    canvasCtx.fillStyle = group.color;
    canvasCtx.fillText(`ORB ${group.names.join(' / ')}`, group.x, group.y);
  }

  canvasCtx.restore();
};
