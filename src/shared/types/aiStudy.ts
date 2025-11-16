export type AIStudyType =
  | 'support'
  | 'resistance'
  | 'trendline-bullish'
  | 'trendline-bearish'
  | 'liquidity-zone'
  | 'sell-zone'
  | 'buy-zone'
  | 'accumulation-zone';

export interface AIStudyPoint {
  timestamp: number;
  price: number;
}

export interface AIStudyLine {
  type: 'support' | 'resistance' | 'trendline-bullish' | 'trendline-bearish';
  points: [AIStudyPoint, AIStudyPoint];
  label?: string;
  confidence?: number;
  visible?: boolean;
}

export interface AIStudyZone {
  type: 'liquidity-zone' | 'sell-zone' | 'buy-zone' | 'accumulation-zone';
  topPrice: number;
  bottomPrice: number;
  startTimestamp: number;
  endTimestamp: number;
  label?: string;
  confidence?: number;
  visible?: boolean;
}

export type AIStudy = AIStudyLine | AIStudyZone;

export interface AIStudyData {
  id: string;
  symbol: string;
  createdAt: number;
  studies: AIStudy[];
}

export interface AIAnalysisWithStudies {
  analysis: string;
  studies?: AIStudy[] | undefined;
}

export const AI_STUDY_COLORS: Record<AIStudyType, string> = {
  support: '#26a69a',
  resistance: '#ef5350',
  'trendline-bullish': '#4caf50',
  'trendline-bearish': '#f44336',
  'liquidity-zone': 'rgba(156, 39, 176, 0.2)',
  'sell-zone': 'rgba(244, 67, 54, 0.2)',
  'buy-zone': 'rgba(76, 175, 80, 0.2)',
  'accumulation-zone': 'rgba(33, 150, 243, 0.2)',
};
