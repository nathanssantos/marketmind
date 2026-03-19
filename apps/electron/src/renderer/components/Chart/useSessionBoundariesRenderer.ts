import type { MarketEvent } from '@marketmind/types';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useCallback, useMemo } from 'react';
import { getSessionById } from '@shared/constants/marketSessions';

interface SessionWindow {
  sessionId: string;
  openTimestamp: number;
  closeTimestamp: number;
  color: string;
}

export interface UseSessionBoundariesRendererProps {
  manager: CanvasManager | null;
  colors: ChartThemeColors;
  enabled?: boolean;
  marketEvents: MarketEvent[];
}

export interface UseSessionBoundariesRendererReturn {
  render: () => void;
}

const SESSION_LINE_ALPHA = 0.35;
const SESSION_LINE_DASH = [6, 4];
const OVERLAP_ALPHA_PER_SESSION = 0.02;

const buildSessionWindows = (events: MarketEvent[]): SessionWindow[] => {
  const opensBySession = new Map<string, MarketEvent[]>();
  const windows: SessionWindow[] = [];

  for (const event of events) {
    const sessionId = event.metadata?.['sessionId'] as string | undefined;
    if (!sessionId || event.type !== 'market_open') continue;
    const list = opensBySession.get(sessionId) ?? [];
    list.push(event);
    opensBySession.set(sessionId, list);
  }

  for (const event of events) {
    const sessionId = event.metadata?.['sessionId'] as string | undefined;
    if (!sessionId || event.type !== 'market_close') continue;

    const session = getSessionById(sessionId);
    if (!session) continue;

    const opens = opensBySession.get(sessionId);
    if (!opens) continue;

    let bestOpen: MarketEvent | undefined;
    for (const o of opens) {
      if (o.timestamp < event.timestamp && (!bestOpen || o.timestamp > bestOpen.timestamp)) bestOpen = o;
    }

    if (bestOpen) {
      windows.push({
        sessionId,
        openTimestamp: bestOpen.timestamp,
        closeTimestamp: event.timestamp,
        color: session.color ?? '#888888',
      });
    }
  }

  return windows;
};

export const useSessionBoundariesRenderer = ({
  manager,
  colors: _colors,
  enabled = true,
  marketEvents,
}: UseSessionBoundariesRendererProps): UseSessionBoundariesRendererReturn => {
  const sessionWindows = useMemo(() => buildSessionWindows(marketEvents), [marketEvents]);

  const render = useCallback((): void => {
    if (!manager || !enabled || sessionWindows.length === 0) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    if (!ctx || !dimensions) return;

    const klines = manager.getKlines();
    if (klines.length < 2) return;

    const firstKline = klines[0]!;
    const lastKline = klines[klines.length - 1]!;
    const firstTime = typeof firstKline.openTime === 'number' ? firstKline.openTime : new Date(firstKline.openTime).getTime();
    const lastTime = typeof lastKline.openTime === 'number' ? lastKline.openTime : new Date(lastKline.openTime).getTime();
    const intervalMs = (lastTime - firstTime) / (klines.length - 1);

    const { chartWidth, chartHeight } = dimensions;

    ctx.save();

    const drawnLines = new Set<number>();

    for (const win of sessionWindows) {
      const openX = manager.timestampToX(win.openTimestamp, intervalMs);
      const closeX = manager.timestampToX(win.closeTimestamp, intervalMs);

      ctx.strokeStyle = win.color;
      ctx.globalAlpha = SESSION_LINE_ALPHA;
      ctx.lineWidth = 1;
      ctx.setLineDash(SESSION_LINE_DASH);

      const roundedOpenX = Math.round(openX);
      if (roundedOpenX >= 0 && roundedOpenX <= chartWidth && !drawnLines.has(roundedOpenX)) {
        drawnLines.add(roundedOpenX);
        ctx.beginPath();
        ctx.moveTo(openX, 0);
        ctx.lineTo(openX, chartHeight);
        ctx.stroke();
      }

      const roundedCloseX = Math.round(closeX);
      if (roundedCloseX >= 0 && roundedCloseX <= chartWidth && !drawnLines.has(roundedCloseX)) {
        drawnLines.add(roundedCloseX);
        ctx.beginPath();
        ctx.moveTo(closeX, 0);
        ctx.lineTo(closeX, chartHeight);
        ctx.stroke();
      }
    }

    ctx.setLineDash([]);

    const pixelCoverage = new Uint8Array(chartWidth);

    for (const win of sessionWindows) {
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
        ctx.globalAlpha = OVERLAP_ALPHA_PER_SESSION * currentCount;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(batchStart, 0, i - batchStart, chartHeight);
      } else {
        i++;
      }
    }

    ctx.restore();
  }, [manager, enabled, sessionWindows]);

  return { render };
};
