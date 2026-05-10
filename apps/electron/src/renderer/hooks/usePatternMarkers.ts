import type { Kline } from '@marketmind/types';
import {
  compilePattern,
  detectPatterns,
  type CompiledPattern,
  type PatternHit,
} from '@marketmind/trading-core';
import { useMemo, useRef } from 'react';
import { useUserPatterns } from './useUserPatterns';
import { usePatternStore } from '../store/patternStore';

/**
 * Computes pattern hits for a chart panel. Detection only runs on closed
 * bars (the in-flight last candle is skipped — see decision 1 in
 * `docs/CANDLE_PATTERNS_PLAN.md`).
 *
 * Memo signature is `(closedKlinesLength, lastClosedClose, enabledKey,
 * definitionsKey)` — a live tick only mutates the in-flight bar (last
 * index) which is excluded from the signature, so the memo holds tick-to-
 * tick. Re-eval fires on candle rotation, on enabled-set change, and on
 * pattern-definition update.
 */
export const usePatternMarkers = (panelId: string | undefined, klines: Kline[]): PatternHit[] => {
  const { patterns } = useUserPatterns();
  const enabledIds = usePatternStore((s) => (panelId ? s.enabledIdsByPanelId[panelId] : undefined));

  const compiledRef = useRef<{ key: string; compiled: CompiledPattern[] }>({ key: '', compiled: [] });

  const compiled = useMemo<CompiledPattern[]>(() => {
    if (!panelId || !enabledIds || enabledIds.length === 0 || patterns.length === 0) return [];
    const enabledSet = new Set(enabledIds);
    const matched = patterns.filter((p) => enabledSet.has(p.id));
    const key = matched.map((p) => `${p.id}:${p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt}`).join('|');
    if (key === compiledRef.current.key) return compiledRef.current.compiled;
    const next = matched
      .map((p) => {
        try { return compilePattern(p.definition); }
        catch { return null; }
      })
      .filter((c): c is CompiledPattern => c !== null);
    compiledRef.current = { key, compiled: next };
    return next;
  }, [panelId, enabledIds, patterns]);

  return useMemo<PatternHit[]>(() => {
    if (compiled.length === 0 || klines.length < 2) return [];
    return detectPatterns(klines, compiled);
    // The dep on `klines` is intentional: the array reference changes on
    // candle rotation (rare) but stays stable across live ticks because the
    // tick path mutates the in-flight bar in place via `klineSource`.
  }, [compiled, klines]);
};
