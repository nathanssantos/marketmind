import { DEFAULT_ACTIVE_SEED_LABELS } from '@marketmind/trading-core';
import { useUserIndicators } from '@renderer/hooks/useUserIndicators';
import { useIndicatorStore } from '@renderer/store/indicatorStore';
import { useChartPref } from '@renderer/store/preferencesStore';
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

    for (const ui of indicators) {
      if (!DEFAULT_ACTIVE_SEED_LABELS.has(ui.label)) continue;
      store.addInstance({
        userIndicatorId: ui.id,
        catalogType: ui.catalogType,
        params: ui.params,
        visible: true,
      });
    }
    setDefaultsAutoActivated(true);
  }, [defaultsAutoActivated, isLoading, indicators, setDefaultsAutoActivated]);
};
