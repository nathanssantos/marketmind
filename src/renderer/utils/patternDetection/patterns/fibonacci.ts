import type { AIPatternFibonacci, AIPatternPoint, Kline } from '@shared/types';
import { PATTERN_DETECTION_CONFIG } from '../constants';
import {
  calculateConfidence,
  normalizeTimeInPattern,
} from '../core/confidenceScoring';
import type { PivotPoint } from '../types';

export const detectFibonacciRetracements = (
  candles: Kline[],
  pivots: PivotPoint[]
): AIPatternFibonacci[] => {
  if (!candles || candles.length === 0) return [];
  
  const fibs: AIPatternFibonacci[] = [];
  
  const highPivots = pivots.filter(p => p.type === 'high').sort((a, b) => b.price - a.price);
  const lowPivots = pivots.filter(p => p.type === 'low').sort((a, b) => a.price - b.price);
  
  if (highPivots.length === 0 || lowPivots.length === 0) return [];
  
  const swingHigh = highPivots[0];
  const swingLow = lowPivots[0];
  
  if (!swingHigh || !swingLow) return [];
  
  const range = swingHigh.price - swingLow.price;
  const priceRangePercent = (range / swingLow.price) * 100;
  
  if (priceRangePercent < PATTERN_DETECTION_CONFIG.MIN_PATTERN_PRICE_RANGE_PERCENT) return [];
  
  const direction = swingHigh.timestamp > swingLow.timestamp ? 'downtrend' : 'uptrend';
  
  const levels = [
    { ratio: 0, price: direction === 'uptrend' ? swingHigh.price : swingLow.price },
    ...PATTERN_DETECTION_CONFIG.FIBONACCI_LEVELS.map(ratio => ({
      ratio,
      price: direction === 'uptrend' 
        ? swingHigh.price - (range * ratio)
        : swingLow.price + (range * ratio),
    })),
    { ratio: 1, price: direction === 'uptrend' ? swingLow.price : swingHigh.price },
  ];

  const candlesBetween = Math.abs(swingHigh.index - swingLow.index);
  const timeScore = normalizeTimeInPattern(
    candlesBetween,
    PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_CANDLES,
    PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_CANDLES
  );
  
  const confidence = calculateConfidence({
    touchPoints: 0.7,
    volumeConfirmation: 0.5,
    timeInPattern: timeScore,
    symmetry: 0.8,
  });

  if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) return [];

  const startPoint: AIPatternPoint = direction === 'uptrend'
    ? { timestamp: swingLow.timestamp, price: swingLow.price }
    : { timestamp: swingHigh.timestamp, price: swingHigh.price };
    
  const endPoint: AIPatternPoint = direction === 'uptrend'
    ? { timestamp: swingHigh.timestamp, price: swingHigh.price }
    : { timestamp: swingLow.timestamp, price: swingLow.price };

  const startDate = new Date(startPoint.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endDate = new Date(endPoint.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const confidencePercent = Math.round(confidence * 100);
  
  fibs.push({
    id: 1,
    type: 'fibonacci-retracement',
    startPoint,
    endPoint,
    levels,
    direction,
    label: `Fibonacci Retracement · ${direction === 'uptrend' ? 'Bullish' : 'Bearish'} · ${priceRangePercent.toFixed(1)}% swing · ${startDate} to ${endDate} · ${confidencePercent}% confidence`,
    confidence,
    visible: true,
    timestamp: startPoint.timestamp,
  });

  return fibs;
};

export const detectFibonacciExtensions = (
  candles: Kline[],
  pivots: PivotPoint[]
): AIPatternFibonacci[] => {
  if (!candles || candles.length === 0) return [];
  
  const fibs: AIPatternFibonacci[] = [];
  
  const highPivots = pivots.filter(p => p.type === 'high').sort((a, b) => b.price - a.price);
  const lowPivots = pivots.filter(p => p.type === 'low').sort((a, b) => a.price - b.price);
  
  if (highPivots.length === 0 || lowPivots.length === 0) return [];
  
  const swingHigh = highPivots[0];
  const swingLow = lowPivots[0];
  
  if (!swingHigh || !swingLow) return [];
  
  const range = swingHigh.price - swingLow.price;
  const priceRangePercent = (range / swingLow.price) * 100;
  
  if (priceRangePercent < PATTERN_DETECTION_CONFIG.MIN_PATTERN_PRICE_RANGE_PERCENT) return [];
  
  const direction = swingHigh.timestamp > swingLow.timestamp ? 'downtrend' : 'uptrend';
  
  const levels = [
    { ratio: 0, price: direction === 'uptrend' ? swingLow.price : swingHigh.price },
    { ratio: 1, price: direction === 'uptrend' ? swingHigh.price : swingLow.price },
    ...PATTERN_DETECTION_CONFIG.FIBONACCI_EXTENSION_LEVELS.map(ratio => ({
      ratio,
      price: direction === 'uptrend'
        ? swingLow.price + (range * ratio)
        : swingHigh.price - (range * ratio),
    })),
  ];

  const candlesBetween = Math.abs(swingHigh.index - swingLow.index);
  const timeScore = normalizeTimeInPattern(
    candlesBetween,
    PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_CANDLES,
    PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_CANDLES
  );
  
  const confidence = calculateConfidence({
    touchPoints: 0.65,
    volumeConfirmation: 0.5,
    timeInPattern: timeScore,
    symmetry: 0.75,
  });

  if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) return [];

  const startPoint: AIPatternPoint = direction === 'uptrend'
    ? { timestamp: swingLow.timestamp, price: swingLow.price }
    : { timestamp: swingHigh.timestamp, price: swingHigh.price };
    
  const endPoint: AIPatternPoint = direction === 'uptrend'
    ? { timestamp: swingHigh.timestamp, price: swingHigh.price }
    : { timestamp: swingLow.timestamp, price: swingLow.price };

  const startDate = new Date(startPoint.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endDate = new Date(endPoint.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const confidencePercent = Math.round(confidence * 100);
  
  fibs.push({
    id: 1,
    type: 'fibonacci-extension',
    startPoint,
    endPoint,
    levels,
    direction,
    label: `Fibonacci Extension · ${direction === 'uptrend' ? 'Bullish' : 'Bearish'} · ${priceRangePercent.toFixed(1)}% base · ${startDate} to ${endDate} · ${confidencePercent}% confidence`,
    confidence,
    visible: true,
    timestamp: startPoint.timestamp,
  });

  return fibs;
};
