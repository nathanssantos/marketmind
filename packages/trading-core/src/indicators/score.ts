import type { ChecklistScoreBreakdown } from './types';

export interface ScoreInput {
  requiredTotal: number;
  requiredPassed: number;
  requiredWeightTotal: number;
  requiredWeightPassed: number;
  preferredTotal: number;
  preferredPassed: number;
  preferredWeightTotal: number;
  preferredWeightPassed: number;
}

const REQUIRED_TIER_MULTIPLIER = 2;
const PREFERRED_TIER_MULTIPLIER = 1;

export const calculateChecklistScore = (input: ScoreInput): ChecklistScoreBreakdown => {
  const {
    requiredTotal,
    requiredPassed,
    requiredWeightTotal,
    requiredWeightPassed,
    preferredTotal,
    preferredPassed,
    preferredWeightTotal,
    preferredWeightPassed,
  } = input;

  const totalWeight =
    requiredWeightTotal * REQUIRED_TIER_MULTIPLIER +
    preferredWeightTotal * PREFERRED_TIER_MULTIPLIER;
  const achieved =
    requiredWeightPassed * REQUIRED_TIER_MULTIPLIER +
    preferredWeightPassed * PREFERRED_TIER_MULTIPLIER;

  const score = totalWeight === 0 ? 100 : (achieved / totalWeight) * 100;

  return {
    requiredTotal,
    requiredPassed,
    requiredWeightTotal,
    requiredWeightPassed,
    preferredTotal,
    preferredPassed,
    preferredWeightTotal,
    preferredWeightPassed,
    score,
    requiredAllPassed: requiredTotal === 0 || requiredPassed === requiredTotal,
  };
};
