import { useCallback, useEffect, useRef, useState } from 'react';
import { QUERY_CONFIG } from '@shared/constants';
import { trpc } from '../utils/trpc';

type PreferenceCategory = 'trading' | 'ui' | 'chart' | 'notifications' | 'recent';

const KEY_TO_CATEGORY: Record<string, PreferenceCategory> = {
  'marketmind:symbol': 'chart',
  'marketmind:marketType': 'chart',
  'marketmind:showVolume': 'chart',
  'marketmind:showGrid': 'chart',
  'marketmind:showCurrentPriceLine': 'chart',
  'marketmind:showCrosshair': 'chart',
  'marketmind:showProfitLossAreas': 'chart',
  'marketmind:showFibonacciProjection': 'chart',
  'marketmind:showMeasurementRuler': 'chart',
  'marketmind:showMeasurementArea': 'chart',
  'marketmind:showTooltip': 'chart',
  'marketmind:showStochastic': 'chart',
  'marketmind:showRSI': 'chart',
  'marketmind:showBollingerBands': 'chart',
  'marketmind:showATR': 'chart',
  'marketmind:showVWAP': 'chart',
  'marketmind:showEventRow': 'chart',
  'marketmind:chartType': 'chart',
  'marketmind:timeframe': 'chart',
  'marketmind:movingAverages': 'chart',
  'marketmind:advancedConfig': 'chart',
  'marketmind:chartwindow:symbol': 'chart',
  'marketmind:chartwindow:marketType': 'chart',
  'trading-sidebar-open': 'ui',
  'trading-sidebar-width': 'ui',
  'marketmind:autoTradeConsole:fontSizeIndex': 'ui',
  'marketmind:autoTradeConsole:isExpanded': 'ui',
  'marketmind:autoTradeConsole:autoScroll': 'ui',
  'marketmind:quantityBySymbol': 'trading',
  'autoCheckUpdates': 'ui',
  'autoDownloadUpdates': 'ui',
  'updateCheckInterval': 'ui',
};

const getCategoryForKey = (key: string): PreferenceCategory => {
  return KEY_TO_CATEGORY[key] || 'ui';
};

const normalizeKey = (key: string): string => {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_');
};

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const category = getCategoryForKey(key);
  const normalizedKey = normalizeKey(key);
  const utils = trpc.useUtils();

  const [value, setValueState] = useState<T>(initialValue);
  const isHydratedRef = useRef(false);
  const pendingValueRef = useRef<T | null>(null);

  const { data: currentUser } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: QUERY_CONFIG.STALE_TIME.LONG,
  });

  const isAuthenticated = !!currentUser;

  const { data: preferences, isSuccess } = trpc.preferences.getByCategory.useQuery(
    { category },
    {
      enabled: isAuthenticated,
      staleTime: QUERY_CONFIG.STALE_TIME.LONG,
      retry: false,
    }
  );

  const setMutation = trpc.preferences.set.useMutation({
    onSuccess: () => {
      utils.preferences.getByCategory.invalidate({ category });
    },
  });

  useEffect(() => {
    if (isSuccess && preferences && !isHydratedRef.current) {
      const storedValue = preferences[normalizedKey];
      if (storedValue !== undefined) {
        setValueState(storedValue as T);
      }
      isHydratedRef.current = true;

      if (pendingValueRef.current !== null) {
        setMutation.mutate({
          category,
          key: normalizedKey,
          value: pendingValueRef.current,
        });
        pendingValueRef.current = null;
      }
    }
  }, [preferences, normalizedKey, isSuccess, category, setMutation]);

  const setValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      setValueState((prev) => {
        const computed = typeof newValue === 'function'
          ? (newValue as (prev: T) => T)(prev)
          : newValue;

        if (isAuthenticated) {
          setMutation.mutate({
            category,
            key: normalizedKey,
            value: computed,
          });
        } else {
          pendingValueRef.current = computed;
        }

        return computed;
      });
    },
    [isAuthenticated, category, normalizedKey, setMutation]
  );

  return [value, setValue];
}
