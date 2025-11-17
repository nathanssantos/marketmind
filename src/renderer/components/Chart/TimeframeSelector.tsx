import { HStack, IconButton, Text } from '@chakra-ui/react';
import type { ReactElement } from 'react';
import { TooltipWrapper } from '../ui/Tooltip';

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
        <TooltipWrapper key={timeframe} label={`Timeframe: ${timeframe}`} showArrow>
          <IconButton
            size="sm"
            variant={selectedTimeframe === timeframe ? 'solid' : 'ghost'}
            colorPalette={selectedTimeframe === timeframe ? 'blue' : 'gray'}
            onClick={() => onTimeframeChange(timeframe)}
            aria-label={timeframe}
          >
            <Text fontSize="xs" fontWeight={selectedTimeframe === timeframe ? 'semibold' : 'normal'}>
              {timeframe}
            </Text>
          </IconButton>
        </TooltipWrapper>
      ))}
    </HStack>
  );
};
