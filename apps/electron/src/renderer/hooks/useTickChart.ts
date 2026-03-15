import { useMemo } from 'react';
import type { Kline, AggTrade } from '@marketmind/types';

export const useTickChart = (trades: AggTrade[], ticksPerBar: number) => {
  const klines = useMemo(() => {
    if (trades.length === 0 || ticksPerBar <= 0) return [];

    const bars: Kline[] = [];
    let barTrades: AggTrade[] = [];

    for (const trade of trades) {
      barTrades.push(trade);

      if (barTrades.length >= ticksPerBar) {
        bars.push(buildKlineFromTrades(barTrades));
        barTrades = [];
      }
    }

    if (barTrades.length > 0) {
      bars.push(buildKlineFromTrades(barTrades));
    }

    return bars;
  }, [trades, ticksPerBar]);

  return klines;
};

const buildKlineFromTrades = (trades: AggTrade[]): Kline => {
  const first = trades[0]!;
  const last = trades[trades.length - 1]!;

  let high = -Infinity;
  let low = Infinity;
  let volume = 0;
  let quoteVolume = 0;
  let takerBuyBaseVolume = 0;
  let takerBuyQuoteVolume = 0;

  for (const t of trades) {
    if (t.price > high) high = t.price;
    if (t.price < low) low = t.price;
    volume += t.quantity;
    quoteVolume += t.quoteQuantity;
    if (!t.isBuyerMaker) {
      takerBuyBaseVolume += t.quantity;
      takerBuyQuoteVolume += t.quoteQuantity;
    }
  }

  return {
    openTime: first.timestamp,
    closeTime: last.timestamp,
    open: String(first.price),
    high: String(high),
    low: String(low),
    close: String(last.price),
    volume: String(volume),
    quoteVolume: String(quoteVolume),
    trades: trades.length,
    takerBuyBaseVolume: String(takerBuyBaseVolume),
    takerBuyQuoteVolume: String(takerBuyQuoteVolume),
  };
};
