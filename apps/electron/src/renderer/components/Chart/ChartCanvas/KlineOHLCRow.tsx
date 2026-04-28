import { HStack, Text } from '@chakra-ui/react';
import type { Kline } from '@marketmind/types';
import { formatPriceDisplay } from '@renderer/utils/formatters';
import {
  getKlineBuyPressure,
  getKlineClose,
  getKlineHigh,
  getKlineLow,
  getKlineOpen,
  getKlineVolume,
} from '@shared/utils';

interface KlineOHLCRowProps {
  kline: Kline;
  compact?: boolean;
}

export const KlineOHLCRow = ({ kline, compact = false }: KlineOHLCRowProps) => {
  const open = getKlineOpen(kline);
  const high = getKlineHigh(kline);
  const low = getKlineLow(kline);
  const close = getKlineClose(kline);
  const volume = getKlineVolume(kline);
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
      <HStack gap={1} flexShrink={0}>
        <Text color="fg.muted">O</Text>
        <Text fontWeight="medium">{formatPriceDisplay(open)}</Text>
      </HStack>
      <HStack gap={1} flexShrink={0}>
        <Text color="fg.muted">H</Text>
        <Text fontWeight="medium" color="green.fg">{formatPriceDisplay(high)}</Text>
      </HStack>
      <HStack gap={1} flexShrink={0}>
        <Text color="fg.muted">L</Text>
        <Text fontWeight="medium" color="red.fg">{formatPriceDisplay(low)}</Text>
      </HStack>
      <HStack gap={1} flexShrink={0}>
        <Text color="fg.muted">C</Text>
        <Text fontWeight="medium" color={isBullish ? 'green.500' : 'red.500'}>{formatPriceDisplay(close)}</Text>
      </HStack>
      <Text fontWeight="semibold" color={isBullish ? 'green.500' : 'red.500'} flexShrink={0}>
        {isBullish ? '+' : ''}{changePercent.toFixed(2)}%
      </Text>
      <HStack gap={1} flexShrink={0}>
        <Text color="fg.muted">Vol</Text>
        <Text fontWeight="medium">{volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
      </HStack>
      <HStack gap={1} flexShrink={0}>
        <Text color="green.fg" fontWeight="medium">{(buyPressure * 100).toFixed(0)}%</Text>
        <Text color="fg.muted">/</Text>
        <Text color="red.fg" fontWeight="medium">{(sellPressure * 100).toFixed(0)}%</Text>
      </HStack>
    </HStack>
  );
};
