import type { AIPattern, Candle } from '@shared/types';
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
  private workerBuildRelationships: ((patterns: AIPattern[], useWorker?: boolean) => Promise<PatternRelationship[]>) | null = null;

  setWorkerBuildRelationships(
    buildRelationships: (patterns: AIPattern[], useWorker?: boolean) => Promise<PatternRelationship[]>
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
    
    const allPatterns: AIPattern[] = [];

    if (!enabledPatterns || enabledPatterns.includes('support')) {
      allPatterns.push(...detectSupport(candles, pivots));
    }
    
    if (!enabledPatterns || enabledPatterns.includes('resistance')) {
      allPatterns.push(...detectResistance(candles, pivots));
    }
    
    if (!enabledPatterns || enabledPatterns.includes('trendline-bullish')) {
      allPatterns.push(...detectBullishTrendlines(candles, pivots));
    }
    
    if (!enabledPatterns || enabledPatterns.includes('trendline-bearish')) {
      allPatterns.push(...detectBearishTrendlines(candles, pivots));
    }
    
    if (!enabledPatterns || enabledPatterns.includes('fibonacci-retracement')) {
      allPatterns.push(...detectFibonacciRetracements(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('fibonacci-extension')) {
      allPatterns.push(...detectFibonacciExtensions(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('channel-ascending')) {
      allPatterns.push(...detectAscendingChannels(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('channel-descending')) {
      allPatterns.push(...detectDescendingChannels(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('channel-horizontal')) {
      allPatterns.push(...detectHorizontalChannels(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('triangle-ascending')) {
      allPatterns.push(...detectAscendingTriangles(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('triangle-descending')) {
      allPatterns.push(...detectDescendingTriangles(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('triangle-symmetrical')) {
      allPatterns.push(...detectSymmetricalTriangles(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('wedge-rising')) {
      allPatterns.push(...detectRisingWedges(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('wedge-falling')) {
      allPatterns.push(...detectFallingWedges(candles, pivots));
    }
    
    if (!enabledPatterns || enabledPatterns.includes('head-and-shoulders')) {
      allPatterns.push(...detectHeadAndShoulders(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('inverse-head-and-shoulders')) {
      allPatterns.push(...detectInverseHeadAndShoulders(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('double-top')) {
      allPatterns.push(...detectDoubleTops(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('double-bottom')) {
      allPatterns.push(...detectDoubleBottoms(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('triple-top')) {
      allPatterns.push(...detectTripleTops(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('triple-bottom')) {
      allPatterns.push(...detectTripleBottoms(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('flag-bullish')) {
      allPatterns.push(...detectBullishFlags(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('flag-bearish')) {
      allPatterns.push(...detectBearishFlags(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('pennant')) {
      allPatterns.push(...detectPennants(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('cup-and-handle')) {
      allPatterns.push(...detectCupAndHandle(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('rounding-bottom')) {
      allPatterns.push(...detectRoundingBottom(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('gap-common')) {
      allPatterns.push(...detectCommonGaps(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('gap-breakaway')) {
      allPatterns.push(...detectBreakawayGaps(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('gap-runaway')) {
      allPatterns.push(...detectRunawayGaps(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('gap-exhaustion')) {
      allPatterns.push(...detectExhaustionGaps(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('buy-zone')) {
      allPatterns.push(...detectBuyZones(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('sell-zone')) {
      allPatterns.push(...detectSellZones(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('liquidity-zone')) {
      allPatterns.push(...detectLiquidityZones(candles, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('accumulation-zone')) {
      allPatterns.push(...detectAccumulationZones(candles, pivots));
    }

    const filteredPatterns = allPatterns.filter(
      pattern => (pattern.confidence || 0) >= minConfidence
    );

    const sortedPatterns = filteredPatterns.sort(
      (a, b) => (b.confidence || 0) - (a.confidence || 0)
    );

    let patternId = 1;
    sortedPatterns.forEach(pattern => {
      pattern.id = patternId++;
    });

    let finalPatterns = sortedPatterns;

    if (options.applyFiltering && sortedPatterns.length > 0) {
      console.log('[PatternDetection] Before filtering:', sortedPatterns.length, 'patterns');
      
      sortedPatterns.forEach(pattern => {
        pattern.importanceScore = calculateImportanceScore(pattern, candles);
        pattern.tier = classifyPatternTier(pattern, candles);
      });

      let relationships: PatternRelationship[];
      
      try {
        if (this.workerBuildRelationships) {
          relationships = await this.workerBuildRelationships(sortedPatterns, options.useWorker ?? true);
        } else {
          relationships = buildPatternRelationships(sortedPatterns);
        }
      } catch {
        relationships = buildPatternRelationships(sortedPatterns);
      }
      
      finalPatterns = filterAndPrioritizePatterns(
        sortedPatterns,
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
      patterns: finalPatterns,
      metadata: {
        pivotsFound: pivots.length,
        patternsDetected: finalPatterns.length,
        executionTime,
        candlesAnalyzed: candles.length,
      },
    };
  }

  async detectPatternsIncremental(
    _existingPatterns: AIPattern[],
    newCandles: Candle[],
    options: DetectionOptions = {}
  ): Promise<DetectionResult> {
    return this.detectPatterns(newCandles, options);
  }

  private lastDetection: {
    candles: Candle[];
    pivots: PivotPoint[];
    patterns: AIPattern[];
  } | null = null;

  getCachedPivots(): PivotPoint[] | null {
    return this.lastDetection?.pivots || null;
  }

  clearCache(): void {
    this.lastDetection = null;
  }
}

export const patternDetectionService = new PatternDetectionService();
