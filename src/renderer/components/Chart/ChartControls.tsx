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

export interface ChartControlsProps {
  showVolume: boolean;
  showGrid: boolean;
  chartType: 'candlestick' | 'line';
  movingAverages: MovingAverageConfig[];
  onShowVolumeChange: (show: boolean) => void;
  onShowGridChange: (show: boolean) => void;
  onChartTypeChange: (type: 'candlestick' | 'line') => void;
  onMovingAveragesChange: (mas: MovingAverageConfig[]) => void;
}

export const ChartControls = ({
  showVolume,
  showGrid,
  chartType,
  movingAverages,
  onShowVolumeChange,
  onShowGridChange,
  onChartTypeChange,
  onMovingAveragesChange,
}: ChartControlsProps): ReactElement => {
  const toggleMA = (index: number): void => {
    const updated = movingAverages.map((ma, i) => 
      i === index 
        ? { ...ma, visible: ma.visible === false ? true : false }
        : ma
    );
    onMovingAveragesChange(updated);
  };

  return (
    <ControlPanel title="Chart Controls">
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
    </ControlPanel>
  );
};
