import { Box, Flex, HStack, IconButton, Stack, Text } from '@chakra-ui/react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
    HiOutlineChartBar,
    HiOutlineCurrencyDollar,
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
        <Text fontSize="xs" color="fg.muted" mb={1} fontWeight="semibold">
          {t('chart.controls.timeframe')}
        </Text>
        <TimeframeSelector
          selectedTimeframe={timeframe}
          onTimeframeChange={onTimeframeChange}
        />
      </Box>

      <Flex gap={4} wrap="wrap">
        <Box flex="0 0 auto" minW="100px">
          <Text fontSize="xs" color="fg.muted" mb={1} fontWeight="semibold">
            {t('chart.controls.chartType')}
          </Text>
          <HStack gap={2}>
            <TooltipWrapper label={t('chart.controls.candlestickChart')}>
              <IconButton
                size="sm"
                aria-label={t('chart.controls.candlestickChart')}
                onClick={() => onChartTypeChange('candlestick')}
                colorPalette={chartType === 'candlestick' ? 'blue' : 'gray'}
                variant={chartType === 'candlestick' ? 'solid' : 'ghost'}
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
                variant={chartType === 'line' ? 'solid' : 'ghost'}
              >
                <MdShowChart />
              </IconButton>
            </TooltipWrapper>
          </HStack>
        </Box>

        <Box flex="0 0 auto" minW="120px">
          <Text fontSize="xs" color="fg.muted" mb={1} fontWeight="semibold">
            {t('chart.controls.display')}
          </Text>
          <HStack gap={2}>
            <TooltipWrapper label={t('chart.controls.volume')}>
              <IconButton
                size="sm"
                aria-label={t('chart.controls.volume')}
                onClick={() => onShowVolumeChange(!showVolume)}
                colorPalette={showVolume ? 'blue' : 'gray'}
                variant={showVolume ? 'solid' : 'ghost'}
              >
                <HiOutlineChartBar />
              </IconButton>
            </TooltipWrapper>
            <TooltipWrapper label={t('chart.controls.grid')}>
              <IconButton
                size="sm"
                aria-label={t('chart.controls.grid')}
                onClick={() => onShowGridChange(!showGrid)}
                colorPalette={showGrid ? 'blue' : 'gray'}
                variant={showGrid ? 'solid' : 'ghost'}
              >
                <HiOutlineViewGrid />
              </IconButton>
            </TooltipWrapper>
            <TooltipWrapper label={t('chart.controls.currentPrice')}>
              <IconButton
                size="sm"
                aria-label={t('chart.controls.currentPrice')}
                onClick={() => onShowCurrentPriceLineChange(!showCurrentPriceLine)}
                colorPalette={showCurrentPriceLine ? 'blue' : 'gray'}
                variant={showCurrentPriceLine ? 'solid' : 'ghost'}
              >
                <HiOutlineCurrencyDollar />
              </IconButton>
            </TooltipWrapper>
          </HStack>
        </Box>

        {movingAverages.length > 0 && (
          <Box flex="1" minW="180px">
            <Text fontSize="xs" color="fg.muted" mb={1} fontWeight="semibold">
              {t('chart.controls.indicators')}
            </Text>
            <HStack gap={2} flexWrap="wrap">
              {movingAverages.map((ma, index) => (
                <TooltipWrapper key={index} label={`${ma.type === 'EMA' ? 'EMA' : 'SMA'}${ma.period}`}>
                  <IconButton
                    size="sm"
                    aria-label={`${ma.type === 'EMA' ? 'EMA' : 'SMA'}${ma.period}`}
                    onClick={() => toggleMA(index)}
                    colorPalette={ma.visible !== false ? 'blue' : 'gray'}
                    variant={ma.visible !== false ? 'solid' : 'ghost'}
                    style={{ 
                      position: 'relative',
                      borderLeft: ma.visible !== false ? `3px solid ${ma.color}` : undefined
                    }}
                  >
                    <Text fontSize="xs" fontWeight="medium">
                      {ma.type === 'EMA' ? 'EMA' : 'SMA'}{ma.period}
                    </Text>
                  </IconButton>
                </TooltipWrapper>
              ))}
            </HStack>
          </Box>
        )}
      </Flex>

        {pinnedControls.size > 0 && advancedConfig && (
          <Box>
            <Text fontSize="xs" color="fg.muted" mb={2} fontWeight="semibold">
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
