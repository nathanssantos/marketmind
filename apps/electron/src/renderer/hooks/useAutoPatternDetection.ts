import type { Kline, Viewport } from '@shared/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChartContext } from '../context/ChartContext';
import { usePatternDetectionConfigStore } from '../store/patternDetectionConfigStore';
import { useUIStore } from '../store/uiStore';
import { patternDetectionService } from '../utils/patternDetection';

const INTERACTION_DEBOUNCE_MS = 500;
const DETECTION_DEBOUNCE_MS = 500;
const MAX_PATTERNS_CLEAN_MODE = 20;
const MAX_PATTERNS_NORMAL_MODE = 50;

export const useAutoPatternDetection = (viewport?: Viewport): void => {
  const { chartData, setDetectedPatterns } = useChartContext();
  const { algorithmicDetectionSettings } = useUIStore();
  const { config: patternConfig } = usePatternDetectionConfigStore();
  const lastDetectionRef = useRef<{
    symbol: string;
    klineCount: number;
    viewportStart: number;
    viewportEnd: number;
    enabledPatterns: string;
  } | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const interactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleStart = viewport ? Math.floor(viewport.start) : 0;
  const visibleEnd = viewport ? Math.ceil(viewport.end) : (chartData?.klines.length ?? 0);

  const detectionOptions = useMemo(
    () => ({
      minConfidence: algorithmicDetectionSettings.minConfidence,
      enabledPatterns: algorithmicDetectionSettings.enabledPatterns,
      pivotOptions: {
        lookback: algorithmicDetectionSettings.pivotSensitivity,
        lookahead: algorithmicDetectionSettings.pivotSensitivity,
      },
      applyFiltering: true,
      enableNestedFiltering: patternConfig.enableNestedFiltering,
      enableOverlapFiltering: patternConfig.enableOverlapFiltering,
      useWorker: true,
      maxPatternsPerTier: patternConfig.maxPatternsPerTier,
      maxPatternsPerCategory: patternConfig.maxPatternsPerCategory,
      maxPatternsTotal: patternConfig.filteringMode === 'clean' 
        ? Math.min(patternConfig.maxPatternsTotal, MAX_PATTERNS_CLEAN_MODE)
        : Math.min(patternConfig.maxPatternsTotal, MAX_PATTERNS_NORMAL_MODE),
    }),
    [
      algorithmicDetectionSettings.minConfidence,
      algorithmicDetectionSettings.enabledPatterns,
      algorithmicDetectionSettings.pivotSensitivity,
      patternConfig.enableNestedFiltering,
      patternConfig.enableOverlapFiltering,
      patternConfig.maxPatternsPerTier,
      patternConfig.maxPatternsPerCategory,
      patternConfig.maxPatternsTotal,
      patternConfig.filteringMode,
    ]
  );

  const detectPatterns = useCallback(
    async (klines: Kline[], symbol: string, klineCount: number, start: number, end: number) => {
      try {
        const visibleKlines = klines.slice(start, end);
        const detectionResult = await patternDetectionService.detectPatterns(
          visibleKlines,
          detectionOptions
        );

        setDetectedPatterns(detectionResult.patterns);
        lastDetectionRef.current = {
          symbol,
          klineCount,
          viewportStart: start,
          viewportEnd: end,
          enabledPatterns: JSON.stringify(detectionOptions.enabledPatterns),
        };
      } catch (error) {
        console.error('Auto pattern detection failed:', error);
        setDetectedPatterns([]);
      }
    },
    [detectionOptions]
  );

  useEffect(() => {
    if (viewport) {
      setIsInteracting(true);

      if (interactionTimerRef.current) {
        clearTimeout(interactionTimerRef.current);
      }

      interactionTimerRef.current = setTimeout(() => {
        setIsInteracting(false);
      }, INTERACTION_DEBOUNCE_MS);
    }
  }, [viewport?.start, viewport?.end]);

  const shouldSkipDetection = useCallback(
    (
      currentSymbol: string,
      currentKlineCount: number,
      currentEnabledPatterns: string
    ): boolean => {
      if (!lastDetectionRef.current) return false;

      return (
        lastDetectionRef.current.symbol === currentSymbol &&
        lastDetectionRef.current.klineCount === currentKlineCount &&
        lastDetectionRef.current.viewportStart === visibleStart &&
        lastDetectionRef.current.viewportEnd === visibleEnd &&
        lastDetectionRef.current.enabledPatterns === currentEnabledPatterns
      );
    },
    [visibleStart, visibleEnd]
  );

  useEffect(() => {
    const shouldDetect =
      algorithmicDetectionSettings.autoDisplayPatterns &&
      chartData?.klines &&
      chartData.klines.length > 0 &&
      !isInteracting;

    if (!shouldDetect) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (!algorithmicDetectionSettings.autoDisplayPatterns) {
        setDetectedPatterns([]);
      }
      return;
    }

    const currentSymbol = chartData.symbol;
    const currentKlineCount = chartData.klines.length;
    const currentEnabledPatterns = JSON.stringify(algorithmicDetectionSettings.enabledPatterns);

    if (shouldSkipDetection(currentSymbol, currentKlineCount, currentEnabledPatterns)) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      void detectPatterns(chartData.klines, currentSymbol, currentKlineCount, visibleStart, visibleEnd);
      debounceTimerRef.current = null;
    }, DETECTION_DEBOUNCE_MS);
  }, [
    chartData?.klines,
    chartData?.symbol,
    algorithmicDetectionSettings.autoDisplayPatterns,
    algorithmicDetectionSettings.enabledPatterns,
    detectPatterns,
    visibleStart,
    visibleEnd,
    isInteracting,
  ]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (interactionTimerRef.current) {
        clearTimeout(interactionTimerRef.current);
      }
    };
  }, []);
};
