import type { NewsArticle } from './ai';
import type { CalendarEvent } from './calendar';
import type { TradingSetup } from './tradingSetup';

export type MarketSentiment = 'bullish' | 'bearish' | 'neutral';
export type LiquidityLevel = 'high' | 'medium' | 'low';
export type TradeUrgency = 'immediate' | 'wait_for_pullback' | 'wait_for_confirmation';

export interface AITradingContext {
  detectedSetups: TradingSetup[];
  news: NewsArticle[];
  calendarEvents: CalendarEvent[];
  fearGreedIndex: number;
  btcDominance: number;
  marketSentiment: MarketSentiment;
  volatility: number;
  liquidityLevel: LiquidityLevel;
  fundingRate?: number;
  openInterest?: number;
}

export interface AITradingDecisionEnhanced {
  selectedSetup: TradingSetup | null;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  positionSizePercent: number;
  urgency: TradeUrgency;
  reasoning: string;
  contextualFactors: string[];
}

export interface ContextAggregatorConfig {
  newsLookbackHours?: number;
  eventsLookforwardDays?: number;
  enableFearGreedIndex?: boolean;
  enableBTCDominance?: boolean;
  enableFundingRate?: boolean;
  enableOpenInterest?: boolean;
}
