import { DEFAULT_ACTIVE_SEED_LABELS } from '@marketmind/trading-core';
import { useUserIndicators } from '@renderer/hooks/useUserIndicators';
import { useIndicatorStore } from '@renderer/store/indicatorStore';
import { migrateLegacyToInstances } from '@renderer/store/indicatorStoreMigration';
import { useChartPref } from '@renderer/store/preferencesStore';
import { useEffect } from 'react';

export const useAutoActivateDefaultIndicators = (): void => {
  const { indicators, isLoading, create } = useUserIndicators();
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

    const run = async (): Promise<void> => {
      if (store.activeIndicators.length > 0) {
        const result = await migrateLegacyToInstances({
          legacyActive: store.activeIndicators,
          legacyParams: store.indicatorParams,
          existingIndicators: indicators,
          createIndicator: (input) => create.mutateAsync(input),
        });
        for (const inst of result.instancesCreated) {
          store.addInstance({
            userIndicatorId: inst.userIndicatorId,
            catalogType: inst.catalogType,
            params: inst.params,
            visible: inst.visible,
          });
        }
        store.clearLegacyState();
      } else {
        for (const ui of indicators) {
          if (!DEFAULT_ACTIVE_SEED_LABELS.has(ui.label)) continue;
          store.addInstance({
            userIndicatorId: ui.id,
            catalogType: ui.catalogType,
            params: ui.params,
            visible: true,
          });
        }
      }
      setDefaultsAutoActivated(true);
    };

    void run();
  }, [defaultsAutoActivated, isLoading, indicators, create, setDefaultsAutoActivated]);
};
