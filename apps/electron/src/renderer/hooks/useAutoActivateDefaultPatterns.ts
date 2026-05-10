import { DEFAULT_ENABLED_PATTERN_IDS } from '@marketmind/trading-core';
import { useUserPatterns } from '@renderer/hooks/useUserPatterns';
import { useLayoutStore } from '@renderer/store/layoutStore';
import { usePatternStore } from '@renderer/store/patternStore';
import { useChartPref } from '@renderer/store/preferencesStore';
import { isChartPanel } from '@shared/types/layout';
import { useEffect } from 'react';

/**
 * On first run for a user, enables the default candle-pattern set on every
 * chart panel of every layout. Mirrors `useAutoActivateDefaultIndicators`.
 *
 * Resolution: `DEFAULT_ENABLED_PATTERN_IDS` from trading-core →
 * `userPatterns[].patternId` (server-seeded for the user) → set the
 * resulting `userPattern.id` as enabled in `usePatternStore` for each
 * chart panel.
 *
 * Idempotent — guarded by the `defaultPatternsAutoActivated` chart-pref
 * flag, just like the indicator activator.
 */
export const useAutoActivateDefaultPatterns = (): void => {
  const { patterns, isLoading } = useUserPatterns();
  const [defaultsAutoActivated, setDefaultsAutoActivated] = useChartPref<boolean>(
    'defaultPatternsAutoActivated',
    false,
  );

  useEffect(() => {
    if (defaultsAutoActivated) return;
    if (isLoading) return;
    if (patterns.length === 0) return;

    const store = usePatternStore.getState();
    if (Object.keys(store.enabledIdsByPanelId).length > 0) {
      // User already toggled something — don't overwrite.
      setDefaultsAutoActivated(true);
      return;
    }

    const idByPatternId = new Map(patterns.map((p) => [p.patternId, p.id]));
    const defaultUserPatternIds: string[] = [];
    for (const pid of DEFAULT_ENABLED_PATTERN_IDS) {
      const id = idByPatternId.get(pid);
      if (id) defaultUserPatternIds.push(id);
    }
    if (defaultUserPatternIds.length === 0) {
      setDefaultsAutoActivated(true);
      return;
    }

    const layoutStore = useLayoutStore.getState();
    for (const layout of layoutStore.layoutPresets) {
      for (const panel of layout.grid) {
        if (!isChartPanel(panel)) continue;
        store.setForPanel(panel.id, defaultUserPatternIds);
      }
    }

    setDefaultsAutoActivated(true);
  }, [defaultsAutoActivated, isLoading, patterns, setDefaultsAutoActivated]);
};
