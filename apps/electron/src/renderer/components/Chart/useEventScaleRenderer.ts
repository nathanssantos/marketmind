import type { MarketEvent } from '@marketmind/types';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useCallback, useMemo, useRef } from 'react';
import { createEventScaleRenderer } from './renderers/EventScaleRenderer';

export interface UseEventScaleRendererProps {
  manager: CanvasManager | null;
  events: MarketEvent[];
  colors: ChartThemeColors;
  enabled?: boolean;
}

export interface UseEventScaleRendererReturn {
  render: () => void;
  getEventAtPosition: (x: number, y: number) => MarketEvent | null;
}

export const useEventScaleRenderer = ({
  manager,
  events,
  colors,
  enabled = true,
}: UseEventScaleRendererProps): UseEventScaleRendererReturn => {
  const rendererRef = useRef<ReturnType<typeof createEventScaleRenderer> | null>(null);

  const renderer = useMemo(() => {
    rendererRef.current = createEventScaleRenderer({
      backgroundColor: colors.background,
      borderColor: colors.axisLine,
    });
    return rendererRef.current;
  }, [colors.background, colors.axisLine]);

  const render = useCallback((): void => {
    if (!manager || !enabled || events.length === 0) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    if (!ctx || !dimensions) return;

    const eventRowHeight = manager.getEventRowHeight();
    if (eventRowHeight === 0) return;

    const eventRowY = manager.getEventRowY();
    const { chartWidth } = dimensions;

    renderer.render(ctx, manager, events, eventRowY, chartWidth);
  }, [manager, events, enabled, renderer]);

  const getEventAtPosition = useCallback(
    (x: number, y: number): MarketEvent | null => {
      if (!rendererRef.current) return null;
      return rendererRef.current.getEventAtPosition(x, y);
    },
    [],
  );

  return { render, getEventAtPosition };
};
