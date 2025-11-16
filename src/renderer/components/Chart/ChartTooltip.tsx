import { formatPrice, formatTimestamp } from '@/renderer/utils/formatters';
import { Box, HStack, Stack, Text } from '@chakra-ui/react';
import type { AIStudy, Candle } from '@shared/types';
import type { ReactElement } from 'react';

export interface ChartTooltipProps {
  candle: Candle | null;
  x: number;
  y: number;
  visible: boolean;
  containerWidth?: number;
  containerHeight?: number;
  aiStudy?: AIStudy | null | undefined;
}

export const ChartTooltip = ({
  candle,
  x,
  y,
  visible,
  containerWidth = window.innerWidth,
  containerHeight = window.innerHeight,
  aiStudy,
}: ChartTooltipProps): ReactElement | null => {
  if (!visible || (!candle && !aiStudy)) return null;

  const isBullish = candle ? candle.close >= candle.open : false;
  const change = candle ? candle.close - candle.open : 0;
  const changePercent = candle ? ((change / candle.open) * 100).toFixed(2) : '0.00';

  const tooltipWidth = 220;
  const tooltipHeight = aiStudy ? 120 : 200;
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

  if (aiStudy) {
    const studyTypeLabel = aiStudy.type.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    const isLine = 'points' in aiStudy;
    
    let priceValue: number | undefined;
    let topPriceValue: number | undefined;
    let bottomPriceValue: number | undefined;
    
    if (isLine && 'points' in aiStudy && aiStudy.points.length >= 2) {
      priceValue = (aiStudy.points[0].price + aiStudy.points[1].price) / 2;
    } else if ('topPrice' in aiStudy && 'bottomPrice' in aiStudy) {
      topPriceValue = aiStudy.topPrice;
      bottomPriceValue = aiStudy.bottomPrice;
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
          <Text fontWeight="semibold" color="blue.400">
            🤖 {studyTypeLabel}
          </Text>
          <Text color="gray.300">{aiStudy.label}</Text>
          {isLine && priceValue !== undefined ? (
            <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="gray.700">
              <Text color="gray.400">Price:</Text>
              <Text fontWeight="medium">{formatPrice(priceValue)}</Text>
            </HStack>
          ) : topPriceValue !== undefined && bottomPriceValue !== undefined ? (
            <>
              <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="gray.700">
                <Text color="gray.400">Top:</Text>
                <Text fontWeight="medium">{formatPrice(topPriceValue)}</Text>
              </HStack>
              <HStack justify="space-between">
                <Text color="gray.400">Bottom:</Text>
                <Text fontWeight="medium">{formatPrice(bottomPriceValue)}</Text>
              </HStack>
            </>
          ) : null}
        </Stack>
      </Box>
    );
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
        <Text fontWeight="semibold" color="gray.300">
          {candle ? formatTimestamp(candle.timestamp) : ''}
        </Text>

        {candle && (
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
        )}

        {candle && (
          <>
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

            <HStack justify="space-between">
              <Text color="gray.400">Volume:</Text>
              <Text fontWeight="medium">{candle.volume.toLocaleString()}</Text>
            </HStack>
          </>
        )}
      </Stack>
    </Box>
  );
};
