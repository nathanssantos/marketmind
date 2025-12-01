import type { AIPattern, AIPatternType } from '@shared/types';

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

export interface ImportanceFactors {
  patternReliability: number;
  formationPeriod: number;
  volumeConfirmation: number;
  confidence: number;
  priceMovement: number;
  recency: number;
}

export interface PivotPoint {
  index: number;
  price: number;
  openTime: number;
  type: 'high' | 'low';
  strength: number;
  volume?: number;
}

export interface TrendlineData {
  slope: number;
  intercept: number;
  r2: number;
  points: PivotPoint[];
  angle: number;
}

export interface PatternCluster {
  price: number;
  touches: number;
  openTimes: number[];
  indices: number[];
  avgVolume: number;
}

export interface DetectionOptions {
  minConfidence?: number;
  pivotSensitivity?: number;
  enabledPatterns?: AIPatternType[];
  prioritizeRecent?: boolean;
  maxPatternsPerType?: number;
  applyFiltering?: boolean;
  enableNestedFiltering?: boolean;
  enableOverlapFiltering?: boolean;
  useWorker?: boolean;
  maxPatternsPerTier?: {
    macro: number;
    major: number;
    intermediate: number;
    minor: number;
  };
  maxPatternsPerCategory?: number;
  maxPatternsTotal?: number;
}

export interface DetectionResult {
  patterns: AIPattern[];
  metadata: {
    pivotsFound: number;
    patternsDetected: number;
    executionTime: number;
    klinesAnalyzed: number;
  };
}

export interface VolumeAnalysis {
  average: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  spikes: number[];
  confirmation: boolean;
}

export interface ConfidenceFactors {
  touchPoints: number;
  volumeConfirmation: number;
  timeInPattern: number;
  symmetry: number;
}

export interface Point {
  x: number;
  y: number;
}
