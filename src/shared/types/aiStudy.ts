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
  id?: number;
  type: 'support' | 'resistance' | 'trendline-bullish' | 'trendline-bearish';
  points: [AIStudyPoint, AIStudyPoint];
  label?: string;
  confidence?: number;
  visible?: boolean;
}

export interface AIStudyZone {
  id?: number;
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
