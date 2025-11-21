import { Box, Flex, IconButton, Text, VStack } from '@chakra-ui/react';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuClock } from 'react-icons/lu';
import { Popover } from '../ui/popover';
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
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (timeframe: Timeframe) => {
    onTimeframeChange(timeframe);
    setIsOpen(false);
  };

  return (
    <Popover
      open={isOpen}
      onOpenChange={(e) => setIsOpen(e.open)}
      showArrow={false}
      width="200px"
      positioning={{ placement: 'bottom-start', offset: { mainAxis: 8 } }}
      trigger={
        <Flex align="center" gap={2}>
          <TooltipWrapper label={t('chart.controls.timeframe')} showArrow isDisabled={isOpen}>
            <IconButton
              aria-label={t('chart.controls.timeframe')}
              size="2xs"
              variant="solid"
              colorPalette="blue"
            >
              <LuClock />
            </IconButton>
          </TooltipWrapper>
          <Text fontSize="xs" fontWeight="semibold" color="fg">
            {selectedTimeframe}
          </Text>
        </Flex>
      }
    >
      <Flex direction="column" maxH="300px">
        <Box overflowY="auto" flex={1}>
          <VStack gap={0} align="stretch">
            {TIMEFRAMES.map((timeframe) => (
              <Box
                key={timeframe}
                px={3}
                py={2}
                cursor="pointer"
                bg={selectedTimeframe === timeframe ? 'bg.muted' : 'transparent'}
                _hover={{ bg: 'bg.muted' }}
                onClick={() => handleSelect(timeframe)}
                borderBottomWidth="1px"
                borderColor="border"
              >
                <Text
                  fontWeight={selectedTimeframe === timeframe ? 'semibold' : 'medium'}
                  fontSize="xs"
                  color="fg"
                >
                  {timeframe}
                </Text>
              </Box>
            ))}
          </VStack>
        </Box>
      </Flex>
    </Popover>
  );
};
