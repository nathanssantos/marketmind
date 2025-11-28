import type { AIPattern, Candle } from '@shared/types';

export enum PatternTier {
  MACRO = 'macro',
  MAJOR = 'major',
  INTERMEDIATE = 'intermediate',
  MINOR = 'minor',
  MICRO = 'micro',
}

export type RelationshipType = 'nested' | 'overlapping' | 'conflicting';

export interface PatternRelationship {
  parentPattern: AIPattern;
  childPattern: AIPattern;
  relationshipType: RelationshipType;
  overlapPercentage: number;
  timeOverlap: number;
  priceOverlap: number;
}

export function getPatternStartTimestamp(pattern: AIPattern): number {
  switch (pattern.type) {
    case 'support':
    case 'resistance':
    case 'trendline-bullish':
    case 'trendline-bearish':
      return Math.min(pattern.points[0].timestamp, pattern.points[1].timestamp);

    case 'channel-ascending':
    case 'channel-descending':
    case 'channel-horizontal':
      return Math.min(
        pattern.upperLine[0].timestamp,
        pattern.upperLine[1].timestamp,
        pattern.lowerLine[0].timestamp,
        pattern.lowerLine[1].timestamp
      );

    case 'fibonacci-retracement':
    case 'fibonacci-extension':
      return Math.min(pattern.startPoint.timestamp, pattern.endPoint.timestamp);

    case 'head-and-shoulders':
    case 'inverse-head-and-shoulders':
      return Math.min(
        pattern.leftShoulder.timestamp,
        pattern.head.timestamp,
        pattern.rightShoulder.timestamp
      );

    case 'double-top':
    case 'double-bottom':
      return Math.min(pattern.firstPeak.timestamp, pattern.secondPeak.timestamp);

    case 'triple-top':
    case 'triple-bottom':
      return Math.min(
        pattern.peak1.timestamp,
        pattern.peak2.timestamp,
        pattern.peak3.timestamp
      );

    case 'triangle-ascending':
    case 'triangle-descending':
    case 'triangle-symmetrical':
      return Math.min(
        pattern.upperTrendline[0].timestamp,
        pattern.lowerTrendline[0].timestamp
      );

    case 'wedge-rising':
    case 'wedge-falling':
      return Math.min(
        pattern.upperTrendline[0].timestamp,
        pattern.lowerTrendline[0].timestamp
      );

    case 'flag-bullish':
    case 'flag-bearish':
      return pattern.flagpole.start.timestamp;

    case 'pennant':
      return pattern.flagpole.start.timestamp;

    case 'cup-and-handle':
      return pattern.cupStart.timestamp;

    case 'rounding-bottom':
      return pattern.start.timestamp;

    case 'gap-common':
    case 'gap-breakaway':
    case 'gap-runaway':
    case 'gap-exhaustion':
      return Math.min(pattern.gapStart.timestamp, pattern.gapEnd.timestamp);

    case 'liquidity-zone':
    case 'sell-zone':
    case 'buy-zone':
    case 'accumulation-zone':
      return pattern.startTimestamp;

    default:
      return (pattern as { timestamp?: number }).timestamp ?? 0;
  }
}

export function getPatternEndTimestamp(pattern: AIPattern): number {
  switch (pattern.type) {
    case 'support':
    case 'resistance':
    case 'trendline-bullish':
    case 'trendline-bearish':
      return Math.max(pattern.points[0].timestamp, pattern.points[1].timestamp);

    case 'channel-ascending':
    case 'channel-descending':
    case 'channel-horizontal':
      return Math.max(
        pattern.upperLine[0].timestamp,
        pattern.upperLine[1].timestamp,
        pattern.lowerLine[0].timestamp,
        pattern.lowerLine[1].timestamp
      );

    case 'fibonacci-retracement':
    case 'fibonacci-extension':
      return Math.max(pattern.startPoint.timestamp, pattern.endPoint.timestamp);

    case 'head-and-shoulders':
    case 'inverse-head-and-shoulders':
      return Math.max(
        pattern.leftShoulder.timestamp,
        pattern.head.timestamp,
        pattern.rightShoulder.timestamp,
        pattern.neckline[0].timestamp,
        pattern.neckline[1].timestamp
      );

    case 'double-top':
    case 'double-bottom':
      return Math.max(pattern.firstPeak.timestamp, pattern.secondPeak.timestamp);

    case 'triple-top':
    case 'triple-bottom':
      return Math.max(
        pattern.peak1.timestamp,
        pattern.peak2.timestamp,
        pattern.peak3.timestamp
      );

    case 'triangle-ascending':
    case 'triangle-descending':
    case 'triangle-symmetrical':
      return Math.max(
        pattern.upperTrendline[1].timestamp,
        pattern.lowerTrendline[1].timestamp
      );

    case 'wedge-rising':
    case 'wedge-falling':
      return Math.max(
        pattern.upperTrendline[1].timestamp,
        pattern.lowerTrendline[1].timestamp
      );

    case 'flag-bullish':
    case 'flag-bearish':
      return Math.max(
        pattern.flag.upperTrendline[1].timestamp,
        pattern.flag.lowerTrendline[1].timestamp
      );

    case 'pennant':
      return Math.max(
        pattern.pennant.upperTrendline[1].timestamp,
        pattern.pennant.lowerTrendline[1].timestamp
      );

    case 'cup-and-handle':
      return pattern.handleEnd.timestamp;

    case 'rounding-bottom':
      return pattern.end.timestamp;

    case 'gap-common':
    case 'gap-breakaway':
    case 'gap-runaway':
    case 'gap-exhaustion':
      return Math.max(pattern.gapStart.timestamp, pattern.gapEnd.timestamp);

    case 'liquidity-zone':
    case 'sell-zone':
    case 'buy-zone':
    case 'accumulation-zone':
      return pattern.endTimestamp;

    default:
      return (pattern as { timestamp?: number }).timestamp ?? 0;
  }
}

export function getPatternMinPrice(pattern: AIPattern): number {
  switch (pattern.type) {
    case 'support':
    case 'resistance':
    case 'trendline-bullish':
    case 'trendline-bearish':
      return Math.min(pattern.points[0].price, pattern.points[1].price);

    case 'channel-ascending':
    case 'channel-descending':
    case 'channel-horizontal':
      return Math.min(
        pattern.upperLine[0].price,
        pattern.upperLine[1].price,
        pattern.lowerLine[0].price,
        pattern.lowerLine[1].price
      );

    case 'fibonacci-retracement':
    case 'fibonacci-extension':
      return Math.min(pattern.startPoint.price, pattern.endPoint.price);

    case 'head-and-shoulders':
    case 'inverse-head-and-shoulders':
      return Math.min(
        pattern.leftShoulder.price,
        pattern.head.price,
        pattern.rightShoulder.price,
        pattern.neckline[0].price,
        pattern.neckline[1].price
      );

    case 'double-top':
    case 'double-bottom':
      return Math.min(
        pattern.firstPeak.price,
        pattern.secondPeak.price,
        pattern.neckline.price
      );

    case 'triple-top':
    case 'triple-bottom':
      return Math.min(
        pattern.peak1.price,
        pattern.peak2.price,
        pattern.peak3.price,
        pattern.neckline[0].price,
        pattern.neckline[1].price
      );

    case 'triangle-ascending':
    case 'triangle-descending':
    case 'triangle-symmetrical':
      return Math.min(
        pattern.upperTrendline[0].price,
        pattern.upperTrendline[1].price,
        pattern.lowerTrendline[0].price,
        pattern.lowerTrendline[1].price
      );

    case 'wedge-rising':
    case 'wedge-falling':
      return Math.min(
        pattern.upperTrendline[0].price,
        pattern.upperTrendline[1].price,
        pattern.lowerTrendline[0].price,
        pattern.lowerTrendline[1].price
      );

    case 'flag-bullish':
    case 'flag-bearish':
      return Math.min(
        pattern.flagpole.start.price,
        pattern.flagpole.end.price,
        pattern.flag.upperTrendline[0].price,
        pattern.flag.lowerTrendline[0].price
      );

    case 'pennant':
      return Math.min(
        pattern.flagpole.start.price,
        pattern.flagpole.end.price,
        pattern.pennant.upperTrendline[0].price,
        pattern.pennant.lowerTrendline[0].price
      );

    case 'cup-and-handle':
      return Math.min(
        pattern.cupStart.price,
        pattern.cupBottom.price,
        pattern.handleLow.price
      );

    case 'rounding-bottom':
      return Math.min(pattern.start.price, pattern.bottom.price, pattern.end.price);

    case 'gap-common':
    case 'gap-breakaway':
    case 'gap-runaway':
    case 'gap-exhaustion':
      return Math.min(pattern.gapStart.price, pattern.gapEnd.price);

    case 'liquidity-zone':
    case 'sell-zone':
    case 'buy-zone':
    case 'accumulation-zone':
      return pattern.bottomPrice;

    default:
      return 0;
  }
}

export function getPatternMaxPrice(pattern: AIPattern): number {
  switch (pattern.type) {
    case 'support':
    case 'resistance':
    case 'trendline-bullish':
    case 'trendline-bearish':
      return Math.max(pattern.points[0].price, pattern.points[1].price);

    case 'channel-ascending':
    case 'channel-descending':
    case 'channel-horizontal':
      return Math.max(
        pattern.upperLine[0].price,
        pattern.upperLine[1].price,
        pattern.lowerLine[0].price,
        pattern.lowerLine[1].price
      );

    case 'fibonacci-retracement':
    case 'fibonacci-extension':
      return Math.max(pattern.startPoint.price, pattern.endPoint.price);

    case 'head-and-shoulders':
    case 'inverse-head-and-shoulders':
      return Math.max(
        pattern.leftShoulder.price,
        pattern.head.price,
        pattern.rightShoulder.price,
        pattern.neckline[0].price,
        pattern.neckline[1].price
      );

    case 'double-top':
    case 'double-bottom':
      return Math.max(
        pattern.firstPeak.price,
        pattern.secondPeak.price,
        pattern.neckline.price
      );

    case 'triple-top':
    case 'triple-bottom':
      return Math.max(
        pattern.peak1.price,
        pattern.peak2.price,
        pattern.peak3.price,
        pattern.neckline[0].price,
        pattern.neckline[1].price
      );

    case 'triangle-ascending':
    case 'triangle-descending':
    case 'triangle-symmetrical':
      return Math.max(
        pattern.upperTrendline[0].price,
        pattern.upperTrendline[1].price,
        pattern.lowerTrendline[0].price,
        pattern.lowerTrendline[1].price
      );

    case 'wedge-rising':
    case 'wedge-falling':
      return Math.max(
        pattern.upperTrendline[0].price,
        pattern.upperTrendline[1].price,
        pattern.lowerTrendline[0].price,
        pattern.lowerTrendline[1].price
      );

    case 'flag-bullish':
    case 'flag-bearish':
      return Math.max(
        pattern.flagpole.start.price,
        pattern.flagpole.end.price,
        pattern.flag.upperTrendline[0].price,
        pattern.flag.lowerTrendline[0].price
      );

    case 'pennant':
      return Math.max(
        pattern.flagpole.start.price,
        pattern.flagpole.end.price,
        pattern.pennant.upperTrendline[0].price,
        pattern.pennant.lowerTrendline[0].price
      );

    case 'cup-and-handle':
      return Math.max(
        pattern.cupStart.price,
        pattern.cupEnd.price,
        pattern.handleEnd.price
      );

    case 'rounding-bottom':
      return Math.max(pattern.start.price, pattern.bottom.price, pattern.end.price);

    case 'gap-common':
    case 'gap-breakaway':
    case 'gap-runaway':
    case 'gap-exhaustion':
      return Math.max(pattern.gapStart.price, pattern.gapEnd.price);

    case 'liquidity-zone':
    case 'sell-zone':
    case 'buy-zone':
    case 'accumulation-zone':
      return pattern.topPrice;

    default:
      return 0;
  }
}

export function detectTimeOverlap(pattern1: AIPattern, pattern2: AIPattern): number {
  const start1 = getPatternStartTimestamp(pattern1);
  const end1 = getPatternEndTimestamp(pattern1);
  const start2 = getPatternStartTimestamp(pattern2);
  const end2 = getPatternEndTimestamp(pattern2);

  const overlapStart = Math.max(start1, start2);
  const overlapEnd = Math.min(end1, end2);

  if (overlapStart >= overlapEnd) return 0;

  const overlapDuration = overlapEnd - overlapStart;

  const duration1 = end1 - start1;
  const duration2 = end2 - start2;
  const minDuration = Math.min(duration1, duration2);

  return minDuration > 0 ? (overlapDuration / minDuration) * 100 : 0;
}

export function detectPriceOverlap(pattern1: AIPattern, pattern2: AIPattern): number {
  const min1 = getPatternMinPrice(pattern1);
  const max1 = getPatternMaxPrice(pattern1);
  const min2 = getPatternMinPrice(pattern2);
  const max2 = getPatternMaxPrice(pattern2);

  const overlapMin = Math.max(min1, min2);
  const overlapMax = Math.min(max1, max2);

  if (overlapMin >= overlapMax) return 0;

  const overlapRange = overlapMax - overlapMin;

  const range1 = max1 - min1;
  const range2 = max2 - min2;
  const minRange = Math.min(range1, range2);

  return minRange > 0 ? (overlapRange / minRange) * 100 : 0;
}

export function isNested(child: AIPattern, parent: AIPattern): boolean {
  const childStart = getPatternStartTimestamp(child);
  const childEnd = getPatternEndTimestamp(child);
  const parentStart = getPatternStartTimestamp(parent);
  const parentEnd = getPatternEndTimestamp(parent);

  const childMin = getPatternMinPrice(child);
  const childMax = getPatternMaxPrice(child);
  const parentMin = getPatternMinPrice(parent);
  const parentMax = getPatternMaxPrice(parent);

  const childDuration = childEnd - childStart;
  const timeStart = Math.max(childStart, parentStart);
  const timeEnd = Math.min(childEnd, parentEnd);
  const timeContainment = childDuration > 0 ? ((timeEnd - timeStart) / childDuration) * 100 : 0;

  const childRange = childMax - childMin;
  const priceMin = Math.max(childMin, parentMin);
  const priceMax = Math.min(childMax, parentMax);

  let priceContainment = 0;
  if (childRange > 0) {
    priceContainment = ((priceMax - priceMin) / childRange) * 100;
  } else if (childMin >= parentMin && childMax <= parentMax) {
    priceContainment = 100;
  }

  return timeContainment > 90 && priceContainment > 80;
}

function determineRelationshipType(
  pattern1: AIPattern,
  pattern2: AIPattern,
  timeOverlap: number,
  priceOverlap: number
): RelationshipType {
  if (timeOverlap > 50 && priceOverlap > 50) {
    const bullish1 = isBullishPattern(pattern1);
    const bearish1 = isBearishPattern(pattern1);
    const bullish2 = isBullishPattern(pattern2);
    const bearish2 = isBearishPattern(pattern2);

    if ((bullish1 && bearish2) || (bearish1 && bullish2)) return 'conflicting';
  }

  if (isNested(pattern1, pattern2) || isNested(pattern2, pattern1)) return 'nested';

  return 'overlapping';
}

function isBullishPattern(pattern: AIPattern): boolean {
  const bullishPatterns: AIPattern['type'][] = [
    'inverse-head-and-shoulders',
    'double-bottom',
    'triple-bottom',
    'triangle-ascending',
    'wedge-falling',
    'flag-bullish',
    'cup-and-handle',
    'rounding-bottom',
    'trendline-bullish',
    'channel-ascending',
    'support',
    'buy-zone',
  ];

  return bullishPatterns.includes(pattern.type);
}

function isBearishPattern(pattern: AIPattern): boolean {
  const bearishPatterns: AIPattern['type'][] = [
    'head-and-shoulders',
    'double-top',
    'triple-top',
    'triangle-descending',
    'wedge-rising',
    'flag-bearish',
    'trendline-bearish',
    'channel-descending',
    'resistance',
    'sell-zone',
  ];

  return bearishPatterns.includes(pattern.type);
}

export function buildPatternRelationships(
  patterns: AIPattern[]
): PatternRelationship[] {
  const relationships: PatternRelationship[] = [];

  for (let i = 0; i < patterns.length; i++) {
    for (let j = i + 1; j < patterns.length; j++) {
      const pattern1 = patterns[i];
      const pattern2 = patterns[j];

      if (!pattern1 || !pattern2) continue;

      const timeOverlap = detectTimeOverlap(pattern1, pattern2);
      const priceOverlap = detectPriceOverlap(pattern1, pattern2);

      if (timeOverlap > 30 || priceOverlap > 30) {

        const relationshipType = determineRelationshipType(
          pattern1,
          pattern2,
          timeOverlap,
          priceOverlap
        );

        const duration1 =
          getPatternEndTimestamp(pattern1) - getPatternStartTimestamp(pattern1);
        const duration2 =
          getPatternEndTimestamp(pattern2) - getPatternStartTimestamp(pattern2);

        const parentPattern = duration1 >= duration2 ? pattern1 : pattern2;
        const childPattern = duration1 >= duration2 ? pattern2 : pattern1;

        relationships.push({
          parentPattern,
          childPattern,
          relationshipType,
          overlapPercentage: (timeOverlap + priceOverlap) / 2,
          timeOverlap,
          priceOverlap,
        });
      }
    }
  }

  return relationships;
}

export function calculateFormationPeriod(
  pattern: AIPattern,
  candles: Candle[]
): number {
  if (candles.length === 0) return 0;

  const startTime = getPatternStartTimestamp(pattern);
  const endTime = getPatternEndTimestamp(pattern);
  const duration = endTime - startTime;

  if (candles.length < 2) return 1;

  const firstCandle = candles[0];
  const lastCandle = candles[candles.length - 1];
  if (!firstCandle || !lastCandle) return 1;

  const avgCandleInterval =
    (lastCandle.timestamp - firstCandle.timestamp) /
    (candles.length - 1);

  const candleCount = Math.max(1, Math.round(duration / avgCandleInterval));

  return candleCount;
}

export function classifyPatternTier(
  pattern: AIPattern,
  candles: Candle[]
): PatternTier {
  const formationPeriod = calculateFormationPeriod(pattern, candles);

  if (formationPeriod >= 100) return PatternTier.MACRO;
  if (formationPeriod >= 50) return PatternTier.MAJOR;
  if (formationPeriod >= 20) return PatternTier.INTERMEDIATE;
  if (formationPeriod >= 10) return PatternTier.MINOR;
  return PatternTier.MICRO;
}
