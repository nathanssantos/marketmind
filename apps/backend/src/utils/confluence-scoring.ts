import type {
  BtcCorrelationResult,
  FundingFilterResult,
  MarketRegimeResult,
  MtfFilterResult,
  VolumeFilterResult,
} from './filters';

export const CONFLUENCE_WEIGHTS = {
  mtfFilter: 25,
  btcCorrelation: 20,
  marketRegime: 15,
  trend: 15,
  adxStrength: 10,
  volume: 10,
  fundingRate: 5,
} as const;

export const CONFLUENCE_CONFIG = {
  MINIMUM_SCORE: 60,
  ALIGNMENT_BONUS: 10,
} as const;

export type RecommendationLevel = 'STRONG_ENTRY' | 'MODERATE_ENTRY' | 'WEAK_ENTRY' | 'NO_ENTRY';

export interface FilterContribution {
  filterName: string;
  passed: boolean;
  score: number;
  maxScore: number;
  reason: string;
}

export interface ConfluenceResult {
  isAllowed: boolean;
  totalScore: number;
  maxPossibleScore: number;
  scorePercent: number;
  contributions: FilterContribution[];
  alignmentBonus: number;
  recommendation: RecommendationLevel;
  reason: string;
}

export interface FilterResults {
  mtf?: MtfFilterResult | null;
  btcCorrelation?: BtcCorrelationResult | null;
  marketRegime?: MarketRegimeResult | null;
  volume?: VolumeFilterResult | null;
  fundingRate?: FundingFilterResult | null;
  trendAllowed?: boolean;
  adxValue?: number | null;
}

const getRecommendation = (scorePercent: number): RecommendationLevel => {
  if (scorePercent >= 80) return 'STRONG_ENTRY';
  if (scorePercent >= 65) return 'MODERATE_ENTRY';
  if (scorePercent >= 50) return 'WEAK_ENTRY';
  return 'NO_ENTRY';
};

export const calculateConfluenceScore = (
  results: FilterResults,
  minimumScore: number = CONFLUENCE_CONFIG.MINIMUM_SCORE
): ConfluenceResult => {
  const contributions: FilterContribution[] = [];
  let totalScore = 0;
  let maxPossibleScore = 0;
  let passedCount = 0;
  let totalFilters = 0;

  if (results.mtf !== undefined && results.mtf !== null) {
    const passed = results.mtf.isAllowed;
    const score = passed ? CONFLUENCE_WEIGHTS.mtfFilter : 0;
    totalScore += score;
    maxPossibleScore += CONFLUENCE_WEIGHTS.mtfFilter;
    if (passed) passedCount++;
    totalFilters++;
    contributions.push({
      filterName: 'MTF Filter',
      passed,
      score,
      maxScore: CONFLUENCE_WEIGHTS.mtfFilter,
      reason: results.mtf.reason,
    });
  }

  if (results.btcCorrelation !== undefined && results.btcCorrelation !== null) {
    const passed = results.btcCorrelation.isAllowed;
    const btcScore = results.btcCorrelation.correlationScore;
    const scoreRatio = btcScore / 100;
    const proportionalScore = passed
      ? Math.round(CONFLUENCE_WEIGHTS.btcCorrelation * scoreRatio)
      : 0;
    totalScore += proportionalScore;
    maxPossibleScore += CONFLUENCE_WEIGHTS.btcCorrelation;
    if (passed) passedCount++;
    totalFilters++;
    contributions.push({
      filterName: 'BTC Correlation',
      passed,
      score: proportionalScore,
      maxScore: CONFLUENCE_WEIGHTS.btcCorrelation,
      reason: `${results.btcCorrelation.reason} (score: ${btcScore})`,
    });
  }

  if (results.marketRegime !== undefined && results.marketRegime !== null) {
    const passed = results.marketRegime.isAllowed;
    const score = passed ? CONFLUENCE_WEIGHTS.marketRegime : 0;
    totalScore += score;
    maxPossibleScore += CONFLUENCE_WEIGHTS.marketRegime;
    if (passed) passedCount++;
    totalFilters++;
    contributions.push({
      filterName: 'Market Regime',
      passed,
      score,
      maxScore: CONFLUENCE_WEIGHTS.marketRegime,
      reason: results.marketRegime.reason,
    });
  }

  if (results.trendAllowed !== undefined) {
    const passed = results.trendAllowed;
    const score = passed ? CONFLUENCE_WEIGHTS.trend : 0;
    totalScore += score;
    maxPossibleScore += CONFLUENCE_WEIGHTS.trend;
    if (passed) passedCount++;
    totalFilters++;
    contributions.push({
      filterName: 'Trend Filter',
      passed,
      score,
      maxScore: CONFLUENCE_WEIGHTS.trend,
      reason: passed ? 'Price aligned with trend' : 'Price against trend',
    });
  }

  if (results.adxValue !== undefined && results.adxValue !== null) {
    const passed = results.adxValue >= 20;
    const score = passed ? CONFLUENCE_WEIGHTS.adxStrength : Math.floor(CONFLUENCE_WEIGHTS.adxStrength * (results.adxValue / 20));
    totalScore += Math.min(score, CONFLUENCE_WEIGHTS.adxStrength);
    maxPossibleScore += CONFLUENCE_WEIGHTS.adxStrength;
    if (passed) passedCount++;
    totalFilters++;
    contributions.push({
      filterName: 'ADX Strength',
      passed,
      score: Math.min(score, CONFLUENCE_WEIGHTS.adxStrength),
      maxScore: CONFLUENCE_WEIGHTS.adxStrength,
      reason: `ADX: ${results.adxValue.toFixed(1)} (${passed ? 'strong' : 'weak'} trend)`,
    });
  }

  if (results.volume !== undefined && results.volume !== null) {
    const passed = results.volume.isAllowed;
    const score = passed ? CONFLUENCE_WEIGHTS.volume : 0;
    totalScore += score;
    maxPossibleScore += CONFLUENCE_WEIGHTS.volume;
    if (passed) passedCount++;
    totalFilters++;
    contributions.push({
      filterName: 'Volume',
      passed,
      score,
      maxScore: CONFLUENCE_WEIGHTS.volume,
      reason: results.volume.reason,
    });
  }

  if (results.fundingRate !== undefined && results.fundingRate !== null) {
    const passed = results.fundingRate.isAllowed;
    const score = passed ? CONFLUENCE_WEIGHTS.fundingRate : 0;
    totalScore += score;
    maxPossibleScore += CONFLUENCE_WEIGHTS.fundingRate;
    if (passed) passedCount++;
    totalFilters++;
    contributions.push({
      filterName: 'Funding Rate',
      passed,
      score,
      maxScore: CONFLUENCE_WEIGHTS.fundingRate,
      reason: results.fundingRate.reason,
    });
  }

  let alignmentBonus = 0;
  if (totalFilters > 0 && passedCount === totalFilters) {
    alignmentBonus = CONFLUENCE_CONFIG.ALIGNMENT_BONUS;
    totalScore += alignmentBonus;
  }

  const scorePercent = maxPossibleScore > 0 ? (totalScore / (maxPossibleScore + CONFLUENCE_CONFIG.ALIGNMENT_BONUS)) * 100 : 0;
  const recommendation = getRecommendation(scorePercent);
  const isAllowed = totalScore >= minimumScore;

  return {
    isAllowed,
    totalScore,
    maxPossibleScore: maxPossibleScore + CONFLUENCE_CONFIG.ALIGNMENT_BONUS,
    scorePercent: Math.round(scorePercent),
    contributions,
    alignmentBonus,
    recommendation,
    reason: isAllowed
      ? `Confluence score ${totalScore}/${maxPossibleScore + CONFLUENCE_CONFIG.ALIGNMENT_BONUS} (${Math.round(scorePercent)}%) - ${recommendation}`
      : `Confluence score ${totalScore} below minimum ${minimumScore} - trade blocked`,
  };
};
