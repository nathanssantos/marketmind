import type { Kline, FootprintBar, FootprintLevel } from '@marketmind/types';
import { useAggTrades } from '@renderer/hooks/useAggTrades';
import { useTickChart } from '@renderer/hooks/useTickChart';
import { useVolumeChart } from '@renderer/hooks/useVolumeChart';
import { useScalpingMetrics, type ScalpingMetricsHistoryEntry } from '@renderer/hooks/useScalpingMetrics';
import type { MutableRefObject, RefObject } from 'react';
import { useEffect, useMemo, useRef } from 'react';
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
  chartType: string;
  symbol?: string;
  needsScalpingMetrics: boolean;
  resolvedTicksPerBar: number;
  resolvedVolumePerBar: number;
  managerRef: RefObject<CanvasManager | null>;
}

export interface UseChartAlternativeKlinesResult {
  effectiveKlines: Kline[];
  footprintBars: FootprintBar[];
  cvdValuesRef: MutableRefObject<(number | null)[]>;
  imbalanceValuesRef: MutableRefObject<(number | null)[]>;
}

export const useChartAlternativeKlines = ({
  klines,
  chartType,
  symbol,
  needsScalpingMetrics,
  resolvedTicksPerBar,
  resolvedVolumePerBar,
  managerRef,
}: UseChartAlternativeKlinesProps): UseChartAlternativeKlinesResult => {
  const isTickOrVolumeChart = chartType === 'tick' || chartType === 'volume';
  const needsAggTrades = isTickOrVolumeChart || chartType === 'footprint';
  const { trades: aggTrades } = useAggTrades(needsAggTrades ? (symbol ?? null) : null, needsAggTrades);
  const tickKlines = useTickChart(chartType === 'tick' ? aggTrades : [], resolvedTicksPerBar);
  const volumeKlines = useVolumeChart(chartType === 'volume' ? aggTrades : [], resolvedVolumePerBar);

  const effectiveKlines = useMemo(() => {
    if (chartType === 'tick') return tickKlines;
    if (chartType === 'volume') return volumeKlines;
    return klines;
  }, [chartType, klines, tickKlines, volumeKlines]);

  const scalpingMetrics = useScalpingMetrics(needsScalpingMetrics ? (symbol ?? null) : null, needsScalpingMetrics);

  const cvdValuesRef = useRef<(number | null)[]>([]);
  const imbalanceValuesRef = useRef<(number | null)[]>([]);

  const footprintBars = useMemo((): FootprintBar[] => {
    if (chartType !== 'footprint' || aggTrades.length === 0 || effectiveKlines.length === 0) return [];
    const bars: FootprintBar[] = [];
    for (const kline of effectiveKlines) {
      const klineStart = kline.openTime;
      const klineEnd = kline.closeTime;
      const levels = new Map<number, FootprintLevel>();
      for (const trade of aggTrades) {
        if (trade.timestamp < klineStart || trade.timestamp > klineEnd) continue;
        const priceKey = Math.round(trade.price * 100) / 100;
        const existing = levels.get(priceKey);
        if (existing) {
          if (trade.isBuyerMaker) {
            existing.bidVol += trade.quantity;
          } else {
            existing.askVol += trade.quantity;
          }
          existing.delta = existing.askVol - existing.bidVol;
        } else {
          levels.set(priceKey, {
            bidVol: trade.isBuyerMaker ? trade.quantity : 0,
            askVol: trade.isBuyerMaker ? 0 : trade.quantity,
            delta: trade.isBuyerMaker ? -trade.quantity : trade.quantity,
          });
        }
      }
      bars.push({
        openTime: klineStart,
        closeTime: klineEnd,
        open: parseFloat(String(kline.open)),
        high: parseFloat(String(kline.high)),
        low: parseFloat(String(kline.low)),
        close: parseFloat(String(kline.close)),
        levels,
      });
    }
    return bars;
  }, [chartType, aggTrades, effectiveKlines]);

  useEffect(() => {
    if (!needsScalpingMetrics || effectiveKlines.length === 0) {
      cvdValuesRef.current = [];
      return;
    }
    cvdValuesRef.current = mapHistoryToKlineValues(scalpingMetrics.metricsHistory(), effectiveKlines, (e) => e.cvd, scalpingMetrics.cvd);
    managerRef.current?.markDirty('overlays');
  }, [needsScalpingMetrics, effectiveKlines, scalpingMetrics.cvd, scalpingMetrics.metricsHistory, managerRef]);

  useEffect(() => {
    if (!needsScalpingMetrics || effectiveKlines.length === 0) {
      imbalanceValuesRef.current = [];
      return;
    }
    imbalanceValuesRef.current = mapHistoryToKlineValues(scalpingMetrics.metricsHistory(), effectiveKlines, (e) => e.imbalanceRatio, scalpingMetrics.imbalanceRatio);
    managerRef.current?.markDirty('overlays');
  }, [needsScalpingMetrics, effectiveKlines, scalpingMetrics.imbalanceRatio, scalpingMetrics.metricsHistory, managerRef]);

  return {
    effectiveKlines,
    footprintBars,
    cvdValuesRef,
    imbalanceValuesRef,
  };
};
