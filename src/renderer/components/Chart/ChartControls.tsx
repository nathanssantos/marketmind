import { Box, Switch as ChakraSwitch, HStack, IconButton, Stack, Text } from '@chakra-ui/react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
    HiOutlineChartBar,
    HiOutlineTrendingUp,
    HiOutlineViewGrid
} from 'react-icons/hi';
import { MdCandlestickChart, MdShowChart } from 'react-icons/md';
import { TooltipWrapper } from '../ui/Tooltip';
import type { AdvancedControlsConfig } from './AdvancedControls';
import { ControlPanel } from './ControlPanel';
import { PinnableControl } from './PinnableControl';
import { usePinnedControls } from './PinnedControlsContext';
import { TimeframeSelector, type Timeframe } from './TimeframeSelector';
import type { MovingAverageConfig } from './useMovingAverageRenderer';

export interface ChartControlsProps {
  showVolume: boolean;
  showGrid: boolean;
  showCurrentPriceLine: boolean;
  chartType: 'candlestick' | 'line';
  movingAverages: MovingAverageConfig[];
  advancedConfig?: AdvancedControlsConfig;
  timeframe: Timeframe;
  onShowVolumeChange: (show: boolean) => void;
  onShowGridChange: (show: boolean) => void;
  onShowCurrentPriceLineChange: (show: boolean) => void;
  onChartTypeChange: (type: 'candlestick' | 'line') => void;
  onMovingAveragesChange: (mas: MovingAverageConfig[]) => void;
  onAdvancedConfigChange?: (config: AdvancedControlsConfig) => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
}

export const ChartControls = ({
  showVolume,
  showGrid,
  showCurrentPriceLine,
  chartType,
  movingAverages,
  advancedConfig,
  timeframe,
  onShowVolumeChange,
  onShowGridChange,
  onShowCurrentPriceLineChange,
  onChartTypeChange,
  onMovingAveragesChange,
  onAdvancedConfigChange,
  onTimeframeChange,
}: ChartControlsProps): ReactElement => {
  const { t } = useTranslation();
  const { pinnedControls } = usePinnedControls();
  
  const toggleMA = (index: number): void => {
    const updated = movingAverages.map((ma, i) => 
      i === index 
        ? { ...ma, visible: ma.visible === false ? true : false }
        : ma
    );
    onMovingAveragesChange(updated);
  };

  const handleAdvancedChange = (key: keyof AdvancedControlsConfig, value: number): void => {
    if (advancedConfig && onAdvancedConfigChange) {
      onAdvancedConfigChange({
        ...advancedConfig,
        [key]: value,
      });
    }
  };

  const controlLabels: Record<string, string> = {
    rightMargin: t('chart.advanced.rightMargin'),
    volumeHeightRatio: t('chart.advanced.volumeHeight'),
    candleSpacing: t('chart.advanced.spacing'),
    candleWickWidth: t('chart.advanced.wickWidth'),
    gridLineWidth: t('chart.advanced.lineWidth'),
    paddingTop: t('chart.advanced.top'),
    paddingBottom: t('chart.advanced.bottom'),
    paddingLeft: t('chart.advanced.left'),
    paddingRight: t('chart.advanced.right'),
  };

  return (
    <ControlPanel title={t('chart.controls.title')}>
      <Box>
        <Text fontSize="xs" color="gray.400" mb={1} fontWeight="semibold">
          {t('chart.controls.timeframe')}
        </Text>
        <TimeframeSelector
          selectedTimeframe={timeframe}
          onTimeframeChange={onTimeframeChange}
        />
      </Box>

      <Box>
        <Text fontSize="xs" color="gray.400" mb={1} fontWeight="semibold">
          {t('chart.controls.chartType')}
        </Text>
        <HStack gap={2}>
          <TooltipWrapper label={t('chart.controls.candlestickChart')}>
            <IconButton
              size="sm"
              aria-label={t('chart.controls.candlestickChart')}
              onClick={() => onChartTypeChange('candlestick')}
              colorPalette={chartType === 'candlestick' ? 'blue' : 'gray'}
              variant={chartType === 'candlestick' ? 'solid' : 'outline'}
              color={chartType === 'candlestick' ? undefined : 'gray.400'}
            >
              <MdCandlestickChart />
            </IconButton>
          </TooltipWrapper>
          <TooltipWrapper label={t('chart.controls.lineChart')}>
            <IconButton
              size="sm"
              aria-label={t('chart.controls.lineChart')}
              onClick={() => onChartTypeChange('line')}
              colorPalette={chartType === 'line' ? 'blue' : 'gray'}
              variant={chartType === 'line' ? 'solid' : 'outline'}
              color={chartType === 'line' ? undefined : 'gray.400'}
            >
              <MdShowChart />
            </IconButton>
          </TooltipWrapper>
        </HStack>
      </Box>

        <Box>
          <Text fontSize="xs" color="gray.400" mb={2} fontWeight="semibold">
            {t('chart.controls.display')}
          </Text>
          <Stack gap={2}>
            <HStack justify="space-between" gap={3}>
              <HStack gap={2}>
                <HiOutlineChartBar size={14} color="var(--chakra-colors-gray-300)" />
                <Text fontSize="xs" color="gray.300">{t('chart.controls.volume')}</Text>
              </HStack>
              <ChakraSwitch.Root
                size="sm"
                checked={showVolume}
                onCheckedChange={(e) => onShowVolumeChange(e.checked)}
                colorPalette="blue"
              >
                <ChakraSwitch.HiddenInput />
                <ChakraSwitch.Control>
                  <ChakraSwitch.Thumb />
                </ChakraSwitch.Control>
              </ChakraSwitch.Root>
            </HStack>
            <HStack justify="space-between" gap={3}>
              <HStack gap={2}>
                <HiOutlineViewGrid size={14} color="var(--chakra-colors-gray-300)" />
                <Text fontSize="xs" color="gray.300">{t('chart.controls.grid')}</Text>
              </HStack>
              <ChakraSwitch.Root
                size="sm"
                checked={showGrid}
                onCheckedChange={(e) => onShowGridChange(e.checked)}
                colorPalette="blue"
              >
                <ChakraSwitch.HiddenInput />
                <ChakraSwitch.Control>
                  <ChakraSwitch.Thumb />
                </ChakraSwitch.Control>
              </ChakraSwitch.Root>
            </HStack>
            <HStack justify="space-between" gap={3}>
              <HStack gap={2}>
                <HiOutlineTrendingUp size={14} color="var(--chakra-colors-gray-300)" />
                <Text fontSize="xs" color="gray.300">{t('chart.controls.currentPrice')}</Text>
              </HStack>
              <ChakraSwitch.Root
                size="sm"
                checked={showCurrentPriceLine}
                onCheckedChange={(e) => onShowCurrentPriceLineChange(e.checked)}
                colorPalette="blue"
              >
                <ChakraSwitch.HiddenInput />
                <ChakraSwitch.Control>
                  <ChakraSwitch.Thumb />
                </ChakraSwitch.Control>
              </ChakraSwitch.Root>
            </HStack>
          </Stack>
        </Box>

        {movingAverages.length > 0 && (
          <Box>
            <Text fontSize="xs" color="gray.400" mb={2} fontWeight="semibold">
              {t('chart.controls.indicators')}
            </Text>
            <Stack gap={2}>
              {movingAverages.map((ma, index) => (
                <HStack key={index} justify="space-between" gap={3}>
                  <HStack gap={2}>
                    <HiOutlineTrendingUp size={14} color={ma.color} style={{ opacity: ma.visible !== false ? 1 : 0.3 }} />
                    <Text fontSize="xs" color="gray.300">
                      {ma.type}{ma.period}
                    </Text>
                  </HStack>
                  <ChakraSwitch.Root
                    size="sm"
                    checked={ma.visible !== false}
                    onCheckedChange={() => toggleMA(index)}
                    colorPalette="blue"
                  >
                    <ChakraSwitch.HiddenInput />
                    <ChakraSwitch.Control>
                      <ChakraSwitch.Thumb />
                    </ChakraSwitch.Control>
                  </ChakraSwitch.Root>
                </HStack>
              ))}
            </Stack>
          </Box>
        )}

        {pinnedControls.size > 0 && advancedConfig && (
          <Box>
            <Text fontSize="xs" color="gray.400" mb={2} fontWeight="semibold">
              {t('chart.controls.quickSettings')}
            </Text>
            <Stack gap={2}>
              {Array.from(pinnedControls).map((controlKey) => (
                <PinnableControl
                  key={controlKey}
                  label={controlLabels[controlKey] || controlKey}
                  value={advancedConfig[controlKey]}
                  onChange={(value) => handleAdvancedChange(controlKey, value)}
                  controlKey={controlKey}
                  step={controlKey === 'volumeHeightRatio' ? '0.05' : undefined}
                  min={controlKey === 'volumeHeightRatio' ? '0' : undefined}
                  max={controlKey === 'volumeHeightRatio' ? '1' : undefined}
                />
              ))}
            </Stack>
          </Box>
        )}
    </ControlPanel>
  );
};
