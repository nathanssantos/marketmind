import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import type { BackendExecution } from '@renderer/components/Chart/useOrderLinesRenderer';

/**
 * Shared optimistic overrides for SL/TP/entryPrice/status patches.
 *
 * Previously each `useChartTradingData` instance held its own `useRef<Map>`,
 * so a drag-to-modify on one chart panel painted the new value only on
 * THAT chart — sibling chart panels showing the same execution stayed
 * on the old value until the WS `position:update` event patched the
 * canonical tRPC cache (or, worse, until the 30s polling fallback).
 * Visible symptom (user report 2026-05-16): dragged SL on the 1m chart
 * showed `-0.78%`, sibling 5m / 15m charts still rendered `-0.97%`.
 *
 * Lifting the map into a single context-shared Map fixes that — every
 * chart consumer reads/writes the same overrides, so an optimistic
 * patch is visible across every chart in the same render frame as the
 * drag-release. The auto-clear sweep (per-chart, in `useChartTradingData`)
 * still works idempotently: deletions on the shared map bump the same
 * version atom, which re-renders every consumer.
 */

export interface OptimisticOverride {
  patches: Partial<Pick<BackendExecution, 'stopLoss' | 'takeProfit' | 'entryPrice' | 'status'>>;
  previousValues: Partial<Pick<BackendExecution, 'stopLoss' | 'takeProfit' | 'entryPrice' | 'status'>>;
  timestamp: number;
}

interface OptimisticOrderOverridesContextValue {
  optimisticOverridesRef: RefObject<Map<string, OptimisticOverride>>;
  overrideVersion: number;
  bumpOverrideVersion: () => void;
  applyOptimistic: (
    id: string,
    patches: OptimisticOverride['patches'],
    previousValues: OptimisticOverride['previousValues'],
  ) => void;
  clearOptimistic: (id: string, expectedPatches?: OptimisticOverride['patches']) => void;
}

const OptimisticOrderOverridesContext = createContext<OptimisticOrderOverridesContextValue | null>(null);

export function OptimisticOrderOverridesProvider({ children }: { children: ReactNode }) {
  const optimisticOverridesRef = useRef<Map<string, OptimisticOverride>>(new Map());
  const [overrideVersion, setOverrideVersion] = useState(0);

  const bumpOverrideVersion = useCallback(() => {
    setOverrideVersion((v) => v + 1);
  }, []);

  const applyOptimistic = useCallback<OptimisticOrderOverridesContextValue['applyOptimistic']>(
    (id, patches, previousValues) => {
      const existing = optimisticOverridesRef.current.get(id);
      optimisticOverridesRef.current.set(id, {
        patches: existing ? { ...existing.patches, ...patches } : patches,
        previousValues: existing ? existing.previousValues : previousValues,
        timestamp: Date.now(),
      });
      setOverrideVersion((v) => v + 1);
    },
    [],
  );

  const clearOptimistic = useCallback<OptimisticOrderOverridesContextValue['clearOptimistic']>(
    (id, expectedPatches) => {
      if (expectedPatches) {
        const current = optimisticOverridesRef.current.get(id);
        if (current) {
          const patchKeys = Object.keys(expectedPatches) as (keyof OptimisticOverride['patches'])[];
          const stillMatches = patchKeys.every((k) => current.patches[k] === expectedPatches[k]);
          if (!stillMatches) return;
        }
      }
      optimisticOverridesRef.current.delete(id);
      setOverrideVersion((v) => v + 1);
    },
    [],
  );

  const value = useMemo<OptimisticOrderOverridesContextValue>(
    () => ({
      optimisticOverridesRef,
      overrideVersion,
      bumpOverrideVersion,
      applyOptimistic,
      clearOptimistic,
    }),
    [overrideVersion, bumpOverrideVersion, applyOptimistic, clearOptimistic],
  );

  return (
    <OptimisticOrderOverridesContext.Provider value={value}>
      {children}
    </OptimisticOrderOverridesContext.Provider>
  );
}

export function useOptimisticOrderOverrides(): OptimisticOrderOverridesContextValue {
  const ctx = useContext(OptimisticOrderOverridesContext);
  if (!ctx) {
    throw new Error(
      'useOptimisticOrderOverrides must be used inside OptimisticOrderOverridesProvider',
    );
  }
  return ctx;
}
