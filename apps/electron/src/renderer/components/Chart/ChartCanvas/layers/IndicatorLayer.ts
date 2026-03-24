import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { ChartColors } from '@renderer/hooks/useChartColors';
import type { MovingAverageConfig } from '../../useMovingAverageRenderer';

export interface IndicatorRenderFunctions {
  renderMovingAverages?: () => void;
  renderStochastic?: () => void;
  renderRSI?: () => void;
  renderRSI14?: () => void;
  renderBollingerBands?: () => void;
  renderATR?: () => void;
  renderDailyVWAP?: () => void;
  renderWeeklyVWAP?: () => void;
  renderVWAP?: () => void;
  renderParabolicSAR?: () => void;
  renderKeltner?: () => void;
  renderDonchian?: () => void;
  renderSupertrend?: () => void;
  renderIchimoku?: () => void;
  renderDEMA?: () => void;
  renderTEMA?: () => void;
  renderWMA?: () => void;
  renderHMA?: () => void;
  renderPivotPoints?: () => void;
  renderFibonacci?: () => void;
  renderFVG?: () => void;
  renderLiquidityLevels?: () => void;
  renderOBV?: () => void;
  renderCMF?: () => void;
  renderStochRSI?: () => void;
  renderMACD?: () => void;
  renderADX?: () => void;
  renderWilliamsR?: () => void;
  renderCCI?: () => void;
  renderKlinger?: () => void;
  renderElderRay?: () => void;
  renderAroon?: () => void;
  renderVortex?: () => void;
  renderMFI?: () => void;
  renderROC?: () => void;
  renderAO?: () => void;
  renderTSI?: () => void;
  renderPPO?: () => void;
  renderCMO?: () => void;
  renderUltimateOsc?: () => void;
}

export interface IndicatorLayerProps {
  manager: CanvasManager | null;
  colors: ChartColors;
  movingAverages: MovingAverageConfig[];
  activeIndicators: string[];
  renderFunctions: IndicatorRenderFunctions;
  showStochastic: boolean;
  showRSI: boolean;
  showBollingerBands: boolean;
  showATR: boolean;
  showVWAP: boolean;
}

export interface IndicatorLayerResult {
  render: () => void;
  shouldRerender: (prev: IndicatorLayerProps, next: IndicatorLayerProps) => boolean;
}

const OVERLAY_INDICATORS = [
  'renderMovingAverages',
  'renderBollingerBands',
  'renderDailyVWAP',
  'renderWeeklyVWAP',
  'renderVWAP',
  'renderParabolicSAR',
  'renderKeltner',
  'renderDonchian',
  'renderSupertrend',
  'renderIchimoku',
  'renderDEMA',
  'renderTEMA',
  'renderWMA',
  'renderHMA',
  'renderPivotPoints',
  'renderFibonacci',
  'renderFVG',
  'renderLiquidityLevels',
] as const;

const PANEL_INDICATORS = [
  'renderStochastic',
  'renderRSI',
  'renderATR',
  'renderOBV',
  'renderCMF',
  'renderStochRSI',
  'renderMACD',
  'renderADX',
  'renderWilliamsR',
  'renderCCI',
  'renderKlinger',
  'renderElderRay',
  'renderAroon',
  'renderVortex',
  'renderMFI',
  'renderROC',
  'renderAO',
  'renderTSI',
  'renderPPO',
  'renderCMO',
  'renderUltimateOsc',
] as const;

export const createIndicatorLayer = ({
  renderFunctions,
}: IndicatorLayerProps): IndicatorLayerResult => {
  const render = (): void => {
    for (const name of OVERLAY_INDICATORS) {
      const fn = renderFunctions[name];
      if (fn) fn();
    }

    for (const name of PANEL_INDICATORS) {
      const fn = renderFunctions[name];
      if (fn) fn();
    }
  };

  const shouldRerender = (prev: IndicatorLayerProps, next: IndicatorLayerProps): boolean => {
    return (
      prev.movingAverages !== next.movingAverages ||
      prev.activeIndicators !== next.activeIndicators ||
      prev.showStochastic !== next.showStochastic ||
      prev.showRSI !== next.showRSI ||
      prev.showBollingerBands !== next.showBollingerBands ||
      prev.showATR !== next.showATR ||
      prev.showVWAP !== next.showVWAP
    );
  };

  return {
    render,
    shouldRerender,
  };
};

export const getIndicatorRenderOrder = (): {
  overlays: typeof OVERLAY_INDICATORS;
  panels: typeof PANEL_INDICATORS;
} => ({
  overlays: OVERLAY_INDICATORS,
  panels: PANEL_INDICATORS,
});
