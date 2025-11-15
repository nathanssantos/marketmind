import { Box, HStack, Stack, Text } from '@chakra-ui/react';
import type { ReactElement } from 'react';
import type { Candle } from '@shared/types';
import { formatPrice, formatTimestamp } from '@/renderer/utils/formatters';

export interface ChartTooltipProps {
  candle: Candle | null;
  x: number;
  y: number;
  visible: boolean;
  containerWidth?: number;
  containerHeight?: number;
}

export const ChartTooltip = ({
  candle,
  x,
  y,
  visible,
  containerWidth = window.innerWidth,
  containerHeight = window.innerHeight,
}: ChartTooltipProps): ReactElement | null => {
  if (!visible || !candle) return null;

  const isBullish = candle.close >= candle.open;
  const change = candle.close - candle.open;
  const changePercent = ((change / candle.open) * 100).toFixed(2);

  const tooltipWidth = 220;
  const tooltipHeight = 200;
  const offset = 10;

  let leftPos = x + offset;
  let topPos = y + offset;

  if (leftPos + tooltipWidth > containerWidth) {
    leftPos = x - tooltipWidth - offset;
  }

  if (topPos + tooltipHeight > containerHeight) {
    topPos = y - tooltipHeight - offset;
  }

  if (leftPos < 0) {
    leftPos = offset;
  }

  if (topPos < 0) {
    topPos = offset;
  }

  return (
    <Box
      position="absolute"
      left={`${leftPos}px`}
      top={`${topPos}px`}
      bg="gray.800"
      color="white"
      p={3}
      borderRadius="md"
      boxShadow="lg"
      fontSize="xs"
      zIndex={1000}
      pointerEvents="none"
      opacity={0.95}
      minW={`${tooltipWidth}px`}
    >
      <Stack gap={1.5}>
        {/* Time */}
        <Text fontWeight="semibold" color="gray.300">
          {formatTimestamp(candle.timestamp)}
        </Text>

        {/* OHLC */}
        <Stack gap={0.5}>
          <HStack justify="space-between">
            <Text color="gray.400">Open:</Text>
            <Text fontWeight="medium">{formatPrice(candle.open)}</Text>
          </HStack>
          <HStack justify="space-between">
            <Text color="gray.400">High:</Text>
            <Text fontWeight="medium" color="green.400">
              {formatPrice(candle.high)}
            </Text>
          </HStack>
          <HStack justify="space-between">
            <Text color="gray.400">Low:</Text>
            <Text fontWeight="medium" color="red.400">
              {formatPrice(candle.low)}
            </Text>
          </HStack>
          <HStack justify="space-between">
            <Text color="gray.400">Close:</Text>
            <Text fontWeight="medium">{formatPrice(candle.close)}</Text>
          </HStack>
        </Stack>

        {/* Change */}
        <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="gray.700">
          <Text color="gray.400">Change:</Text>
          <Text
            fontWeight="semibold"
            color={isBullish ? 'green.400' : 'red.400'}
          >
            {isBullish ? '+' : ''}
            {formatPrice(change)} ({changePercent}%)
          </Text>
        </HStack>

        {/* Volume */}
        <HStack justify="space-between">
          <Text color="gray.400">Volume:</Text>
          <Text fontWeight="medium">{candle.volume.toLocaleString()}</Text>
        </HStack>
      </Stack>
    </Box>
  );
};
