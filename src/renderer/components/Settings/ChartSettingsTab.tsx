import { Field } from '@/renderer/components/ui/field';
import { NumberInput } from '@/renderer/components/ui/number-input';
import { Box, Stack, Text } from '@chakra-ui/react';
import type { AdvancedControlsConfig } from '../Chart/AdvancedControls';

interface ChartSettingsTabProps {
  config: AdvancedControlsConfig;
  onConfigChange: (config: AdvancedControlsConfig) => void;
}

export const ChartSettingsTab = ({ config, onConfigChange }: ChartSettingsTabProps) => {
  const handleChange = (key: keyof AdvancedControlsConfig, value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;
    
    onConfigChange({
      ...config,
      [key]: numValue,
    });
  };

  return (
    <Stack gap={6}>
      {/* Chart Dimensions */}
      <Box>
        <Text fontSize="sm" fontWeight="bold" mb={4}>
          Chart Dimensions
        </Text>
        <Stack gap={4}>
          <Field label="Right Margin" helperText="Space reserved on the right side of the chart">
            <NumberInput
              value={config.rightMargin}
              onChange={(e) => handleChange('rightMargin', e.target.value)}
              min={0}
              max={500}
            />
          </Field>

          <Field label="Volume Height Ratio" helperText="Height of volume bars relative to chart (0-1)">
            <NumberInput
              value={config.volumeHeightRatio}
              onChange={(e) => handleChange('volumeHeightRatio', e.target.value)}
              min={0}
              max={1}
              step={0.05}
            />
          </Field>
        </Stack>
      </Box>

      {/* Candle Settings */}
      <Box>
        <Text fontSize="sm" fontWeight="bold" mb={4}>
          Candle Settings
        </Text>
        <Stack gap={4}>
          <Field label="Candle Spacing" helperText="Space between candles">
            <NumberInput
              value={config.candleSpacing}
              onChange={(e) => handleChange('candleSpacing', e.target.value)}
              min={2}
              max={30}
            />
          </Field>

          <Field label="Wick Width" helperText="Width of candle wicks">
            <NumberInput
              value={config.candleWickWidth}
              onChange={(e) => handleChange('candleWickWidth', e.target.value)}
              min={1}
              max={10}
            />
          </Field>
        </Stack>
      </Box>

      {/* Grid Settings */}
      <Box>
        <Text fontSize="sm" fontWeight="bold" mb={4}>
          Grid Settings
        </Text>
        <Field label="Grid Line Width" helperText="Thickness of grid lines">
          <NumberInput
            value={config.gridLineWidth}
            onChange={(e) => handleChange('gridLineWidth', e.target.value)}
            min={1}
            max={5}
          />
        </Field>
      </Box>

      {/* Padding */}
      <Box>
        <Text fontSize="sm" fontWeight="bold" mb={4}>
          Chart Padding
        </Text>
        <Stack gap={4}>
          <Field label="Top Padding">
            <NumberInput
              value={config.paddingTop}
              onChange={(e) => handleChange('paddingTop', e.target.value)}
              min={0}
              max={100}
            />
          </Field>

          <Field label="Bottom Padding">
            <NumberInput
              value={config.paddingBottom}
              onChange={(e) => handleChange('paddingBottom', e.target.value)}
              min={0}
              max={100}
            />
          </Field>

          <Field label="Left Padding">
            <NumberInput
              value={config.paddingLeft}
              onChange={(e) => handleChange('paddingLeft', e.target.value)}
              min={0}
              max={100}
            />
          </Field>

          <Field label="Right Padding">
            <NumberInput
              value={config.paddingRight}
              onChange={(e) => handleChange('paddingRight', e.target.value)}
              min={0}
              max={100}
            />
          </Field>
        </Stack>
      </Box>
    </Stack>
  );
};
