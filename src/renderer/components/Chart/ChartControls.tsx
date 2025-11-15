import { Box, HStack, IconButton, Stack, Text } from '@chakra-ui/react';
import type { ReactElement } from 'react';
import type { MovingAverageConfig } from './useMovingAverageRenderer';

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
    <Box
      position="absolute"
      top={4}
      left={4}
      bg="gray.800"
      p={3}
      borderRadius="md"
      boxShadow="lg"
      zIndex={10}
      opacity={0.95}
    >
      <Stack gap={3}>
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
            >
              📊
            </IconButton>
            <IconButton
              size="sm"
              aria-label="Line chart"
              onClick={() => onChartTypeChange('line')}
              colorPalette={chartType === 'line' ? 'blue' : 'gray'}
              variant={chartType === 'line' ? 'solid' : 'outline'}
            >
              📈
            </IconButton>
          </HStack>
        </Box>

        {/* Display Options */}
        <Box>
          <Text fontSize="xs" color="gray.400" mb={1} fontWeight="semibold">
            Display
          </Text>
          <Stack gap={1}>
            <HStack gap={2}>
              <IconButton
                size="sm"
                aria-label="Toggle volume"
                onClick={() => onShowVolumeChange(!showVolume)}
                colorPalette={showVolume ? 'blue' : 'gray'}
                variant={showVolume ? 'solid' : 'outline'}
              >
                📊
              </IconButton>
              <Text fontSize="xs" color="gray.300">
                Volume
              </Text>
            </HStack>
            <HStack gap={2}>
              <IconButton
                size="sm"
                aria-label="Toggle grid"
                onClick={() => onShowGridChange(!showGrid)}
                colorPalette={showGrid ? 'blue' : 'gray'}
                variant={showGrid ? 'solid' : 'outline'}
              >
                ⊞
              </IconButton>
              <Text fontSize="xs" color="gray.300">
                Grid
              </Text>
            </HStack>
          </Stack>
        </Box>

        {/* Moving Averages */}
        {movingAverages.length > 0 && (
          <Box>
            <Text fontSize="xs" color="gray.400" mb={1} fontWeight="semibold">
              Indicators
            </Text>
            <Stack gap={1}>
              {movingAverages.map((ma, index) => (
                <HStack key={index} gap={2}>
                  <IconButton
                    size="sm"
                    aria-label={`Toggle ${ma.type}${ma.period}`}
                    onClick={() => toggleMA(index)}
                    colorPalette={ma.visible !== false ? 'blue' : 'gray'}
                    variant={ma.visible !== false ? 'solid' : 'outline'}
                  >
                    ～
                  </IconButton>
                  <HStack gap={1}>
                    <Box
                      w={3}
                      h={3}
                      bg={ma.color}
                      borderRadius="sm"
                      opacity={ma.visible !== false ? 1 : 0.3}
                    />
                    <Text fontSize="xs" color="gray.300">
                      {ma.type}{ma.period}
                    </Text>
                  </HStack>
                </HStack>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Box>
  );
};
