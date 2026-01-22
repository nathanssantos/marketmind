import { formatDateTimeTooltip, formatPriceDisplay } from '@/renderer/utils/formatters';
import { HStack, Text } from '@chakra-ui/react';
import type { Kline } from '@marketmind/types';
import { TooltipContainer } from './TooltipContainer';
import type { MeasurementData } from './types';

interface MeasurementTooltipProps {
  measurement: MeasurementData;
  kline: Kline | null;
  left: number;
  top: number;
}

export const MeasurementTooltip = ({ measurement, kline, left, top }: MeasurementTooltipProps) => {
  const isPositive = measurement.priceChange >= 0;

  return (
    <TooltipContainer left={left} top={top}>
      <Text fontSize="2xs" color="fg.muted" mb={1}>
        {kline ? formatDateTimeTooltip(kline.openTime) : ''}
      </Text>
      <HStack gap={1.5}>
        <Text>📏</Text>
        <Text fontWeight="semibold" color="blue.500">
          Measurement
        </Text>
      </HStack>
      <HStack justify="space-between">
        <Text color="fg.muted">Klines:</Text>
        <Text fontWeight="medium">{measurement.klineCount}</Text>
      </HStack>
      <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
        <Text color="fg.muted">Price Change:</Text>
        <Text fontWeight="semibold" color={isPositive ? 'green.500' : 'red.500'}>
          {isPositive ? '+' : ''}
          {formatPriceDisplay(measurement.priceChange)}
        </Text>
      </HStack>
      <HStack justify="space-between">
        <Text color="fg.muted">Percentage:</Text>
        <Text fontWeight="semibold" color={isPositive ? 'green.500' : 'red.500'}>
          {isPositive ? '+' : ''}
          {measurement.percentChange.toFixed(2)}%
        </Text>
      </HStack>
    </TooltipContainer>
  );
};
