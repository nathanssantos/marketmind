import { Box, HStack, IconButton, Stack, Text, Switch as ChakraSwitch } from '@chakra-ui/react';
import { 
  HiOutlineChartBar, 
  HiOutlinePresentationChartLine, 
  HiOutlineViewGrid,
  HiOutlineTrendingUp 
} from 'react-icons/hi';
import type { ReactElement } from 'react';
import type { MovingAverageConfig } from './useMovingAverageRenderer';
import { ControlPanel } from './ControlPanel';
import { usePinnedControls } from './PinnedControlsContext';
import { PinnableControl } from './PinnableControl';
import type { AdvancedControlsConfig } from './AdvancedControls';
import { TimeframeSelector, type Timeframe } from './TimeframeSelector';

export interface ChartControlsProps {
  showVolume: boolean;
  showGrid: boolean;
  chartType: 'candlestick' | 'line';
  movingAverages: MovingAverageConfig[];
  advancedConfig?: AdvancedControlsConfig;
  timeframe: Timeframe;
  onShowVolumeChange: (show: boolean) => void;
  onShowGridChange: (show: boolean) => void;
  onChartTypeChange: (type: 'candlestick' | 'line') => void;
  onMovingAveragesChange: (mas: MovingAverageConfig[]) => void;
  onAdvancedConfigChange?: (config: AdvancedControlsConfig) => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
}

export const ChartControls = ({
  showVolume,
  showGrid,
  chartType,
  movingAverages,
  advancedConfig,
  timeframe,
  onShowVolumeChange,
  onShowGridChange,
  onChartTypeChange,
  onMovingAveragesChange,
  onAdvancedConfigChange,
  onTimeframeChange,
}: ChartControlsProps): ReactElement => {
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
    rightMargin: 'Right Margin',
    volumeHeightRatio: 'Volume Height %',
    candleSpacing: 'Candle Spacing',
    candleWickWidth: 'Wick Width',
    gridLineWidth: 'Grid Line Width',
    paddingTop: 'Padding Top',
    paddingBottom: 'Padding Bottom',
    paddingLeft: 'Padding Left',
    paddingRight: 'Padding Right',
  };

  return (
    <ControlPanel title="Chart Controls">
      {/* Timeframe Selector */}
      <Box>
        <Text fontSize="xs" color="gray.400" mb={1} fontWeight="semibold">
          Timeframe
        </Text>
        <TimeframeSelector
          selectedTimeframe={timeframe}
          onTimeframeChange={onTimeframeChange}
        />
      </Box>

      {/* Chart Type */}
      <Box>
        <Text fontSize="xs" color="gray.400" mb={1} fontWeight="semibold">
          Chart Type
        </Text>
        <HStack gap={2}>
          <IconButton
            size="sm"
            aria-label="Candlestick chart"
            onClick={() => onChartTypeChange('candlestick')}
            colorPalette={chartType === 'candlestick' ? 'blue' : 'gray'}
            variant={chartType === 'candlestick' ? 'solid' : 'outline'}
            color={chartType === 'candlestick' ? undefined : 'gray.400'}
          >
            <HiOutlineChartBar />
          </IconButton>
          <IconButton
            size="sm"
            aria-label="Line chart"
            onClick={() => onChartTypeChange('line')}
            colorPalette={chartType === 'line' ? 'blue' : 'gray'}
            variant={chartType === 'line' ? 'solid' : 'outline'}
            color={chartType === 'line' ? undefined : 'gray.400'}
          >
            <HiOutlinePresentationChartLine />
          </IconButton>
        </HStack>
      </Box>

        {/* Display Options */}
        <Box>
          <Text fontSize="xs" color="gray.400" mb={2} fontWeight="semibold">
            Display
          </Text>
          <Stack gap={2}>
            <HStack justify="space-between" gap={3}>
              <HStack gap={2}>
                <HiOutlineChartBar size={14} color="var(--chakra-colors-gray-300)" />
                <Text fontSize="xs" color="gray.300">Volume</Text>
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
                <Text fontSize="xs" color="gray.300">Grid</Text>
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
          </Stack>
        </Box>

        {/* Moving Averages */}
        {movingAverages.length > 0 && (
          <Box>
            <Text fontSize="xs" color="gray.400" mb={2} fontWeight="semibold">
              Indicators
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

        {/* Pinned Advanced Controls */}
        {pinnedControls.size > 0 && advancedConfig && (
          <Box>
            <Text fontSize="xs" color="gray.400" mb={2} fontWeight="semibold">
              Quick Settings
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
