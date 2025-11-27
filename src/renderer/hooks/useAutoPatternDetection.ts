import type { Candle, Viewport } from '@shared/types';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useChartContext } from '../context/ChartContext';
import { useUIStore } from '../store/uiStore';
import { patternDetectionService } from '../utils/patternDetection';

export const useAutoPatternDetection = (viewport?: Viewport) => {
  const { chartData, setDetectedStudies } = useChartContext();
  const { patternDetectionMode, algorithmicDetectionSettings } = useUIStore();
  const lastDetectionRef = useRef<{ 
    symbol: string; 
    candleCount: number; 
    viewportStart: number; 
    viewportEnd: number;
    enabledPatterns: string;
  } | null>(null);
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingDetectionRef = useRef(false);

  const visibleStart = viewport ? Math.floor(viewport.start) : 0;
  const visibleEnd = viewport ? Math.ceil(viewport.end) : chartData?.candles.length || 0;

  const detectionOptions = useMemo(
    () => ({
      minConfidence: algorithmicDetectionSettings.minConfidence,
      enabledPatterns: algorithmicDetectionSettings.enabledPatterns,
      pivotOptions: {
        lookback: algorithmicDetectionSettings.pivotSensitivity,
        lookahead: algorithmicDetectionSettings.pivotSensitivity,
      },
    }),
    [
      algorithmicDetectionSettings.minConfidence,
      algorithmicDetectionSettings.enabledPatterns,
      algorithmicDetectionSettings.pivotSensitivity,
    ]
  );

  const detectPatterns = useCallback(
    async (candles: Candle[], symbol: string, candleCount: number, start: number, end: number) => {
      try {
        const visibleCandles = viewport ? candles.slice(start, end) : candles;

        const detectionResult = await patternDetectionService.detectPatterns(
          visibleCandles,
          detectionOptions
        );

        setDetectedStudies(detectionResult.studies);
        lastDetectionRef.current = {
          symbol,
          candleCount,
          viewportStart: start,
          viewportEnd: end,
          enabledPatterns: JSON.stringify(detectionOptions.enabledPatterns),
        };
      } catch (error) {
        console.error('Auto pattern detection failed:', error);
        setDetectedStudies([]);
      }
    },
    [detectionOptions, setDetectedStudies, viewport]
  );

  useEffect(() => {
    const shouldDetect =
      (patternDetectionMode === 'algorithmic-only' || patternDetectionMode === 'hybrid') &&
      algorithmicDetectionSettings.autoDisplayPatterns &&
      chartData?.candles &&
      chartData.candles.length > 0;

    if (!shouldDetect) {
      setDetectedStudies([]);
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      return;
    }

    const currentSymbol = chartData.symbol;
    const currentCandleCount = chartData.candles.length;
    const currentEnabledPatterns = JSON.stringify(algorithmicDetectionSettings.enabledPatterns);

    if (
      lastDetectionRef.current?.symbol === currentSymbol &&
      lastDetectionRef.current?.candleCount === currentCandleCount &&
      lastDetectionRef.current?.viewportStart === visibleStart &&
      lastDetectionRef.current?.viewportEnd === visibleEnd &&
      lastDetectionRef.current?.enabledPatterns === currentEnabledPatterns
    ) {
      return;
    }

    if (throttleTimerRef.current) {
      pendingDetectionRef.current = true;
      return;
    }

    const runDetection = () => {
      detectPatterns(chartData.candles, currentSymbol, currentCandleCount, visibleStart, visibleEnd);
      
      throttleTimerRef.current = setTimeout(() => {
        throttleTimerRef.current = null;
        if (pendingDetectionRef.current) {
          pendingDetectionRef.current = false;
          runDetection();
        }
      }, 150);
    };

    runDetection();
  }, [
    chartData?.candles,
    chartData?.symbol,
    patternDetectionMode,
    algorithmicDetectionSettings.autoDisplayPatterns,
    algorithmicDetectionSettings.enabledPatterns,
    detectPatterns,
    visibleStart,
    visibleEnd,
  ]);

  useEffect(() => {
    return () => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, []);
};
