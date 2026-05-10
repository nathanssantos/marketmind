import { useUserIndicators } from '@renderer/hooks/useUserIndicators';
import { useIndicatorStore } from '@renderer/store/indicatorStore';
import { useChartPref } from '@renderer/store/preferencesStore';
import { DEFAULT_LAYOUT_SEED } from '@renderer/store/seed/defaultLayoutSeed';
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

    // Seed instances from the curated v3 layout seed
    // (`store/seed/defaultLayoutSeed.ts`). Each binding names the
    // userIndicator it wants by `label`; we resolve the label to the
    // user's own userIndicator id (which is unique per user but the
    // labels are stable across the seed flow). Bindings without a
    // matching userIndicator are silently dropped — happens if the
    // user deleted a default-seeded indicator before first activation.
    const labelToUi = new Map(indicators.map((ui) => [ui.label, ui]));
    for (const binding of DEFAULT_LAYOUT_SEED.indicatorBindings) {
      const ui = labelToUi.get(binding.label);
      if (!ui) continue;
      store.addInstance({
        userIndicatorId: ui.id,
        catalogType: binding.catalogType,
        params: binding.params,
        visible: binding.visible,
        panelId: binding.panelId,
      });
    }
    setDefaultsAutoActivated(true);
  }, [defaultsAutoActivated, isLoading, indicators, setDefaultsAutoActivated]);
};
