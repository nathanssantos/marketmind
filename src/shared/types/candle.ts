export interface Kline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
}

export type KlineRaw = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

export interface KlineData {
  symbol: string;
  interval: TimeInterval;
  klines: Kline[];
}

export type TimeInterval = 
  | '1s'
  | '1m' 
  | '3m'
  | '5m' 
  | '15m' 
  | '30m' 
  | '1h' 
  | '2h'
  | '4h' 
  | '6h'
  | '8h'
  | '12h'
  | '1d' 
  | '3d'
  | '1w' 
  | '1M';
