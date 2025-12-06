import type { Kline, Viewport } from '@shared/types';
import type { Order } from '@shared/types/trading';
import { useMemo } from 'react';
import type { LayerConfig } from '../core/LayeredCanvas';
import { createSetupMarkerRenderer, type SetupMarker } from '../layers/AnnotationLayer';
import { createGridRenderer } from '../layers/GridLayer';
import { createIndicatorRenderer } from '../layers/IndicatorLayer';
import { createCrosshairRenderer } from '../layers/InteractionLayer';
import { createKlineRenderer } from '../layers/KlineLayer';
import { createOrderRenderer } from '../layers/OrderLayer';

export interface UseChartLayersProps {
  klines: Kline[];
  viewport: Viewport;
  theme: {
    grid: string;
    text: string;
    bullish: string;
    bearish: string;
    background: string;
    crosshair: string;
  };
  showGrid?: boolean;
  showVolume?: boolean;
  showIndicators?: boolean;
  showOrders?: boolean;
  showCrosshair?: boolean;
  showSetups?: boolean;
  movingAverages?: Array<{ period: number; color: string; type?: 'SMA' | 'EMA' }>;
  orders?: Order[];
  setupMarkers?: SetupMarker[];
  mousePosition?: { x: number; y: number } | null;
}

export const useChartLayers = ({
  klines,
  viewport: _viewport,
  theme,
  showGrid = true,
  showVolume = false,
  showIndicators = false,
  showOrders = false,
  showCrosshair = false,
  showSetups = false,
  movingAverages = [],
  orders = [],
  setupMarkers = [],
  mousePosition = null,
}: UseChartLayersProps): LayerConfig[] => {
  const layers = useMemo(() => {
    const layerConfigs: LayerConfig[] = [];

    if (showGrid) {
      layerConfigs.push({
        id: 'grid',
        zIndex: 0,
        updateFrequency: 'static',
        renderer: createGridRenderer(klines, {}, theme),
      });
    }

    layerConfigs.push({
      id: 'klines',
      zIndex: 1,
      updateFrequency: 'medium',
      renderer: createKlineRenderer(klines, {}, theme),
    });

    if (showIndicators && movingAverages.length > 0) {
      layerConfigs.push({
        id: 'indicators',
        zIndex: 2,
        updateFrequency: 'medium',
        renderer: createIndicatorRenderer(klines, { movingAverages }),
      });
    }

    if (showOrders && orders.length > 0) {
      layerConfigs.push({
        id: 'orders',
        zIndex: 3,
        updateFrequency: 'low',
        renderer: createOrderRenderer(orders, {}, theme),
      });
    }

    if (showSetups && setupMarkers.length > 0) {
      layerConfigs.push({
        id: 'annotations',
        zIndex: 4,
        updateFrequency: 'low',
        renderer: createSetupMarkerRenderer(setupMarkers, {}, theme),
      });
    }

    if (showCrosshair) {
      layerConfigs.push({
        id: 'interaction',
        zIndex: 5,
        updateFrequency: 'high',
        renderer: createCrosshairRenderer(klines, mousePosition, {}, theme),
      });
    }

    return layerConfigs;
  }, [
    klines,
    theme,
    showGrid,
    showVolume,
    showIndicators,
    showOrders,
    showCrosshair,
    showSetups,
    movingAverages,
    orders,
    setupMarkers,
    mousePosition,
  ]);

  return layers;
};
