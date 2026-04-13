import { Box, Spinner } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { useIndicatorStore } from '../store/indicatorStore';
import { usePreferencesStore } from '../store/preferencesStore';
import { useScreenerStore } from '../store/screenerStore';
import { useSetupStore } from '../store/setupStore';
import { useUIStore } from '../store/uiStore';
import { useCurrencyStore } from '../store/currencyStore';
import { hydrateLayoutStore } from '../store/layoutStore';
import { trpc } from '../utils/trpc';

const hydrateDomainStores = (prefs: Record<string, Record<string, unknown>>) => {
  const chart = prefs['chart'] ?? {};
  const ui = prefs['ui'] ?? {};
  const trading = prefs['trading'] ?? {};

  useIndicatorStore.getState().hydrate({
    activeIndicators: chart['activeIndicators'] as string[] | undefined,
    indicatorParams: chart['indicatorParams'] as Record<string, unknown> | undefined,
  });

  useUIStore.getState().hydrate(ui);
  useScreenerStore.getState().hydrate(ui);
  useCurrencyStore.getState().hydrate(ui);
  useSetupStore.getState().hydrate(trading);
  void hydrateLayoutStore();
};

export const PreferencesHydrator = ({ children }: { children: ReactNode }) => {
  const isHydrated = usePreferencesStore((s) => s.isHydrated);
  const hasHydrated = useRef(false);

  const { data, isSuccess, isError } = trpc.preferences.getAll.useQuery(undefined, {
    retry: 1,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (hasHydrated.current) return;

    if (isSuccess && data) {
      hasHydrated.current = true;
      usePreferencesStore.getState().hydrate(data);
      hydrateDomainStores(data);
    } else if (isError) {
      hasHydrated.current = true;
      usePreferencesStore.getState().hydrate({});
      hydrateDomainStores({});
    }
  }, [data, isSuccess, isError]);

  if (!isHydrated) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" height="100vh">
        <Spinner size="xl" />
      </Box>
    );
  }

  return <>{children}</>;
};
