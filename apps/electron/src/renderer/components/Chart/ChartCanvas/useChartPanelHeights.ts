import { useIndicatorStore, type IndicatorInstance } from '@renderer/store/indicatorStore';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { CHART_CONFIG } from '@shared/constants';
import { INDICATOR_CATALOG } from '@marketmind/trading-core';
import { useCallback, useEffect, useRef } from 'react';
import type { AdvancedControlsConfig } from '../AdvancedControls';

export interface UseChartPanelHeightsProps {
  manager: CanvasManager | null;
  showEventRow: boolean;
  advancedConfig?: AdvancedControlsConfig;
}

const isPaneKind = (kind: string): boolean => kind.startsWith('pane-');

const computeActivePaneIds = (instances: IndicatorInstance[]): Set<string> => {
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
};

export const useChartPanelHeights = ({
  manager,
  showEventRow,
  advancedConfig,
}: UseChartPanelHeightsProps): void => {
  const previousPaneIdsRef = useRef<Set<string>>(new Set());
  const instancesRef = useRef<IndicatorInstance[]>(useIndicatorStore.getState().instances);

  useEffect(() => {
    if (!manager || !advancedConfig) return;
    if (advancedConfig.rightMargin !== undefined) {
      manager.setRightMargin(advancedConfig.rightMargin);
    }
  }, [manager, advancedConfig]);

  const applyPanelHeights = useCallback(() => {
    if (!manager) return;
    const activePaneIds = computeActivePaneIds(instancesRef.current);
    const previous = previousPaneIdsRef.current;

    for (const paneId of activePaneIds) {
      const height = paneId === 'stochastic' ? CHART_CONFIG.STOCHASTIC_PANEL_HEIGHT : CHART_CONFIG.RSI_PANEL_HEIGHT;
      manager.setPanelHeight(paneId, height);
    }

    for (const paneId of previous) {
      if (!activePaneIds.has(paneId)) manager.setPanelHeight(paneId, 0);
    }

    previousPaneIdsRef.current = activePaneIds;
  }, [manager]);

  useEffect(() => {
    if (!manager) return;
    applyPanelHeights();
    const unsubscribe = useIndicatorStore.subscribe((state) => {
      const next = state.instances;
      if (next === instancesRef.current) return;
      instancesRef.current = next;
      applyPanelHeights();
    });
    return unsubscribe;
  }, [manager, applyPanelHeights]);

  useEffect(() => {
    if (!manager) return;
    const height = showEventRow ? CHART_CONFIG.EVENT_ROW_HEIGHT : 0;
    manager.setEventRowHeight(height);
  }, [manager, showEventRow]);
};
