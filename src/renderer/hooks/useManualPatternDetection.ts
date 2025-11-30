import type { AIPattern } from '@shared/types';
import type { Pattern } from '@shared/types/pattern';
import { useCallback } from 'react';
import { useChartContext } from '../context/ChartContext';
import { usePatternDetectionConfigStore } from '../store/patternDetectionConfigStore';
import { useUIStore } from '../store/uiStore';
import { patternDetectionService } from '../utils/patternDetection';

const MAX_PATTERNS_CLEAN = 20;
const MAX_PATTERNS_COMPLETE = 50;
const PIVOT_DIVISOR = 10;

const adjustPatternIndices = (pattern: AIPattern, offset: number): AIPattern => {
  const adjusted = { ...pattern };

  if ('startIndex' in adjusted && typeof adjusted.startIndex === 'number') {
    adjusted.startIndex += offset;
  }
  if ('endIndex' in adjusted && typeof adjusted.endIndex === 'number') {
    adjusted.endIndex += offset;
  }
  if ('index' in adjusted && typeof adjusted.index === 'number') {
    adjusted.index += offset;
  }
  if ('leftIndex' in adjusted && typeof adjusted.leftIndex === 'number') {
    adjusted.leftIndex += offset;
  }
  if ('rightIndex' in adjusted && typeof adjusted.rightIndex === 'number') {
    adjusted.rightIndex += offset;
  }
  if ('shoulderLeftIndex' in adjusted && typeof adjusted.shoulderLeftIndex === 'number') {
    adjusted.shoulderLeftIndex += offset;
  }
  if ('headIndex' in adjusted && typeof adjusted.headIndex === 'number') {
    adjusted.headIndex += offset;
  }
  if ('shoulderRightIndex' in adjusted && typeof adjusted.shoulderRightIndex === 'number') {
    adjusted.shoulderRightIndex += offset;
  }
  if ('necklineStartIndex' in adjusted && typeof adjusted.necklineStartIndex === 'number') {
    adjusted.necklineStartIndex += offset;
  }
  if ('necklineEndIndex' in adjusted && typeof adjusted.necklineEndIndex === 'number') {
    adjusted.necklineEndIndex += offset;
  }
  if ('firstPeakIndex' in adjusted && typeof adjusted.firstPeakIndex === 'number') {
    adjusted.firstPeakIndex += offset;
  }
  if ('secondPeakIndex' in adjusted && typeof adjusted.secondPeakIndex === 'number') {
    adjusted.secondPeakIndex += offset;
  }
  if ('thirdPeakIndex' in adjusted && typeof adjusted.thirdPeakIndex === 'number') {
    adjusted.thirdPeakIndex += offset;
  }
  if ('cupStartIndex' in adjusted && typeof adjusted.cupStartIndex === 'number') {
    adjusted.cupStartIndex += offset;
  }
  if ('cupBottomIndex' in adjusted && typeof adjusted.cupBottomIndex === 'number') {
    adjusted.cupBottomIndex += offset;
  }
  if ('cupEndIndex' in adjusted && typeof adjusted.cupEndIndex === 'number') {
    adjusted.cupEndIndex += offset;
  }
  if ('handleStartIndex' in adjusted && typeof adjusted.handleStartIndex === 'number') {
    adjusted.handleStartIndex += offset;
  }
  if ('handleEndIndex' in adjusted && typeof adjusted.handleEndIndex === 'number') {
    adjusted.handleEndIndex += offset;
  }
  if ('bottomIndex' in adjusted && typeof adjusted.bottomIndex === 'number') {
    adjusted.bottomIndex += offset;
  }
  if ('flagStartIndex' in adjusted && typeof adjusted.flagStartIndex === 'number') {
    adjusted.flagStartIndex += offset;
  }
  if ('flagEndIndex' in adjusted && typeof adjusted.flagEndIndex === 'number') {
    adjusted.flagEndIndex += offset;
  }
  if ('poleStartIndex' in adjusted && typeof adjusted.poleStartIndex === 'number') {
    adjusted.poleStartIndex += offset;
  }
  if ('poleEndIndex' in adjusted && typeof adjusted.poleEndIndex === 'number') {
    adjusted.poleEndIndex += offset;
  }
  if ('apexIndex' in adjusted && typeof adjusted.apexIndex === 'number') {
    adjusted.apexIndex += offset;
  }

  return adjusted;
};

const convertAIPatternToPattern = (pattern: AIPattern): Pattern => {
  return {
    ...pattern,
    source: 'algorithm' as const,
  } as Pattern;
};

export const useManualPatternDetection = (
  onPatternsDetected?: (patterns: Pattern[]) => Promise<void>
): {
  detectPatterns: (viewport?: { start: number; end: number }) => Promise<void>;
} => {
  const { chartData } = useChartContext();
  const { config: patternConfig } = usePatternDetectionConfigStore();
  const { algorithmicDetectionSettings } = useUIStore();

  const detectPatterns = useCallback(
    async (viewport?: { start: number; end: number }) => {
      if (!chartData?.klines || chartData.klines.length === 0) {
        return;
      }

      const visibleStart = viewport ? Math.floor(viewport.start) : 0;
      const visibleEnd = viewport
        ? Math.ceil(viewport.end)
        : chartData.klines.length;

      const detectionOptions = {
        sensitivity: patternConfig.sensitivity,
        minConfidence: patternConfig.minConfidence,
        formationPeriod: patternConfig.formationPeriod,
        trendlineR2Threshold: patternConfig.trendlineR2Threshold,
        volumeConfirmationWeight: patternConfig.volumeConfirmationWeight,
        enabledPatterns: algorithmicDetectionSettings.enabledPatterns,
        pivotOptions: {
          lookback: Math.round(patternConfig.formationPeriod / PIVOT_DIVISOR),
          lookahead: Math.round(patternConfig.formationPeriod / PIVOT_DIVISOR),
        },
        applyFiltering: true,
        enableNestedFiltering: patternConfig.enableNestedFiltering,
        enableOverlapFiltering: patternConfig.enableOverlapFiltering,
        overlapThreshold: patternConfig.overlapThreshold,
        useWorker: true,
        maxPatternsPerTier: patternConfig.maxPatternsPerTier,
        maxPatternsPerCategory: patternConfig.maxPatternsPerCategory,
        maxPatternsTotal:
          patternConfig.filteringMode === 'clean'
            ? Math.min(patternConfig.maxPatternsTotal, MAX_PATTERNS_CLEAN)
            : Math.min(patternConfig.maxPatternsTotal, MAX_PATTERNS_COMPLETE),
      };

      try {
        const visibleKlines = chartData.klines.slice(visibleStart, visibleEnd);
        const detectionResult = await patternDetectionService.detectPatterns(
          visibleKlines,
          detectionOptions
        );

        const adjustedPatterns = detectionResult.patterns.map((pattern) =>
          adjustPatternIndices(pattern, visibleStart)
        );

        const patterns: Pattern[] = adjustedPatterns.map(convertAIPatternToPattern);
        
        if (onPatternsDetected) {
          await onPatternsDetected(patterns);
        }
      } catch (error) {
        console.error('Manual pattern detection failed:', error);
      }
    },
    [chartData, patternConfig, algorithmicDetectionSettings, onPatternsDetected]
  );

  return { detectPatterns };
};
