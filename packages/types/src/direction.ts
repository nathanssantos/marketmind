export type PositionSide = 'LONG' | 'SHORT';
export type PriceDirection = 'up' | 'down';
export type MarketBias = 'bullish' | 'bearish';

export const sideToDirection = (side: PositionSide): PriceDirection =>
  side === 'LONG' ? 'up' : 'down';

export const directionToSide = (dir: PriceDirection): PositionSide =>
  dir === 'up' ? 'LONG' : 'SHORT';

export const sideToBias = (side: PositionSide): MarketBias =>
  side === 'LONG' ? 'bullish' : 'bearish';

export const biasToSide = (bias: MarketBias): PositionSide =>
  bias === 'bullish' ? 'LONG' : 'SHORT';

export const directionToBias = (dir: PriceDirection): MarketBias =>
  dir === 'up' ? 'bullish' : 'bearish';

export const biasToDirection = (bias: MarketBias): PriceDirection =>
  bias === 'bullish' ? 'up' : 'down';
