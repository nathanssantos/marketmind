import type { Kline } from '@shared/types';
import { getKlineVolume } from '@shared/utils';
import { PATTERN_DETECTION_CONFIG } from '../constants';
import type { VolumeAnalysis } from '../types';

export const calculateAverageVolume = (
  klines: Kline[],
  period: number = PATTERN_DETECTION_CONFIG.VOLUME_PERIOD
): number => {
  if (klines.length === 0) return 0;
  
  const recentKlines = klines.slice(-period);
  const sum = recentKlines.reduce((total, kline) => total + getKlineVolume(kline), 0);
  
  return sum / recentKlines.length;
};

export const detectVolumeSpike = (
  kline: Kline,
  avgVolume: number,
  threshold: number = PATTERN_DETECTION_CONFIG.VOLUME_SPIKE_THRESHOLD
): boolean => {
  if (avgVolume === 0) return false;
  return getKlineVolume(kline) >= avgVolume * threshold;
};

export const getVolumePattern = (
  klines: Kline[]
): 'increasing' | 'decreasing' | 'stable' => {
  if (klines.length < 3) return 'stable';
  
  const recentKlines = klines.slice(-10);
  const firstHalf = recentKlines.slice(0, Math.floor(recentKlines.length / 2));
  const secondHalf = recentKlines.slice(Math.floor(recentKlines.length / 2));
  
  const firstAvg = firstHalf.reduce((sum, c) => sum + getKlineVolume(c), 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, c) => sum + getKlineVolume(c), 0) / secondHalf.length;
  
  const percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;
  
  if (percentChange > 20) return 'increasing';
  if (percentChange < -20) return 'decreasing';
  return 'stable';
};

export const validateVolumeConfirmation = (
  klines: Kline[],
  indices: number[]
): boolean => {
  if (indices.length === 0) return false;
  
  const avgVolume = calculateAverageVolume(klines);
  let confirmedTouches = 0;
  
  for (const index of indices) {
    if (index < 0 || index >= klines.length) continue;
    
    const kline = klines[index];
    if (kline && detectVolumeSpike(kline, avgVolume)) {
      confirmedTouches++;
    }
  }
  
  return confirmedTouches >= Math.ceil(indices.length * 0.5);
};

export const analyzeVolume = (klines: Kline[]): VolumeAnalysis => {
  const average = calculateAverageVolume(klines);
  const trend = getVolumePattern(klines);
  
  const spikes: number[] = [];
  
  for (let i = 0; i < klines.length; i++) {
    const kline = klines[i];
    if (kline && detectVolumeSpike(kline, average)) {
      spikes.push(i);
    }
  }
  
  const confirmation = spikes.length >= Math.ceil(klines.length * 0.1);
  
  return {
    average,
    trend,
    spikes,
    confirmation,
  };
};
