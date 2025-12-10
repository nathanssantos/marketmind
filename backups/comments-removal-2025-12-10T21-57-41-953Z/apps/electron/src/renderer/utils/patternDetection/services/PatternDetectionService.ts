import type { AIPattern, Kline } from '@marketmind/types';
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
    klines: Kline[],
    options: DetectionOptions = {}
  ): Promise<DetectionResult> {
    const startTime = performance.now();
    
    const {
      minConfidence = PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD,
      pivotSensitivity = PATTERN_DETECTION_CONFIG.PIVOT_LOOKBACK_DEFAULT,
      enabledPatterns,
    } = options;

    const pivots = findPivotPoints(klines, pivotSensitivity, pivotSensitivity);
    
    const allPatterns: AIPattern[] = [];

    if (!enabledPatterns || enabledPatterns.includes('support')) {
      allPatterns.push(...detectSupport(klines, pivots));
    }
    
    if (!enabledPatterns || enabledPatterns.includes('resistance')) {
      allPatterns.push(...detectResistance(klines, pivots));
    }
    
    if (!enabledPatterns || enabledPatterns.includes('trendline-bullish')) {
      allPatterns.push(...detectBullishTrendlines(klines, pivots));
    }
    
    if (!enabledPatterns || enabledPatterns.includes('trendline-bearish')) {
      allPatterns.push(...detectBearishTrendlines(klines, pivots));
    }
    
    if (!enabledPatterns || enabledPatterns.includes('fibonacci-retracement')) {
      allPatterns.push(...detectFibonacciRetracements(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('fibonacci-extension')) {
      allPatterns.push(...detectFibonacciExtensions(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('channel-ascending')) {
      allPatterns.push(...detectAscendingChannels(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('channel-descending')) {
      allPatterns.push(...detectDescendingChannels(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('channel-horizontal')) {
      allPatterns.push(...detectHorizontalChannels(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('triangle-ascending')) {
      allPatterns.push(...detectAscendingTriangles(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('triangle-descending')) {
      allPatterns.push(...detectDescendingTriangles(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('triangle-symmetrical')) {
      allPatterns.push(...detectSymmetricalTriangles(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('wedge-rising')) {
      allPatterns.push(...detectRisingWedges(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('wedge-falling')) {
      allPatterns.push(...detectFallingWedges(klines, pivots));
    }
    
    if (!enabledPatterns || enabledPatterns.includes('head-and-shoulders')) {
      allPatterns.push(...detectHeadAndShoulders(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('inverse-head-and-shoulders')) {
      allPatterns.push(...detectInverseHeadAndShoulders(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('double-top')) {
      allPatterns.push(...detectDoubleTops(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('double-bottom')) {
      allPatterns.push(...detectDoubleBottoms(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('triple-top')) {
      allPatterns.push(...detectTripleTops(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('triple-bottom')) {
      allPatterns.push(...detectTripleBottoms(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('flag-bullish')) {
      allPatterns.push(...detectBullishFlags(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('flag-bearish')) {
      allPatterns.push(...detectBearishFlags(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('pennant')) {
      allPatterns.push(...detectPennants(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('cup-and-handle')) {
      allPatterns.push(...detectCupAndHandle(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('rounding-bottom')) {
      allPatterns.push(...detectRoundingBottom(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('gap-common')) {
      allPatterns.push(...detectCommonGaps(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('gap-breakaway')) {
      allPatterns.push(...detectBreakawayGaps(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('gap-runaway')) {
      allPatterns.push(...detectRunawayGaps(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('gap-exhaustion')) {
      allPatterns.push(...detectExhaustionGaps(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('buy-zone')) {
      allPatterns.push(...detectBuyZones(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('sell-zone')) {
      allPatterns.push(...detectSellZones(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('liquidity-zone')) {
      allPatterns.push(...detectLiquidityZones(klines, pivots));
    }

    if (!enabledPatterns || enabledPatterns.includes('accumulation-zone')) {
      allPatterns.push(...detectAccumulationZones(klines, pivots));
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
        pattern.importanceScore = calculateImportanceScore(pattern, klines);
        pattern.tier = classifyPatternTier(pattern, klines);
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
        klinesAnalyzed: klines.length,
      },
    };
  }

  async detectPatternsIncremental(
    _existingPatterns: AIPattern[],
    newKlines: Kline[],
    options: DetectionOptions = {}
  ): Promise<DetectionResult> {
    return this.detectPatterns(newKlines, options);
  }

  private lastDetection: {
    klines: Kline[];
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
