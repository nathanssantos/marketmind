import type { AIStudy, Candle } from '@shared/types';
import { PATTERN_DETECTION_CONFIG } from '../constants';
import { filterAndPrioritizePatterns } from '../core/patternFilter';
import { calculateImportanceScore } from '../core/patternImportance';
import type { PatternRelationship } from '../core/patternRelationships';
import { buildPatternRelationships, classifyPatternTier } from '../core/patternRelationships';
import { findPivotPoints } from '../core/pivotPoints';
import { detectDoubleBottoms, detectDoubleTops, detectHeadAndShoulders, detectInverseHeadAndShoulders, detectTripleBottoms, detectTripleTops } from '../patterns/advancedPatterns';
import { detectAscendingChannels, detectDescendingChannels, detectHorizontalChannels } from '../patterns/channels';
import { detectBearishFlags, detectBullishFlags, detectCupAndHandle, detectPennants, detectRoundingBottom } from '../patterns/continuationPatterns';
import { detectFibonacciExtensions, detectFibonacciRetracements } from '../patterns/fibonacci';
import { detectBreakawayGaps, detectCommonGaps, detectExhaustionGaps, detectRunawayGaps } from '../patterns/gapPatterns';
import { detectResistance, detectSupport } from '../patterns/supportResistance';
import { detectBearishTrendlines, detectBullishTrendlines } from '../patterns/trendlines';
import { detectAscendingTriangles, detectDescendingTriangles, detectSymmetricalTriangles } from '../patterns/triangles';
import { detectFallingWedges, detectRisingWedges } from '../patterns/wedges';
import { detectAccumulationZones, detectBuyZones, detectLiquidityZones, detectSellZones } from '../patterns/zones';
import type { DetectionOptions, DetectionResult, PivotPoint } from '../types';

export class PatternDetectionService {
  private workerBuildRelationships: ((patterns: AIStudy[], useWorker?: boolean) => Promise<PatternRelationship[]>) | null = null;

  setWorkerBuildRelationships(
    buildRelationships: (patterns: AIStudy[], useWorker?: boolean) => Promise<PatternRelationship[]>
  ): void {
    this.workerBuildRelationships = buildRelationships;
  }

  async detectPatterns(
    candles: Candle[],
    options: DetectionOptions = {}
  ): Promise<DetectionResult> {
    const startTime = performance.now();
    
    const {
      minConfidence = PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD,
      pivotSensitivity = PATTERN_DETECTION_CONFIG.PIVOT_LOOKBACK_DEFAULT,
      enabledPatterns,
    } = options;

    const pivots = findPivotPoints(candles, pivotSensitivity, pivotSensitivity);
    
    const allStudies: AIStudy[] = [];

    if (!enabledPatterns || enabledPatterns.includes('support')) {
      allStudies.push(...detectSupport(candles, pivots));
    }
    
    if (!enabledPatterns || enabledPatterns.includes('resistance')) {
      allStudies.push(...detectResistance(candles, pivots));
    }
    
    if (!enabledPatterns || enabledPatterns.includes('trendline-bullish')) {
      allStudies.push(...detectBullishTrendlines(candles, pivots));
    }
    
    if (!enabledPatterns || enabledPatterns.includes('trendline-bearish')) {
      allStudies.push(...detectBearishTrendlines(candles, pivots));
    }
    
    if (!enabledPatterns || enabledPatterns.includes('fibonacci-retracement')) {
      allStudies.push(...detectFibonacciRetracements(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('fibonacci-extension')) {
      allStudies.push(...detectFibonacciExtensions(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('channel-ascending')) {
      allStudies.push(...detectAscendingChannels(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('channel-descending')) {
      allStudies.push(...detectDescendingChannels(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('channel-horizontal')) {
      allStudies.push(...detectHorizontalChannels(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('triangle-ascending')) {
      allStudies.push(...detectAscendingTriangles(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('triangle-descending')) {
      allStudies.push(...detectDescendingTriangles(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('triangle-symmetrical')) {
      allStudies.push(...detectSymmetricalTriangles(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('wedge-rising')) {
      allStudies.push(...detectRisingWedges(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('wedge-falling')) {
      allStudies.push(...detectFallingWedges(candles, pivots));
    }
    
    if (!enabledPatterns || enabledPatterns.includes('head-and-shoulders')) {
      allStudies.push(...detectHeadAndShoulders(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('inverse-head-and-shoulders')) {
      allStudies.push(...detectInverseHeadAndShoulders(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('double-top')) {
      allStudies.push(...detectDoubleTops(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('double-bottom')) {
      allStudies.push(...detectDoubleBottoms(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('triple-top')) {
      allStudies.push(...detectTripleTops(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('triple-bottom')) {
      allStudies.push(...detectTripleBottoms(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('flag-bullish')) {
      allStudies.push(...detectBullishFlags(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('flag-bearish')) {
      allStudies.push(...detectBearishFlags(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('pennant')) {
      allStudies.push(...detectPennants(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('cup-and-handle')) {
      allStudies.push(...detectCupAndHandle(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('rounding-bottom')) {
      allStudies.push(...detectRoundingBottom(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('gap-common')) {
      allStudies.push(...detectCommonGaps(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('gap-breakaway')) {
      allStudies.push(...detectBreakawayGaps(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('gap-runaway')) {
      allStudies.push(...detectRunawayGaps(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('gap-exhaustion')) {
      allStudies.push(...detectExhaustionGaps(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('buy-zone')) {
      allStudies.push(...detectBuyZones(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('sell-zone')) {
      allStudies.push(...detectSellZones(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('liquidity-zone')) {
      allStudies.push(...detectLiquidityZones(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('accumulation-zone')) {
      allStudies.push(...detectAccumulationZones(candles, pivots));
    }

    const filteredStudies = allStudies.filter(
      study => (study.confidence || 0) >= minConfidence
    );

    const sortedStudies = filteredStudies.sort(
      (a, b) => (b.confidence || 0) - (a.confidence || 0)
    );

    let studyId = 1;
    sortedStudies.forEach(study => {
      study.id = studyId++;
    });

    let finalStudies = sortedStudies;

    if (options.applyFiltering && sortedStudies.length > 0) {
      console.log('[PatternDetection] Before filtering:', sortedStudies.length, 'patterns');
      
      sortedStudies.forEach(study => {
        study.importanceScore = calculateImportanceScore(study, candles);
        study.tier = classifyPatternTier(study, candles);
      });

      let relationships: PatternRelationship[];
      
      try {
        if (this.workerBuildRelationships) {
          relationships = await this.workerBuildRelationships(sortedStudies, options.useWorker ?? true);
        } else {
          relationships = buildPatternRelationships(sortedStudies);
        }
      } catch {
        relationships = buildPatternRelationships(sortedStudies);
      }
      
      finalStudies = filterAndPrioritizePatterns(
        sortedStudies,
        relationships,
        {
          enableNestedFiltering: options.enableNestedFiltering ?? false,
          enableOverlapFiltering: options.enableOverlapFiltering ?? false,
          maxPatternsPerTier: options.maxPatternsPerTier ?? {
            macro: 10,
            major: 8,
            intermediate: 6,
            minor: 4,
          },
          maxPatternsPerCategory: options.maxPatternsPerCategory ?? 5,
          maxPatternsTotal: options.maxPatternsTotal ?? 20,
        }
      );
    }

    const executionTime = performance.now() - startTime;

    return {
      studies: finalStudies,
      metadata: {
        pivotsFound: pivots.length,
        patternsDetected: finalStudies.length,
        executionTime,
        candlesAnalyzed: candles.length,
      },
    };
  }

  async detectPatternsIncremental(
    _existingStudies: AIStudy[],
    newCandles: Candle[],
    options: DetectionOptions = {}
  ): Promise<DetectionResult> {
    return this.detectPatterns(newCandles, options);
  }

  private lastDetection: {
    candles: Candle[];
    pivots: PivotPoint[];
    studies: AIStudy[];
  } | null = null;

  getCachedPivots(): PivotPoint[] | null {
    return this.lastDetection?.pivots || null;
  }

  clearCache(): void {
    this.lastDetection = null;
  }
}

export const patternDetectionService = new PatternDetectionService();
