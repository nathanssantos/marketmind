import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LuChartBar,
  LuChartCandlestick,
  LuChartLine,
  LuCrosshair,
  LuDollarSign,
  LuGrid3X3
} from 'react-icons/lu';
import { ToggleIconButton, TooltipWrapper } from '@renderer/components/ui';
import type { AdvancedControlsConfig } from './AdvancedControls';
import { ControlPanel } from './ControlPanel';
import { PinnableControl } from './PinnableControl';
import { usePinnedControls } from './PinnedControlsContext';
import { TimeframeSelector, type Timeframe } from './TimeframeSelector';

export interface ChartControlsProps {
  showVolume: boolean;
  showGrid: boolean;
  showCurrentPriceLine: boolean;
  showCrosshair: boolean;
  chartType: 'kline' | 'line';
  advancedConfig?: AdvancedControlsConfig;
  timeframe: Timeframe;
  onShowVolumeChange: (show: boolean) => void;
  onShowGridChange: (show: boolean) => void;
  onShowCurrentPriceLineChange: (show: boolean) => void;
  onShowCrosshairChange: (show: boolean) => void;
  onChartTypeChange: (type: 'kline' | 'line') => void;
  onAdvancedConfigChange?: (config: AdvancedControlsConfig) => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
}

export const ChartControls = ({
  showVolume,
  showGrid,
  showCurrentPriceLine,
  showCrosshair,
  chartType,
  advancedConfig,
  timeframe,
  onShowVolumeChange,
  onShowGridChange,
  onShowCurrentPriceLineChange,
  onShowCrosshairChange,
  onChartTypeChange,
  onAdvancedConfigChange,
  onTimeframeChange,
}: ChartControlsProps): ReactElement => {
  const { t } = useTranslation();
  const { pinnedControls } = usePinnedControls();

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
    klineSpacing: t('chart.advanced.spacing'),
    klineWickWidth: t('chart.advanced.wickWidth'),
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
            <TooltipWrapper label={t('chart.controls.klineChart')}>
              <ToggleIconButton
                active={chartType === 'kline'}
                size="sm"
                aria-label={t('chart.controls.klineChart')}
                onClick={() => onChartTypeChange('kline')}
              >
                <LuChartCandlestick />
              </ToggleIconButton>
            </TooltipWrapper>
            <TooltipWrapper label={t('chart.controls.lineChart')}>
              <ToggleIconButton
                active={chartType === 'line'}
                size="sm"
                aria-label={t('chart.controls.lineChart')}
                onClick={() => onChartTypeChange('line')}
              >
                <LuChartLine />
              </ToggleIconButton>
            </TooltipWrapper>
          </HStack>
        </Box>

        <Box flex="0 0 auto" minW="120px">
          <Text fontSize="xs" color="fg.muted" mb={1} fontWeight="semibold">
            {t('chart.controls.display')}
          </Text>
          <HStack gap={2}>
            <TooltipWrapper label={t('chart.controls.volume')}>
              <ToggleIconButton
                active={showVolume}
                size="sm"
                aria-label={t('chart.controls.volume')}
                onClick={() => onShowVolumeChange(!showVolume)}
              >
                <LuChartBar />
              </ToggleIconButton>
            </TooltipWrapper>
            <TooltipWrapper label={t('chart.controls.grid')}>
              <ToggleIconButton
                active={showGrid}
                size="sm"
                aria-label={t('chart.controls.grid')}
                onClick={() => onShowGridChange(!showGrid)}
              >
                <LuGrid3X3 />
              </ToggleIconButton>
            </TooltipWrapper>
            <TooltipWrapper label={t('chart.controls.currentPrice')}>
              <ToggleIconButton
                active={showCurrentPriceLine}
                size="sm"
                aria-label={t('chart.controls.currentPrice')}
                onClick={() => onShowCurrentPriceLineChange(!showCurrentPriceLine)}
              >
                <LuDollarSign />
              </ToggleIconButton>
            </TooltipWrapper>
            <TooltipWrapper label={t('chart.controls.crosshair')}>
              <ToggleIconButton
                active={showCrosshair}
                size="sm"
                aria-label={t('chart.controls.crosshair')}
                onClick={() => onShowCrosshairChange(!showCrosshair)}
              >
                <LuCrosshair />
              </ToggleIconButton>
            </TooltipWrapper>
          </HStack>
        </Box>

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
                label={controlLabels[controlKey] ?? controlKey}
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
