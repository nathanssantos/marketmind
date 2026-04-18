import { useEffect, useRef, useState } from 'react';

export const useContainerWidth = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [hasWidth, setHasWidth] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setHasWidth(width > 10);
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, hasWidth };
};

export const POPULAR_FUNDING_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT'];

const DEFAULT_HALF_INTERVAL = 2 * 60 * 60 * 1000;
const MIN_REFRESH_INTERVAL = 5 * 60 * 1000;

export const getRefreshIntervals = (halfIntervalMs: number) => ({
  fearGreed: Math.max(halfIntervalMs, 30 * 60 * 1000),
  btcDominance: Math.max(halfIntervalMs, MIN_REFRESH_INTERVAL),
  onChain: Math.max(halfIntervalMs, 30 * 60 * 1000),
  openInterest: Math.max(halfIntervalMs, MIN_REFRESH_INTERVAL),
  longShortRatio: Math.max(halfIntervalMs, MIN_REFRESH_INTERVAL),
  fundingRates: Math.max(halfIntervalMs, MIN_REFRESH_INTERVAL),
  altcoinSeason: Math.max(halfIntervalMs, MIN_REFRESH_INTERVAL),
  adxTrendStrength: Math.max(halfIntervalMs, MIN_REFRESH_INTERVAL),
  orderBook: Math.max(Math.floor(halfIntervalMs / 4), 60 * 1000),
});

export { DEFAULT_HALF_INTERVAL };

export const TOOLTIP_STYLE = {
  backgroundColor: 'var(--chakra-colors-bg-muted)',
  border: '1px solid var(--chakra-colors-border)',
  borderRadius: '6px',
  fontSize: '11px',
} as const;

export const CHART_MARGIN = { top: 5, right: 5, left: 5, bottom: 5 };

export type TooltipPayload = { payload?: { timestamp?: number } };

export const formatTooltipDate = (_: unknown, payload: readonly TooltipPayload[]): string => {
  const timestamp = payload?.[0]?.payload?.timestamp;
  return timestamp ? new Date(timestamp).toLocaleDateString() : '';
};

export const formatFundingRate = (rate: number | null): string => {
  if (rate === null) return '-';
  return `${(rate * 100).toFixed(4)}%`;
};

export const formatLargeNumber = (num: number): string => {
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toFixed(2);
};

export interface FearGreedLevel {
  max: number;
  labelKey: string;
  color: string;
}

export const FEAR_GREED_LEVELS: readonly FearGreedLevel[] = [
  { max: 25, labelKey: 'marketSidebar.fearGreed.extremeFear', color: 'red' },
  { max: 45, labelKey: 'marketSidebar.fearGreed.fear', color: 'orange' },
  { max: 55, labelKey: 'marketSidebar.fearGreed.neutral', color: 'gray' },
  { max: 75, labelKey: 'marketSidebar.fearGreed.greed', color: 'green' },
  { max: 100, labelKey: 'marketSidebar.fearGreed.extremeGreed', color: 'green' },
] as const;

export const getFearGreedLevel = (value: number): FearGreedLevel => {
  for (const level of FEAR_GREED_LEVELS) {
    if (value <= level.max) return level;
  }
  return FEAR_GREED_LEVELS[FEAR_GREED_LEVELS.length - 1]!;
};

export const getFearGreedColor = (value: number): string => getFearGreedLevel(value).color;

export const getAltSeasonColor = (seasonType: string): string => {
  if (seasonType === 'ALT_SEASON') return 'green';
  if (seasonType === 'BTC_SEASON') return 'orange';
  return 'gray';
};

export const getAdxColor = (adx: number | null): string => {
  if (adx === null) return 'gray';
  if (adx >= 25) return 'green';
  if (adx >= 20) return 'yellow';
  return 'red';
};

export const getOrderBookPressureColor = (pressure: string): string => {
  if (pressure === 'BUYING') return 'green';
  if (pressure === 'SELLING') return 'red';
  return 'gray';
};

export const getMvrvColor = (value: number | null): string => {
  if (value === null) return 'gray';
  if (value >= 3.5) return 'red';
  if (value >= 1) return 'green';
  return 'blue';
};

export const formatUsd = (value: number): string => {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};
