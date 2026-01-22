import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { AdvancedControlsConfig } from '../AdvancedControls';
import { CHART_CONFIG } from '@shared/constants';
import { useEffect } from 'react';
import type { IndicatorId } from './useChartIndicators';

const PANEL_INDICATORS = [
  'obv',
  'cmf',
  'stochRsi',
  'macd',
  'adx',
  'williamsR',
  'cci',
  'klinger',
  'elderRay',
  'aroon',
  'vortex',
  'mfi',
  'roc',
  'ao',
  'tsi',
  'ppo',
  'cmo',
  'ultimateOsc',
] as const;

export type PanelIndicatorId = (typeof PANEL_INDICATORS)[number];

export interface UseChartPanelHeightsProps {
  manager: CanvasManager | null;
  showStochastic: boolean;
  showRSI: boolean;
  showEventRow: boolean;
  activeIndicators: IndicatorId[];
  advancedConfig?: AdvancedControlsConfig;
}

export const useChartPanelHeights = ({
  manager,
  showStochastic,
  showRSI,
  showEventRow,
  activeIndicators,
  advancedConfig,
}: UseChartPanelHeightsProps): void => {
  useEffect(() => {
    if (!manager || !advancedConfig) return;

    if (advancedConfig.rightMargin !== undefined) {
      manager.setRightMargin(advancedConfig.rightMargin);
    }
  }, [manager, advancedConfig]);

  useEffect(() => {
    if (!manager) return;
    const height = showStochastic ? CHART_CONFIG.STOCHASTIC_PANEL_HEIGHT : 0;
    manager.setStochasticPanelHeight(height);
  }, [manager, showStochastic]);

  useEffect(() => {
    if (!manager) return;
    const height = showRSI ? CHART_CONFIG.RSI_PANEL_HEIGHT : 0;
    manager.setRSIPanelHeight(height);
  }, [manager, showRSI]);

  useEffect(() => {
    if (!manager) return;
    for (const indicator of PANEL_INDICATORS) {
      const isActive = activeIndicators.includes(indicator as IndicatorId);
      const height = isActive ? CHART_CONFIG.RSI_PANEL_HEIGHT : 0;
      manager.setPanelHeight(indicator, height);
    }
  }, [manager, activeIndicators]);

  useEffect(() => {
    if (!manager) return;
    const height = showEventRow ? CHART_CONFIG.EVENT_ROW_HEIGHT : 0;
    manager.setEventRowHeight(height);
  }, [manager, showEventRow]);
};
