import { IconButton, Popover, TooltipWrapper } from '@renderer/components/ui';
import type { TimeInterval } from '@marketmind/types';
import { UI_INTERVALS } from '@marketmind/types';
import { Box, Flex, Text, VStack } from '@chakra-ui/react';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuClock } from 'react-icons/lu';

export type Timeframe = TimeInterval;

export interface TimeframeSelectorProps {
  selectedTimeframe: TimeInterval;
  onTimeframeChange: (timeframe: TimeInterval) => void;
}

export const TimeframeSelector = ({
  selectedTimeframe,
  onTimeframeChange,
}: TimeframeSelectorProps): ReactElement => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (timeframe: TimeInterval) => {
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
              variant="outline"
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
            {UI_INTERVALS.map((timeframe) => (
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
