import type { ConfidenceFactors } from '../types';

export const calculateConfidence = (factors: ConfidenceFactors): number => {
  const {
    touchPoints = 0,
    volumeConfirmation = 0,
    timeInPattern = 0,
    symmetry = 0,
  } = factors;

  const confidence = (
    touchPoints * 0.3 +
    volumeConfirmation * 0.3 +
    timeInPattern * 0.2 +
    symmetry * 0.2
  );

  return Math.max(0, Math.min(1, confidence));
};

export const normalizeTouchPoints = (
  touchCount: number,
  idealTouches: number = 3
): number => {
  if (touchCount <= 0) return 0;
  if (touchCount >= idealTouches) return 1;
  return touchCount / idealTouches;
};

export const normalizeTimeInPattern = (
  candleCount: number,
  minCandles: number,
  idealCandles: number
): number => {
  if (candleCount < minCandles) return 0;
  if (candleCount >= idealCandles) return 1;
  return (candleCount - minCandles) / (idealCandles - minCandles);
};

export const calculateSymmetryScore = (
  leftValue: number,
  rightValue: number,
  tolerance: number = 0.05
): number => {
  const diff = Math.abs(leftValue - rightValue);
  const avg = (leftValue + rightValue) / 2;
  
  if (avg === 0) return 0;
  
  const percentDiff = diff / avg;
  
  if (percentDiff <= tolerance) return 1;
  if (percentDiff >= tolerance * 3) return 0;
  
  return 1 - (percentDiff - tolerance) / (tolerance * 2);
};
