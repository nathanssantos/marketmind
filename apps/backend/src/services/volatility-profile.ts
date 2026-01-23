import {
  calculateATRPercent as coreCalculateATRPercent,
  getVolatilityProfile as coreGetVolatilityProfile,
  getVolatilityAdjustedMultiplier as coreGetVolatilityAdjustedMultiplier,
  type VolatilityProfileOptions,
} from '@marketmind/trading-core';
import type { VolatilityProfile } from '@marketmind/types';
import { logger } from './logger';

export const calculateATRPercent = coreCalculateATRPercent;
export type { VolatilityProfileOptions };

export const getVolatilityProfile = (
  atrPercent: number,
  options: VolatilityProfileOptions = {}
): VolatilityProfile => {
  const profile = coreGetVolatilityProfile(atrPercent, options);

  if (profile.level !== 'LOW' && profile.level !== 'MEDIUM') {
    logger.debug({
      level: profile.level,
      atrPercent: atrPercent.toFixed(2),
      atrMultiplier: profile.atrMultiplier.toFixed(2),
      breakevenThreshold: (profile.breakevenThreshold * 100).toFixed(2),
      minTrailingDistance: (profile.minTrailingDistance * 100).toFixed(3),
      marketType: options.marketType ?? 'SPOT',
    }, '[VolatilityProfile] Elevated volatility level selected');
  }

  return profile;
};

export const getVolatilityAdjustedMultiplier = coreGetVolatilityAdjustedMultiplier;
