import type { AIStudy } from '../../../../shared/types';
import type { PatternRelationship } from './patternRelationships';
import {
  getPatternEndTimestamp,
  getPatternStartTimestamp,
} from './patternRelationships';

const TEMPORAL_DURATION_MS = {
  MIN: 0,
  MAX: Number.MAX_SAFE_INTEGER,
} as const;

export function resolveNestedPatterns(
  patterns: AIStudy[],
  relationships: PatternRelationship[]
): AIStudy[] {
  const patternsToRemove = new Set<number>();

  relationships
    .filter((rel) => rel.relationshipType === 'nested')
    .filter((rel) => rel.parentPattern.type === rel.childPattern.type)
    .forEach((rel) => {
      resolveNestedPair(rel, patternsToRemove);
    });

  return patterns.filter((pattern) => {
    if (pattern.id === undefined) return true;
    return !patternsToRemove.has(pattern.id);
  });
}

function resolveNestedPair(
  relationship: PatternRelationship,
  patternsToRemove: Set<number>
): void {
  const parent = relationship.parentPattern;
  const child = relationship.childPattern;

  const parentDuration = calculatePatternDuration(parent);
  const childDuration = calculatePatternDuration(child);

  if (parentDuration > childDuration && child.id !== undefined) {
    patternsToRemove.add(child.id);
  } else if (childDuration > parentDuration && parent.id !== undefined) {
    patternsToRemove.add(parent.id);
  } else if (parentDuration === childDuration) {
    resolveTiedPatterns(parent, child, patternsToRemove);
  }
}

function resolveTiedPatterns(
  parent: AIStudy,
  child: AIStudy,
  patternsToRemove: Set<number>
): void {
  const parentConfidence = parent.confidence ?? 0;
  const childConfidence = child.confidence ?? 0;
  const parentId = parent.id ?? 0;
  const childId = child.id ?? 0;

  if (parentConfidence > childConfidence && child.id !== undefined) {
    patternsToRemove.add(child.id);
  } else if (childConfidence > parentConfidence && parent.id !== undefined) {
    patternsToRemove.add(parent.id);
  } else if (parentId < childId && child.id !== undefined) {
    patternsToRemove.add(child.id);
  } else if (parent.id !== undefined) {
    patternsToRemove.add(parent.id);
  }
}

function calculatePatternDuration(pattern: AIStudy): number {
  const startTime = getPatternStartTimestamp(pattern);
  const endTime = getPatternEndTimestamp(pattern);

  if (startTime === TEMPORAL_DURATION_MS.MIN || endTime === TEMPORAL_DURATION_MS.MAX) {
    return TEMPORAL_DURATION_MS.MIN;
  }

  return endTime - startTime;
}

export function resolveOverlappingPatterns(
  patterns: AIStudy[],
  relationships: PatternRelationship[]
): AIStudy[] {
  const patternsToRemove = new Set<number>();

  relationships
    .filter((rel) => rel.relationshipType === 'overlapping')
    .forEach((rel) => {
      resolveOverlappingPair(rel, patternsToRemove);
    });

  return patterns.filter((pattern) => {
    if (pattern.id === undefined) return true;
    return !patternsToRemove.has(pattern.id);
  });
}

function resolveOverlappingPair(
  relationship: PatternRelationship,
  patternsToRemove: Set<number>
): void {
  const pattern1 = relationship.parentPattern;
  const pattern2 = relationship.childPattern;

  const importance1 = pattern1.importanceScore ?? 0;
  const importance2 = pattern2.importanceScore ?? 0;

  if (importance1 > importance2 && pattern2.id !== undefined) {
    patternsToRemove.add(pattern2.id);
  } else if (importance2 > importance1 && pattern1.id !== undefined) {
    patternsToRemove.add(pattern1.id);
  } else if (importance1 === importance2) {
    resolveTiedImportance(pattern1, pattern2, patternsToRemove);
  }
}

function resolveTiedImportance(
  pattern1: AIStudy,
  pattern2: AIStudy,
  patternsToRemove: Set<number>
): void {
  const confidence1 = pattern1.confidence ?? 0;
  const confidence2 = pattern2.confidence ?? 0;
  const id1 = pattern1.id ?? 0;
  const id2 = pattern2.id ?? 0;

  if (confidence1 > confidence2 && pattern2.id !== undefined) {
    patternsToRemove.add(pattern2.id);
  } else if (confidence2 > confidence1 && pattern1.id !== undefined) {
    patternsToRemove.add(pattern1.id);
  } else if (id1 < id2 && pattern2.id !== undefined) {
    patternsToRemove.add(pattern2.id);
  } else if (pattern1.id !== undefined) {
    patternsToRemove.add(pattern1.id);
  }
}

export function markConflictingPatterns(
  patterns: AIStudy[],
  relationships: PatternRelationship[]
): AIStudy[] {
  const conflictMap = new Map<number, Set<number>>();

  relationships
    .filter((rel) => rel.relationshipType === 'conflicting')
    .forEach((rel) => {
      const id1 = rel.parentPattern.id;
      const id2 = rel.childPattern.id;

      if (id1 === undefined || id2 === undefined) return;

      if (!conflictMap.has(id1)) conflictMap.set(id1, new Set());
      if (!conflictMap.has(id2)) conflictMap.set(id2, new Set());

      conflictMap.get(id1)!.add(id2);
      conflictMap.get(id2)!.add(id1);
    });

  return patterns.map((pattern) => {
    if (pattern.id === undefined) return pattern;

    const conflictingIds = conflictMap.get(pattern.id);
    if (!conflictingIds || conflictingIds.size === 0) return pattern;

    return {
      ...pattern,
      hasConflict: true,
      conflictingPatterns: Array.from(conflictingIds),
    };
  });
}

export function applyTierLimits(
  patterns: AIStudy[],
  maxPatternsPerTier: { macro: number; major: number; intermediate: number; minor: number }
): AIStudy[] {
  const patternsByTier = {
    macro: patterns.filter((p) => p.tier === 'macro'),
    major: patterns.filter((p) => p.tier === 'major'),
    intermediate: patterns.filter((p) => p.tier === 'intermediate'),
    minor: patterns.filter((p) => p.tier === 'minor'),
  };

  const sortByImportance = (a: AIStudy, b: AIStudy): number =>
    (b.importanceScore ?? 0) - (a.importanceScore ?? 0);

  const limitedMacro = patternsByTier.macro
    .sort(sortByImportance)
    .slice(0, maxPatternsPerTier.macro);

  const limitedMajor = patternsByTier.major
    .sort(sortByImportance)
    .slice(0, maxPatternsPerTier.major);

  const limitedIntermediate = patternsByTier.intermediate
    .sort(sortByImportance)
    .slice(0, maxPatternsPerTier.intermediate);

  const limitedMinor = patternsByTier.minor
    .sort(sortByImportance)
    .slice(0, maxPatternsPerTier.minor);

  return [...limitedMacro, ...limitedMajor, ...limitedIntermediate, ...limitedMinor];
}

export function applyCategoryLimits(
  patterns: AIStudy[],
  maxPatternsPerCategory: number
): AIStudy[] {
  const patternsByCategory = new Map<string, AIStudy[]>();

  patterns.forEach((pattern) => {
    const category = getPatternCategory(pattern.type);
    if (!patternsByCategory.has(category)) {
      patternsByCategory.set(category, []);
    }
    patternsByCategory.get(category)!.push(pattern);
  });

  const result: AIStudy[] = [];

  patternsByCategory.forEach((categoryPatterns) => {
    const sortedByImportance = categoryPatterns.sort(
      (a, b) => (b.importanceScore ?? 0) - (a.importanceScore ?? 0)
    );
    result.push(...sortedByImportance.slice(0, maxPatternsPerCategory));
  });

  return result;
}

function getPatternCategory(type: string): string {
  const categories: Record<string, string[]> = {
    'support-resistance': ['support', 'resistance'],
    'trendlines': ['trendline-bullish', 'trendline-bearish'],
    'channels': ['channel-ascending', 'channel-descending', 'channel-horizontal'],
    'triangles': ['triangle-ascending', 'triangle-descending', 'triangle-symmetrical'],
    'wedges': ['wedge-rising', 'wedge-falling'],
    'head-shoulders': [
      'head-and-shoulders',
      'inverse-head-and-shoulders',
      'head-and-shoulders-complex',
      'inverse-head-and-shoulders-complex',
    ],
    'double-triple': [
      'double-top',
      'double-bottom',
      'triple-top',
      'triple-bottom',
    ],
    'continuation': [
      'flag-bullish',
      'flag-bearish',
      'pennant-bullish',
      'pennant-bearish',
    ],
    'gaps': [
      'gap-common',
      'gap-breakaway',
      'gap-runaway',
      'gap-exhaustion',
    ],
    'zones': [
      'liquidity-zone',
      'supply-zone',
      'demand-zone',
      'sell-zone',
      'buy-zone',
      'accumulation-zone',
    ],
    'fibonacci': [
      'fibonacci-retracement',
      'fibonacci-extension',
    ],
  };

  for (const [category, types] of Object.entries(categories)) {
    if (types.includes(type)) return category;
  }

  return 'other';
}

export function filterAndPrioritizePatterns(
  patterns: AIStudy[],
  relationships: PatternRelationship[],
  config: {
    enableNestedFiltering: boolean;
    enableOverlapFiltering: boolean;
    maxPatternsPerTier: { macro: number; major: number; intermediate: number; minor: number };
    maxPatternsPerCategory: number;
    maxPatternsTotal: number;
  }
): AIStudy[] {
  let filtered = [...patterns];

  if (config.enableNestedFiltering) {
    filtered = resolveNestedPatterns(filtered, relationships);
  }

  if (config.enableOverlapFiltering) {
    filtered = resolveOverlappingPatterns(filtered, relationships);
  }

  filtered = markConflictingPatterns(filtered, relationships);

  filtered = applyTierLimits(filtered, config.maxPatternsPerTier);

  filtered = applyCategoryLimits(filtered, config.maxPatternsPerCategory);

  const sortedByImportance = filtered.sort(
    (a, b) => (b.importanceScore ?? 0) - (a.importanceScore ?? 0)
  );

  return sortedByImportance.slice(0, config.maxPatternsTotal);
}
