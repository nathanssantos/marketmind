import { HStack, Text } from '@chakra-ui/react';
import type { Kline } from '@marketmind/types';
import { formatDateTimeTooltip, formatPriceDisplay } from '@renderer/utils/formatters';
import {
  getKlineBuyPressure,
  getKlineClose,
  getKlineHigh,
  getKlineLow,
  getKlineOpen,
  getKlineQuoteVolume,
  getKlineTrades,
  getKlineVolume,
} from '@shared/utils';

interface KlineOHLCRowProps {
  kline: Kline;
  compact?: boolean;
}

const formatQuoteVolume = (value: number): string => {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

const formatTradesCount = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
};

export const KlineOHLCRow = ({ kline, compact = false }: KlineOHLCRowProps) => {
  const open = getKlineOpen(kline);
  const high = getKlineHigh(kline);
  const low = getKlineLow(kline);
  const close = getKlineClose(kline);
  const volume = getKlineVolume(kline);
  const quoteVolume = getKlineQuoteVolume(kline);
  const trades = getKlineTrades(kline);
  const buyPressure = getKlineBuyPressure(kline);
  const sellPressure = 1 - buyPressure;
  const isBullish = close >= open;
  const change = close - open;
  const changePercent = open !== 0 ? (change / open) * 100 : 0;

  const fontSize = compact ? '2xs' : 'xs';
  const gap = compact ? 1.5 : 2;

  return (
    <HStack
      gap={gap}
      fontSize={fontSize}
      lineHeight="1.2"
      flexWrap="nowrap"
      whiteSpace="nowrap"
      overflow="hidden"
      minW={0}
    >
      <Text color="fg.muted" flexShrink={1} truncate>{formatDateTimeTooltip(kline.openTime)}</Text>
      <HStack gap={1} flexShrink={0}>
        <Text color="fg.muted">O</Text>
        <Text fontWeight="medium">{formatPriceDisplay(open)}</Text>
      </HStack>
      <HStack gap={1} flexShrink={0}>
        <Text color="fg.muted">H</Text>
        <Text fontWeight="medium" color="trading.profit">{formatPriceDisplay(high)}</Text>
      </HStack>
      <HStack gap={1} flexShrink={0}>
        <Text color="fg.muted">L</Text>
        <Text fontWeight="medium" color="trading.loss">{formatPriceDisplay(low)}</Text>
      </HStack>
      <HStack gap={1} flexShrink={0}>
        <Text color="fg.muted">C</Text>
        <Text fontWeight="medium" color={isBullish ? 'trading.profit' : 'trading.loss'}>{formatPriceDisplay(close)}</Text>
      </HStack>
      <Text fontWeight="semibold" color={isBullish ? 'trading.profit' : 'trading.loss'} flexShrink={0}>
        {isBullish ? '+' : ''}{changePercent.toFixed(2)}%
      </Text>
      <HStack gap={1} flexShrink={0}>
        <Text color="fg.muted">Vol</Text>
        <Text fontWeight="medium">{volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
      </HStack>
      <HStack gap={1} flexShrink={0}>
        <Text color="fg.muted">QVol</Text>
        <Text fontWeight="medium">{formatQuoteVolume(quoteVolume)}</Text>
      </HStack>
      <HStack gap={1} flexShrink={0}>
        <Text color="fg.muted">Trades</Text>
        <Text fontWeight="medium">{formatTradesCount(trades)}</Text>
      </HStack>
      <HStack gap={1} flexShrink={0}>
        <Text color="trading.profit" fontWeight="medium">{(buyPressure * 100).toFixed(0)}%</Text>
        <Text color="fg.muted">/</Text>
        <Text color="trading.loss" fontWeight="medium">{(sellPressure * 100).toFixed(0)}%</Text>
      </HStack>
    </HStack>
  );
};
