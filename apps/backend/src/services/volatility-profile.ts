import {
  calculateATRPercent as coreCalculateATRPercent,
  getVolatilityProfile as coreGetVolatilityProfile,
  getVolatilityAdjustedMultiplier as coreGetVolatilityAdjustedMultiplier,
  type VolatilityProfileOptions,
} from '@marketmind/trading-core';

export const calculateATRPercent = coreCalculateATRPercent;
export type { VolatilityProfileOptions };
export const getVolatilityProfile = coreGetVolatilityProfile;
export const getVolatilityAdjustedMultiplier = coreGetVolatilityAdjustedMultiplier;
