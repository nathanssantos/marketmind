import type { ChecklistScoreBreakdown } from './types';

export interface ScoreInput {
  requiredTotal: number;
  requiredPassed: number;
  preferredTotal: number;
  preferredPassed: number;
}

const REQUIRED_WEIGHT = 2;
const PREFERRED_WEIGHT = 1;

export const calculateChecklistScore = (input: ScoreInput): ChecklistScoreBreakdown => {
  const { requiredTotal, requiredPassed, preferredTotal, preferredPassed } = input;

  const totalWeight = requiredTotal * REQUIRED_WEIGHT + preferredTotal * PREFERRED_WEIGHT;
  const achieved = requiredPassed * REQUIRED_WEIGHT + preferredPassed * PREFERRED_WEIGHT;

  const score = totalWeight === 0 ? 100 : (achieved / totalWeight) * 100;

  return {
    requiredTotal,
    requiredPassed,
    preferredTotal,
    preferredPassed,
    score,
    requiredAllPassed: requiredTotal === 0 || requiredPassed === requiredTotal,
  };
};
