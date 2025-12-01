import type { AIPatternLine, AIPatternPoint, Kline } from '@shared/types';
import { PATTERN_DETECTION_CONFIG } from '../constants';
import {
  calculateConfidence,
  normalizeTimeInPattern,
  normalizeTouchPoints,
} from '../core/confidenceScoring';
import { validateVolumeConfirmation } from '../core/volumeAnalysis';
import type { PatternCluster, PivotPoint } from '../types';

const clusterPivotsByPrice = (
  pivots: PivotPoint[],
  tolerancePercent: number = PATTERN_DETECTION_CONFIG.PRICE_TOLERANCE_PERCENT
): PatternCluster[] => {
  if (pivots.length === 0) return [];

  const sortedPivots = [...pivots].sort((a, b) => a.price - b.price);
  const clusters: PatternCluster[] = [];
  
  const firstPivot = sortedPivots[0];
  if (!firstPivot) return [];
  
  let currentCluster: PatternCluster = {
    price: firstPivot.price,
    touches: 1,
    openTimes: [firstPivot.openTime],
    indices: [firstPivot.index],
    avgVolume: firstPivot.volume || 0,
  };

  for (let i = 1; i < sortedPivots.length; i++) {
    const pivot = sortedPivots[i];
    if (!pivot) continue;
    
    const priceDiff = Math.abs(pivot.price - currentCluster.price) / currentCluster.price * 100;

    if (priceDiff <= tolerancePercent) {
      currentCluster.touches++;
      currentCluster.openTimes.push(pivot.openTime);
      currentCluster.indices.push(pivot.index);
      currentCluster.price = (currentCluster.price * (currentCluster.touches - 1) + pivot.price) / currentCluster.touches;
      currentCluster.avgVolume = (currentCluster.avgVolume * (currentCluster.touches - 1) + (pivot.volume || 0)) / currentCluster.touches;
    } else {
      clusters.push(currentCluster);
      currentCluster = {
        price: pivot.price,
        touches: 1,
        openTimes: [pivot.openTime],
        indices: [pivot.index],
        avgVolume: pivot.volume || 0,
      };
    }
  }
  
  clusters.push(currentCluster);
  
  return clusters;
};

export const detectSupport = (
  klines: Kline[],
  pivots: PivotPoint[]
): AIPatternLine[] => {
  const supports: AIPatternLine[] = [];
  const lowPivots = pivots.filter(p => p.type === 'low');
  
  const clusters = clusterPivotsByPrice(lowPivots);
  
  const validClusters = clusters.filter(
    c => c.touches >= PATTERN_DETECTION_CONFIG.MIN_TOUCHES_SUPPORT
  );

  let patternId = 1;
  
  for (const cluster of validClusters) {
    const volumeConfirmation = validateVolumeConfirmation(klines, cluster.indices);
    
    const touchPointsScore = normalizeTouchPoints(
      cluster.touches,
      PATTERN_DETECTION_CONFIG.PREFERRED_PIVOTS_TRENDLINE
    );
    
    const timeScore = normalizeTimeInPattern(
      cluster.openTimes.length,
      PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_KLINES,
      PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_KLINES
    );
    
    const confidence = calculateConfidence({
      touchPoints: touchPointsScore,
      volumeConfirmation: volumeConfirmation ? 1 : 0.3,
      timeInPattern: timeScore,
      symmetry: 1,
    });

    if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

    const firstTouch = cluster.openTimes[0] || 0;
    const lastTouch = cluster.openTimes[cluster.openTimes.length - 1] || 0;
    
    const startPoint: AIPatternPoint = {
      openTime: firstTouch,
      price: cluster.price,
    };
    
    const endPoint: AIPatternPoint = {
      openTime: lastTouch,
      price: cluster.price,
    };

    const startDate = new Date(firstTouch).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endDate = new Date(lastTouch).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const confidencePercent = Math.round(confidence * 100);
    
    supports.push({
      id: patternId++,
      type: 'support',
      points: [startPoint, endPoint],
      label: `Support at ${cluster.price.toFixed(2)} · ${cluster.touches} touches · ${startDate} to ${endDate} · ${confidencePercent}% confidence`,
      confidence,
      visible: true,
      openTime: firstTouch,
    });
  }

  return supports
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};

export const detectResistance = (
  klines: Kline[],
  pivots: PivotPoint[]
): AIPatternLine[] => {
  const resistances: AIPatternLine[] = [];
  const highPivots = pivots.filter(p => p.type === 'high');
  
  const clusters = clusterPivotsByPrice(highPivots);
  
  const validClusters = clusters.filter(
    c => c.touches >= PATTERN_DETECTION_CONFIG.MIN_TOUCHES_RESISTANCE
  );

  let patternId = 1;
  
  for (const cluster of validClusters) {
    const volumeConfirmation = validateVolumeConfirmation(klines, cluster.indices);
    
    const touchPointsScore = normalizeTouchPoints(
      cluster.touches,
      PATTERN_DETECTION_CONFIG.PREFERRED_PIVOTS_TRENDLINE
    );
    
    const timeScore = normalizeTimeInPattern(
      cluster.openTimes.length,
      PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_KLINES,
      PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_KLINES
    );
    
    const confidence = calculateConfidence({
      touchPoints: touchPointsScore,
      volumeConfirmation: volumeConfirmation ? 1 : 0.3,
      timeInPattern: timeScore,
      symmetry: 1,
    });

    if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

    const firstTouch = cluster.openTimes[0] || 0;
    const lastTouch = cluster.openTimes[cluster.openTimes.length - 1] || 0;
    
    const startPoint: AIPatternPoint = {
      openTime: firstTouch,
      price: cluster.price,
    };
    
    const endPoint: AIPatternPoint = {
      openTime: lastTouch,
      price: cluster.price,
    };

    const startDate = new Date(firstTouch).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endDate = new Date(lastTouch).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const confidencePercent = Math.round(confidence * 100);
    
    resistances.push({
      id: patternId++,
      type: 'resistance',
      points: [startPoint, endPoint],
      label: `Resistance at ${cluster.price.toFixed(2)} · ${cluster.touches} touches · ${startDate} to ${endDate} · ${confidencePercent}% confidence`,
      confidence,
      visible: true,
      openTime: firstTouch,
    });
  }

  return resistances
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};
