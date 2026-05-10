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
  /**
   * v1.5 — when false, collapse every indicator pane to 0 height
   * (Layers popover indicators toggle). Default true so existing
   * callers behave unchanged.
   */
  indicatorsEnabled?: boolean;
  /**
   * Grid-panel ID this chart is rendering into. When set, only
   * indicator instances bound to this panel contribute to pane
   * heights. When undefined (detached window etc.), all instances
   * count — legacy behavior.
   */
  panelId?: string;
}

const filterByPanelId = (
  instances: IndicatorInstance[],
  panelId: string | undefined,
): IndicatorInstance[] => {
  if (panelId === undefined) return instances;
  return instances.filter((inst) => inst.panelId === panelId);
};

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
  indicatorsEnabled = true,
  panelId,
}: UseChartPanelHeightsProps): void => {
  const previousPaneIdsRef = useRef<Set<string>>(new Set());
  const instancesRef = useRef<IndicatorInstance[]>(
    filterByPanelId(useIndicatorStore.getState().instances, panelId),
  );
  const panelIdRef = useRef(panelId);
  panelIdRef.current = panelId;

  useEffect(() => {
    if (!manager || !advancedConfig) return;
    if (advancedConfig.rightMargin !== undefined) {
      manager.setRightMargin(advancedConfig.rightMargin);
    }
  }, [manager, advancedConfig]);

  const applyPanelHeights = useCallback(() => {
    if (!manager) return;
    const activePaneIds = indicatorsEnabled
      ? computeActivePaneIds(instancesRef.current)
      : new Set<string>();
    const previous = previousPaneIdsRef.current;

    for (const paneId of activePaneIds) {
      const height = paneId === 'stochastic' ? CHART_CONFIG.STOCHASTIC_PANEL_HEIGHT : CHART_CONFIG.RSI_PANEL_HEIGHT;
      manager.setPanelHeight(paneId, height);
    }

    for (const paneId of previous) {
      if (!activePaneIds.has(paneId)) manager.setPanelHeight(paneId, 0);
    }

    previousPaneIdsRef.current = activePaneIds;
  }, [manager, indicatorsEnabled]);

  useEffect(() => {
    if (!manager) return;
    instancesRef.current = filterByPanelId(useIndicatorStore.getState().instances, panelIdRef.current);
    applyPanelHeights();
    const unsubscribe = useIndicatorStore.subscribe((state) => {
      const filtered = filterByPanelId(state.instances, panelIdRef.current);
      instancesRef.current = filtered;
      applyPanelHeights();
    });
    return unsubscribe;
  }, [manager, applyPanelHeights, panelId]);

  useEffect(() => {
    if (!manager) return;
    const height = showEventRow ? CHART_CONFIG.EVENT_ROW_HEIGHT : 0;
    manager.setEventRowHeight(height);
  }, [manager, showEventRow]);
};
