import { Box } from '@chakra-ui/react';
import type { Candle, ChartColors, Viewport } from '@shared/types';
import { CHART_COLORS_DARK } from '@shared/constants';
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { useChartCanvas } from './useChartCanvas';
import { useCandlestickRenderer } from './useCandlestickRenderer';
import { useGridRenderer } from './useGridRenderer';
import { useVolumeRenderer } from './useVolumeRenderer';

export interface ChartCanvasProps {
  candles: Candle[];
  width?: string | number;
  height?: string | number;
  initialViewport?: Viewport;
  onViewportChange?: (viewport: Viewport) => void;
  colors?: ChartColors;
  showGrid?: boolean;
  showVolume?: boolean;
}

export const ChartCanvas = ({
  candles,
  width = '100%',
  height = '600px',
  initialViewport,
  onViewportChange,
  colors = CHART_COLORS_DARK,
  showGrid = true,
  showVolume = true,
}: ChartCanvasProps): ReactElement => {
  const {
    canvasRef,
    manager,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  } = useChartCanvas({
    candles,
    ...(initialViewport !== undefined && { initialViewport }),
    ...(onViewportChange !== undefined && { onViewportChange }),
  });

  const { render: renderGrid } = useGridRenderer({
    manager,
    colors,
    enabled: showGrid,
  });

  const { render: renderCandles } = useCandlestickRenderer({
    manager,
    colors,
  });

  const { render: renderVolume } = useVolumeRenderer({
    manager,
    colors,
    enabled: showVolume,
  });

  useEffect(() => {
    if (!manager) return;

    const render = (): void => {
      manager.clear();
      renderGrid();
      renderVolume();
      renderCandles();
    };

    render();
  }, [manager, renderGrid, renderVolume, renderCandles]);

  return (
    <Box
      position="relative"
      width={width}
      height={height}
      overflow="hidden"
      bg="gray.900"
      borderRadius="md"
    >
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
          width: '100%',
          height: '100%',
          cursor: 'crosshair',
          display: 'block',
        }}
      />
    </Box>
  );
};
