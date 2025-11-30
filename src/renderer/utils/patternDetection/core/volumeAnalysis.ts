import type { Kline } from '@shared/types';
import { getKlineClose, getKlineOpen, getKlineHigh, getKlineLow, getKlineVolume } from '@shared/utils';
import { PATTERN_DETECTION_CONFIG } from '../constants';
import type { VolumeAnalysis } from '../types';

export const calculateAverageVolume = (
  candles: Kline[],
  period: number = PATTERN_DETECTION_CONFIG.VOLUME_PERIOD
): number => {
  if (candles.length === 0) return 0;
  
  const recentCandles = candles.slice(-period);
  const sum = recentCandles.reduce((total, candle) => total + getKlineVolume(candle), 0);
  
  return sum / recentCandles.length;
};

export const detectVolumeSpike = (
  candle: Candle,
  avgVolume: number,
  threshold: number = PATTERN_DETECTION_CONFIG.VOLUME_SPIKE_THRESHOLD
): boolean => {
  if (avgVolume === 0) return false;
  return getKlineVolume(candle) >= avgVolume * threshold;
};

export const getVolumePattern = (
  candles: Kline[]
): 'increasing' | 'decreasing' | 'stable' => {
  if (candles.length < 3) return 'stable';
  
  const recentCandles = candles.slice(-10);
  const firstHalf = recentCandles.slice(0, Math.floor(recentCandles.length / 2));
  const secondHalf = recentCandles.slice(Math.floor(recentCandles.length / 2));
  
  const firstAvg = firstHalf.reduce((sum, c) => sum + c.volume, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, c) => sum + c.volume, 0) / secondHalf.length;
  
  const percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;
  
  if (percentChange > 20) return 'increasing';
  if (percentChange < -20) return 'decreasing';
  return 'stable';
};

export const validateVolumeConfirmation = (
  candles: Kline[],
  indices: number[]
): boolean => {
  if (indices.length === 0) return false;
  
  const avgVolume = calculateAverageVolume(candles);
  let confirmedTouches = 0;
  
  for (const index of indices) {
    if (index < 0 || index >= candles.length) continue;
    
    const candle = candles[index];
    if (candle && detectVolumeSpike(candle, avgVolume)) {
      confirmedTouches++;
    }
  }
  
  return confirmedTouches >= Math.ceil(indices.length * 0.5);
};

export const analyzeVolume = (candles: Kline[]): VolumeAnalysis => {
  const average = calculateAverageVolume(candles);
  const trend = getVolumePattern(candles);
  
  const spikes: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    if (candle && detectVolumeSpike(candle, average)) {
      spikes.push(i);
    }
  }
  
  const confirmation = spikes.length >= Math.ceil(candles.length * 0.1);
  
  return {
    average,
    trend,
    spikes,
    confirmation,
  };
};
