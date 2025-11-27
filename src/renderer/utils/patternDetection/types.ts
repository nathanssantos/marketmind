import type { AIStudy, AIStudyType } from '@shared/types';

export interface PivotPoint {
  index: number;
  price: number;
  timestamp: number;
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
  timestamps: number[];
  indices: number[];
  avgVolume: number;
}

export interface DetectionOptions {
  minConfidence?: number;
  pivotSensitivity?: number;
  enabledPatterns?: AIStudyType[];
  prioritizeRecent?: boolean;
  maxPatternsPerType?: number;
}

export interface DetectionResult {
  studies: AIStudy[];
  metadata: {
    pivotsFound: number;
    patternsDetected: number;
    executionTime: number;
    candlesAnalyzed: number;
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
