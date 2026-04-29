import type { Kline } from '@marketmind/types';
import { useScalpingMetrics, type ScalpingMetricsHistoryEntry } from '@renderer/hooks/useScalpingMetrics';
import type { MutableRefObject, RefObject } from 'react';
import { useEffect, useRef } from 'react';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';

const mapHistoryToKlineValues = (
  history: ScalpingMetricsHistoryEntry[],
  klines: Kline[],
  selector: (entry: ScalpingMetricsHistoryEntry) => number,
  fallback: number,
): (number | null)[] => {
  if (history.length === 0 || klines.length === 0) return [];
  const values: (number | null)[] = new Array(klines.length).fill(null);
  let histIdx = 0;
  for (let i = 0; i < klines.length && histIdx < history.length; i++) {
    const kline = klines[i];
    if (!kline) continue;
    let lastMatch: number | null = null;
    while (histIdx < history.length && history[histIdx]!.timestamp <= kline.closeTime) {
      if (history[histIdx]!.timestamp >= kline.openTime) lastMatch = selector(history[histIdx]!);
      histIdx++;
    }
    if (lastMatch !== null) values[i] = lastMatch;
  }
  if (values[values.length - 1] === null) values[values.length - 1] = fallback;
  return values;
};

export interface UseChartAlternativeKlinesProps {
  klines: Kline[];
  symbol?: string;
  needsScalpingMetrics: boolean;
  managerRef: RefObject<CanvasManager | null>;
}

export interface UseChartAlternativeKlinesResult {
  effectiveKlines: Kline[];
  cvdValuesRef: MutableRefObject<(number | null)[]>;
  imbalanceValuesRef: MutableRefObject<(number | null)[]>;
}

export const useChartAlternativeKlines = ({
  klines,
  symbol,
  needsScalpingMetrics,
  managerRef,
}: UseChartAlternativeKlinesProps): UseChartAlternativeKlinesResult => {
  const scalpingMetrics = useScalpingMetrics(needsScalpingMetrics ? (symbol ?? null) : null, needsScalpingMetrics);

  const cvdValuesRef = useRef<(number | null)[]>([]);
  const imbalanceValuesRef = useRef<(number | null)[]>([]);

  useEffect(() => {
    if (!needsScalpingMetrics || klines.length === 0) {
      cvdValuesRef.current = [];
      return;
    }
    cvdValuesRef.current = mapHistoryToKlineValues(scalpingMetrics.metricsHistory(), klines, (e) => e.cvd, scalpingMetrics.cvd);
    managerRef.current?.markDirty('overlays');
  }, [needsScalpingMetrics, klines, scalpingMetrics.cvd, scalpingMetrics.metricsHistory, managerRef]);

  useEffect(() => {
    if (!needsScalpingMetrics || klines.length === 0) {
      imbalanceValuesRef.current = [];
      return;
    }
    imbalanceValuesRef.current = mapHistoryToKlineValues(scalpingMetrics.metricsHistory(), klines, (e) => e.imbalanceRatio, scalpingMetrics.imbalanceRatio);
    managerRef.current?.markDirty('overlays');
  }, [needsScalpingMetrics, klines, scalpingMetrics.imbalanceRatio, scalpingMetrics.metricsHistory, managerRef]);

  return {
    effectiveKlines: klines,
    cvdValuesRef,
    imbalanceValuesRef,
  };
};
