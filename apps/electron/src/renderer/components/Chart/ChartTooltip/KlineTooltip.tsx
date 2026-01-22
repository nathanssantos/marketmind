import { formatDateTimeTooltip, formatPriceDisplay } from '@/renderer/utils/formatters';
import { HStack, Text } from '@chakra-ui/react';
import type { Kline } from '@marketmind/types';
import {
  getKlineAverageTradeValue,
  getKlineBuyPressure,
  getKlineClose,
  getKlineHigh,
  getKlineLow,
  getKlineOpen,
  getKlinePressureType,
  getKlineQuoteVolume,
  getKlineTrades,
  getKlineVolume,
} from '@shared/utils';
import { TooltipContainer } from './TooltipContainer';

interface KlineTooltipProps {
  kline: Kline;
  left: number;
  top: number;
}

export const KlineTooltip = ({ kline, left, top }: KlineTooltipProps) => {
  const isBullish = getKlineClose(kline) >= getKlineOpen(kline);
  const change = getKlineClose(kline) - getKlineOpen(kline);
  const changePercent = ((change / getKlineOpen(kline)) * 100).toFixed(2);

  const buyPressure = getKlineBuyPressure(kline);
  const pressureType = getKlinePressureType(kline);
  const trades = getKlineTrades(kline);
  const quoteVolume = getKlineQuoteVolume(kline);
  const avgTradeValue = getKlineAverageTradeValue(kline);

  return (
    <TooltipContainer left={left} top={top}>
      <Text fontSize="2xs" color="fg.muted" mb={1}>
        {formatDateTimeTooltip(kline.openTime)}
      </Text>

      <HStack justify="space-between">
        <Text color="fg.muted">Open:</Text>
        <Text fontWeight="medium">{formatPriceDisplay(getKlineOpen(kline))}</Text>
      </HStack>
      <HStack justify="space-between">
        <Text color="fg.muted">High:</Text>
        <Text fontWeight="medium" color="green.500">
          {formatPriceDisplay(getKlineHigh(kline))}
        </Text>
      </HStack>
      <HStack justify="space-between">
        <Text color="fg.muted">Low:</Text>
        <Text fontWeight="medium" color="red.500">
          {formatPriceDisplay(getKlineLow(kline))}
        </Text>
      </HStack>
      <HStack justify="space-between">
        <Text color="fg.muted">Close:</Text>
        <Text fontWeight="medium">{formatPriceDisplay(getKlineClose(kline))}</Text>
      </HStack>

      <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
        <Text color="fg.muted">Change:</Text>
        <Text fontWeight="semibold" color={isBullish ? 'green.500' : 'red.500'}>
          {isBullish ? '+' : ''}
          {formatPriceDisplay(change)} ({changePercent}%)
        </Text>
      </HStack>

      <HStack justify="space-between">
        <Text color="fg.muted">Volume:</Text>
        <Text fontWeight="medium">{getKlineVolume(kline).toLocaleString()}</Text>
      </HStack>

      <HStack justify="space-between">
        <Text color="fg.muted">Quote Vol:</Text>
        <Text fontWeight="medium">${quoteVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
      </HStack>

      <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
        <Text color="fg.muted">Trades:</Text>
        <Text fontWeight="medium">{trades.toLocaleString()}</Text>
      </HStack>

      <HStack justify="space-between">
        <Text color="fg.muted">Avg Trade:</Text>
        <Text fontWeight="medium">${avgTradeValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
      </HStack>

      <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
        <Text color="fg.muted">Pressure:</Text>
        <HStack gap={1}>
          <Text
            fontWeight="semibold"
            color={pressureType === 'buy' ? 'green.500' : pressureType === 'sell' ? 'red.500' : 'gray.500'}
          >
            {pressureType === 'buy' ? '🟢' : pressureType === 'sell' ? '🔴' : '⚪'}
          </Text>
          <Text fontWeight="medium">
            {(buyPressure * 100).toFixed(0)}% Buy
          </Text>
        </HStack>
      </HStack>
    </TooltipContainer>
  );
};
