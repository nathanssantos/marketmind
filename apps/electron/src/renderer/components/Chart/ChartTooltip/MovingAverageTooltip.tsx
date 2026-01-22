import { formatDateTimeTooltip, formatPriceDisplay } from '@/renderer/utils/formatters';
import { Box, HStack, Text } from '@chakra-ui/react';
import type { Kline } from '@marketmind/types';
import { TooltipContainer } from './TooltipContainer';
import type { MovingAverageData } from './types';

interface MovingAverageTooltipProps {
  movingAverage: MovingAverageData;
  kline: Kline | null;
  left: number;
  top: number;
}

export const MovingAverageTooltip = ({ movingAverage, kline, left, top }: MovingAverageTooltipProps) => {
  const maTypeLabel = movingAverage.type === 'SMA' ? 'Simple Moving Average' : 'Exponential Moving Average';

  return (
    <TooltipContainer left={left} top={top}>
      <Text fontSize="2xs" color="fg.muted" mb={1}>
        {kline ? formatDateTimeTooltip(kline.openTime) : ''}
      </Text>
      <HStack gap={1.5}>
        <Box w={3} h={3} bg={movingAverage.color} borderRadius="sm" />
        <Text fontWeight="semibold">
          {movingAverage.type}({movingAverage.period})
        </Text>
      </HStack>
      <Text color="fg.muted" fontSize="2xs">{maTypeLabel}</Text>
      {movingAverage.value !== undefined && (
        <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
          <Text color="fg.muted">Value:</Text>
          <Text fontWeight="medium">{formatPriceDisplay(movingAverage.value)}</Text>
        </HStack>
      )}
    </TooltipContainer>
  );
};
