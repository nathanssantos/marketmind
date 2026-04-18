import { INDICATOR_COLORS } from '@shared/constants';
import { buildSessionWindows } from '@renderer/components/Chart/useSessionBoundariesRenderer';
import type { GenericRenderer } from './types';

const SESSION_LINE_ALPHA = 0.35;
const SESSION_LINE_DASH = [6, 4];
const OVERLAP_ALPHA_PER_SESSION = 0.02;

export const renderSessionBoundaries: GenericRenderer = (ctx) => {
  const { manager, external } = ctx;
  const events = external?.marketEvents;
  if (!events || events.length === 0) return;

  const windows = buildSessionWindows(events);
  if (windows.length === 0) return;

  const dimensions = manager.getDimensions();
  const canvasCtx = manager.getContext();
  if (!canvasCtx || !dimensions) return;

  const klines = manager.getKlines();
  if (klines.length < 2) return;

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

  const drawnLines = new Set<number>();

  for (const win of windows) {
    const openX = manager.timestampToX(win.openTimestamp, intervalMs);
    const closeX = manager.timestampToX(win.closeTimestamp, intervalMs);

    canvasCtx.strokeStyle = win.color;
    canvasCtx.globalAlpha = SESSION_LINE_ALPHA;
    canvasCtx.lineWidth = 1;
    canvasCtx.setLineDash(SESSION_LINE_DASH);

    const roundedOpenX = Math.round(openX);
    if (roundedOpenX >= 0 && roundedOpenX <= chartWidth && !drawnLines.has(roundedOpenX)) {
      drawnLines.add(roundedOpenX);
      canvasCtx.beginPath();
      canvasCtx.moveTo(openX, 0);
      canvasCtx.lineTo(openX, chartHeight);
      canvasCtx.stroke();
    }

    const roundedCloseX = Math.round(closeX);
    if (roundedCloseX >= 0 && roundedCloseX <= chartWidth && !drawnLines.has(roundedCloseX)) {
      drawnLines.add(roundedCloseX);
      canvasCtx.beginPath();
      canvasCtx.moveTo(closeX, 0);
      canvasCtx.lineTo(closeX, chartHeight);
      canvasCtx.stroke();
    }
  }

  canvasCtx.setLineDash([]);

  const pixelCoverage = new Uint8Array(chartWidth);

  for (const win of windows) {
    const openX = manager.timestampToX(win.openTimestamp, intervalMs);
    const closeX = manager.timestampToX(win.closeTimestamp, intervalMs);

    const startPx = Math.max(0, Math.floor(Math.min(openX, closeX)));
    const endPx = Math.min(chartWidth, Math.ceil(Math.max(openX, closeX)));

    for (let px = startPx; px < endPx; px++) pixelCoverage[px]!++;
  }

  let i = 0;
  while (i < chartWidth) {
    const count = pixelCoverage[i]!;
    if (count >= 2) {
      const currentCount = count;
      const batchStart = i;
      while (i < chartWidth && pixelCoverage[i] === currentCount) i++;
      canvasCtx.globalAlpha = OVERLAP_ALPHA_PER_SESSION * currentCount;
      canvasCtx.fillStyle = INDICATOR_COLORS.LABEL_TEXT;
      canvasCtx.fillRect(batchStart, 0, i - batchStart, chartHeight);
    } else {
      i++;
    }
  }

  canvasCtx.restore();
};
