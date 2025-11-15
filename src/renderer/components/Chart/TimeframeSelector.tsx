import { HStack, Button } from '@chakra-ui/react';
import type { ReactElement } from 'react';

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1M';

export interface TimeframeSelectorProps {
  selectedTimeframe: Timeframe;
  onTimeframeChange: (timeframe: Timeframe) => void;
}

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'];

export const TimeframeSelector = ({
  selectedTimeframe,
  onTimeframeChange,
}: TimeframeSelectorProps): ReactElement => {
  return (
    <HStack gap={1}>
      {TIMEFRAMES.map((timeframe) => (
        <Button
          key={timeframe}
          size="xs"
          variant={selectedTimeframe === timeframe ? 'solid' : 'ghost'}
          colorPalette={selectedTimeframe === timeframe ? 'blue' : 'gray'}
          onClick={() => onTimeframeChange(timeframe)}
          fontWeight={selectedTimeframe === timeframe ? 'semibold' : 'normal'}
          color={selectedTimeframe === timeframe ? undefined : 'gray.400'}
          _hover={{
            bg: selectedTimeframe === timeframe ? undefined : 'gray.700',
          }}
        >
          {timeframe}
        </Button>
      ))}
    </HStack>
  );
};
