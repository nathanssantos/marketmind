import type { Kline, MarketEvent } from '@marketmind/types';
import { getSessionById } from '@shared/constants/marketSessions';
import { buildSessionWindows } from './sessionWindows';
import { drawZoneArea } from './drawZoneArea';
import type { GenericRenderer } from './types';
import { getInstanceParam } from './types';

const ORB_FILL_ALPHA = 0.08;
const ORB_LINE_ALPHA = 0.6;
const ORB_MID_ALPHA = 0.3;
const ORB_LINE_DASH: number[] = [6, 3];
const ORB_MID_DASH: number[] = [2, 4];
const ORB_LABEL_FONT = '9px sans-serif';
const DEFAULT_ORB_PERIOD_MINUTES = 15;
// Two sessions whose opening range captured the same candles produce
// identical price bands (e.g. TSE / ASX overlap). They are merged into a
// single zone so the area and label share one color instead of stacking
// two differently-colored overlapping rectangles.
const ORB_PRICE_MERGE_RATIO = 0.0005;

// ORB uses its own palette (no red/green) so its zones are never confused
// with green/red area indicators like FVG. Session colors stay untouched
// for session boundaries and the session selector.
const ORB_PALETTE = [
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#A855F7',
  '#06B6D4',
  '#0EA5E9',
  '#F59E0B',
  '#EC4899',
] as const;

const hashSessionId = (sessionId: string): number => {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i += 1) hash = (hash * 31 + sessionId.charCodeAt(i)) >>> 0;
  return hash;
};

export const orbColorForSession = (sessionId: string): string =>
  ORB_PALETTE[hashSessionId(sessionId) % ORB_PALETTE.length]!;

export const ORB_PALETTE_COLORS: readonly string[] = ORB_PALETTE;

export interface ORBZone {
  sessionId: string;
  high: number;
  low: number;
  mid: number;
  orbEndTimestamp: number;
  sessionCloseTimestamp: number;
  color: string;
  shortName: string;
}

export interface MergedORBZone {
  high: number;
  low: number;
  mid: number;
  orbEndTimestamp: number;
  sessionCloseTimestamp: number;
  color: string;
  names: string[];
}

const pricesMatch = (a: number, b: number): boolean =>
  Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * ORB_PRICE_MERGE_RATIO;

const windowsOverlap = (a: MergedORBZone, b: ORBZone): boolean =>
  a.orbEndTimestamp <= b.sessionCloseTimestamp && b.orbEndTimestamp <= a.sessionCloseTimestamp;

export const mergeORBZones = (zones: ORBZone[]): MergedORBZone[] => {
  const merged: MergedORBZone[] = [];

  for (const zone of zones) {
    const target = merged.find(
      (m) => pricesMatch(m.high, zone.high) && pricesMatch(m.low, zone.low) && windowsOverlap(m, zone),
    );

    if (!target) {
      merged.push({
        high: zone.high,
        low: zone.low,
        mid: zone.mid,
        orbEndTimestamp: zone.orbEndTimestamp,
        sessionCloseTimestamp: zone.sessionCloseTimestamp,
        color: zone.color,
        names: [zone.shortName],
      });
      continue;
    }

    target.orbEndTimestamp = Math.min(target.orbEndTimestamp, zone.orbEndTimestamp);
    target.sessionCloseTimestamp = Math.max(target.sessionCloseTimestamp, zone.sessionCloseTimestamp);
    if (!target.names.includes(zone.shortName)) target.names.push(zone.shortName);
  }

  return merged;
};

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
      color: orbColorForSession(win.sessionId),
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
      DEFAULT_ORB_PERIOD_MINUTES);

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

  const labels: { x: number; y: number; names: string[]; color: string }[] = [];

  for (const zone of mergeORBZones(zones)) {
    const orbStartX = manager.timestampToX(zone.orbEndTimestamp, intervalMs);
    const sessionEndX = manager.timestampToX(zone.sessionCloseTimestamp, intervalMs);

    const leftX = Math.min(orbStartX, sessionEndX);
    const rightX = Math.max(orbStartX, sessionEndX);
    if (rightX < 0 || leftX > chartWidth) continue;

    const clampedLeft = Math.max(0, leftX);
    const clampedRight = Math.min(chartWidth, rightX);
    if (clampedRight - clampedLeft <= 0) continue;

    const highY = manager.priceToY(zone.high);
    const lowY = manager.priceToY(zone.low);
    const midY = manager.priceToY(zone.mid);
    if (highY > chartHeight && lowY > chartHeight) continue;
    if (highY < 0 && lowY < 0) continue;

    const topY = Math.min(highY, lowY);

    drawZoneArea(canvasCtx, {
      left: clampedLeft,
      right: clampedRight,
      topY: highY,
      bottomY: lowY,
      fillColor: zone.color,
      fillAlpha: ORB_FILL_ALPHA,
      borderColor: zone.color,
      borderAlpha: ORB_LINE_ALPHA,
      borderDash: ORB_LINE_DASH,
    });

    canvasCtx.globalAlpha = ORB_MID_ALPHA;
    canvasCtx.strokeStyle = zone.color;
    canvasCtx.lineWidth = 1;
    canvasCtx.setLineDash(ORB_MID_DASH);
    canvasCtx.beginPath();
    canvasCtx.moveTo(clampedLeft, midY);
    canvasCtx.lineTo(clampedRight, midY);
    canvasCtx.stroke();
    canvasCtx.setLineDash([]);

    labels.push({ x: clampedLeft + 3, y: topY - 2, names: zone.names, color: zone.color });
  }

  canvasCtx.globalAlpha = ORB_LINE_ALPHA;
  canvasCtx.font = ORB_LABEL_FONT;
  canvasCtx.textBaseline = 'bottom';
  canvasCtx.textAlign = 'left';
  for (const label of labels) {
    canvasCtx.fillStyle = label.color;
    canvasCtx.fillText(`ORB ${label.names.join(' / ')}`, label.x, label.y);
  }

  canvasCtx.restore();
};
