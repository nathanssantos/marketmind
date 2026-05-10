import { DEFAULT_ACTIVE_SEED_LABELS } from '@marketmind/trading-core';
import { useUserIndicators } from '@renderer/hooks/useUserIndicators';
import { useIndicatorStore } from '@renderer/store/indicatorStore';
import { useLayoutStore } from '@renderer/store/layoutStore';
import { useChartPref } from '@renderer/store/preferencesStore';
import { isChartPanel } from '@shared/types/layout';
import { useEffect } from 'react';

export const useAutoActivateDefaultIndicators = (): void => {
  const { indicators, isLoading } = useUserIndicators();
  const [defaultsAutoActivated, setDefaultsAutoActivated] = useChartPref<boolean>(
    'defaultsAutoActivated',
    false,
  );

  useEffect(() => {
    if (defaultsAutoActivated) return;
    if (isLoading) return;
    if (indicators.length === 0) return;

    const store = useIndicatorStore.getState();
    if (store.instances.length > 0) {
      setDefaultsAutoActivated(true);
      return;
    }

    // Seed default indicators on every chart-panel of every layout so
    // the first-run experience matches the legacy "indicators show
    // everywhere" behavior — but each panel gets its OWN independent
    // copy. Toggling a default off in one panel doesn't affect any
    // other panel (since #493).
    const layoutStore = useLayoutStore.getState();
    const chartPanelIds: string[] = [];
    for (const layout of layoutStore.layoutPresets) {
      for (const panel of layout.grid) {
        if (isChartPanel(panel)) chartPanelIds.push(panel.id);
      }
    }

    if (chartPanelIds.length === 0) {
      setDefaultsAutoActivated(true);
      return;
    }

    for (const ui of indicators) {
      if (!DEFAULT_ACTIVE_SEED_LABELS.has(ui.label)) continue;
      for (const panelId of chartPanelIds) {
        store.addInstance({
          userIndicatorId: ui.id,
          catalogType: ui.catalogType,
          params: ui.params,
          visible: true,
          panelId,
        });
      }
    }
    setDefaultsAutoActivated(true);
  }, [defaultsAutoActivated, isLoading, indicators, setDefaultsAutoActivated]);
};
