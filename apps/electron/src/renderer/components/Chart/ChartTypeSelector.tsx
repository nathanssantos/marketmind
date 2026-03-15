import { Box, Flex, Text, VStack } from '@chakra-ui/react';
import { Button, Popover } from '@renderer/components/ui';
import type { ChartType } from '@marketmind/types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChartCandlestick } from 'react-icons/lu';

interface ChartTypeSelectorProps {
  chartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
}

const CHART_TYPES: { value: ChartType; labelKey: string }[] = [
  { value: 'kline', labelKey: 'chart.type.candle' },
  { value: 'line', labelKey: 'chart.type.line' },
  { value: 'tick', labelKey: 'chart.type.tick' },
  { value: 'volume', labelKey: 'chart.type.volume' },
  { value: 'footprint', labelKey: 'chart.type.footprint' },
];

export function ChartTypeSelector({ chartType, onChartTypeChange }: ChartTypeSelectorProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const currentLabel = CHART_TYPES.find((ct) => ct.value === chartType);

  const handleSelect = (type: ChartType) => {
    onChartTypeChange(type);
    setIsOpen(false);
  };

  return (
    <Popover
      open={isOpen}
      onOpenChange={(e) => setIsOpen(e.open)}
      showArrow={false}
      width="160px"
      positioning={{ placement: 'bottom-start', offset: { mainAxis: 8 } }}
      trigger={
        <Button
          aria-label={t('chart.controls.chartType')}
          size="2xs"
          variant="outline"
          color="fg.muted"
        >
          <LuChartCandlestick />
          {currentLabel ? t(currentLabel.labelKey, currentLabel.value) : chartType}
        </Button>
      }
    >
      <Flex direction="column" maxH="300px">
        <Box overflowY="auto" flex={1}>
          <VStack gap={0} align="stretch">
            {CHART_TYPES.map(({ value, labelKey }) => (
              <Box
                key={value}
                px={3}
                py={2}
                cursor="pointer"
                bg={chartType === value ? 'bg.muted' : 'transparent'}
                _hover={{ bg: 'bg.muted' }}
                onClick={() => handleSelect(value)}
                borderBottomWidth="1px"
                borderColor="border"
              >
                <Text
                  fontWeight={chartType === value ? 'semibold' : 'medium'}
                  fontSize="xs"
                  color="fg"
                >
                  {t(labelKey, value)}
                </Text>
              </Box>
            ))}
          </VStack>
        </Box>
      </Flex>
    </Popover>
  );
}
