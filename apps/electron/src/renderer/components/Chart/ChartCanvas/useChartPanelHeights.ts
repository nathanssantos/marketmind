import type { IndicatorInstance } from '@renderer/store/indicatorStore';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG } from '@shared/constants';
import { INDICATOR_CATALOG } from '@marketmind/trading-core';
import { useEffect, useMemo, useRef } from 'react';
import type { AdvancedControlsConfig } from '../AdvancedControls';

export interface UseChartPanelHeightsProps {
  manager: CanvasManager | null;
  showEventRow: boolean;
  instances: IndicatorInstance[];
  advancedConfig?: AdvancedControlsConfig;
}

const isPaneKind = (kind: string): boolean => kind.startsWith('pane-');

export const useChartPanelHeights = ({
  manager,
  showEventRow,
  instances,
  advancedConfig,
}: UseChartPanelHeightsProps): void => {
  const previousPaneIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!manager || !advancedConfig) return;
    if (advancedConfig.rightMargin !== undefined) {
      manager.setRightMargin(advancedConfig.rightMargin);
    }
  }, [manager, advancedConfig]);

  const activePaneIds = useMemo(() => {
    const ids = new Set<string>();
    for (const instance of instances) {
      if (!instance.visible) continue;
      const definition = INDICATOR_CATALOG[instance.catalogType];
      if (!definition) continue;
      if (!isPaneKind(definition.render.kind)) continue;
      const paneId = definition.render.paneId ?? definition.type;
      ids.add(paneId);
    }
    return ids;
  }, [instances]);

  useEffect(() => {
    if (!manager) return;
    const previous = previousPaneIdsRef.current;

    for (const paneId of activePaneIds) {
      const height = paneId === 'stochastic' ? CHART_CONFIG.STOCHASTIC_PANEL_HEIGHT : CHART_CONFIG.RSI_PANEL_HEIGHT;
      manager.setPanelHeight(paneId, height);
    }

    for (const paneId of previous) {
      if (!activePaneIds.has(paneId)) manager.setPanelHeight(paneId, 0);
    }

    previousPaneIdsRef.current = new Set(activePaneIds);
  }, [manager, activePaneIds]);

  useEffect(() => {
    if (!manager) return;
    const height = showEventRow ? CHART_CONFIG.EVENT_ROW_HEIGHT : 0;
    manager.setEventRowHeight(height);
  }, [manager, showEventRow]);
};
