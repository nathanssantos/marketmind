import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';

export interface OscillatorSetup {
  ctx: CanvasRenderingContext2D;
  chartWidth: number;
  panelTop: number;
  panelHeight: number;
  visibleStart: number;
  visibleEnd: number;
  klineWidth: number;
  indexToX: (i: number) => number;
  flipped: boolean;
}

export const getOscillatorSetup = (
  manager: CanvasManager | null,
  enabled: boolean,
  panelId: string,
): OscillatorSetup | null => {
  if (!manager || !enabled) return null;

  const ctx = manager.getContext();
  const dimensions = manager.getDimensions();
  const viewport = manager.getViewport();
  const panelInfo = manager.getPanelInfo(panelId);

  if (!ctx || !dimensions || !panelInfo) return null;

  const { chartWidth } = dimensions;
  const { y: panelTop, height: panelHeight } = panelInfo;
  const visibleStart = Math.floor(viewport.start);
  const visibleEnd = Math.ceil(viewport.end);
  const klineWidth = chartWidth / (viewport.end - viewport.start);

  return {
    ctx,
    chartWidth,
    panelTop,
    panelHeight,
    visibleStart,
    visibleEnd,
    klineWidth,
    indexToX: (i: number) => (i - viewport.start) * klineWidth + klineWidth / 2,
    flipped: manager.isFlipped(),
  };
};
