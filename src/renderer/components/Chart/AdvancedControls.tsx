import { Box, Text } from '@chakra-ui/react';
import type { ReactElement } from 'react';
import { ControlPanel } from './ControlPanel';
import { PinnableControl } from './PinnableControl';

export interface AdvancedControlsConfig {
  // Chart Dimensions
  rightMargin: number;
  volumeHeightRatio: number;
  
  // Candle Settings
  candleSpacing: number;
  candleWickWidth: number;
  
  // Grid Settings
  gridLineWidth: number;
  
  // Current Price Line
  currentPriceLineWidth: number;
  currentPriceLineStyle: 'solid' | 'dashed' | 'dotted';
  
  // Padding
  paddingTop: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
}

export interface AdvancedControlsProps {
  config: AdvancedControlsConfig;
  onConfigChange: (config: AdvancedControlsConfig) => void;
}

export const AdvancedControls = ({
  config,
  onConfigChange,
}: AdvancedControlsProps): ReactElement => {
  const handleChange = (key: keyof AdvancedControlsConfig, value: number): void => {
    onConfigChange({
      ...config,
      [key]: value,
    });
  };

  return (
    <ControlPanel 
      title="Advanced Settings" 
      defaultExpanded={false}
    >
      {/* Chart Dimensions */}
      <Box>
        <Text fontSize="xs" color="gray.400" mb={2} fontWeight="semibold">
          Chart Dimensions
        </Text>
        <Box>
          <PinnableControl
            label="Right Margin"
            value={config.rightMargin}
            onChange={(value) => handleChange('rightMargin', value)}
            controlKey="rightMargin"
          />
          <Box mt={2}>
            <PinnableControl
              label="Volume Height %"
              value={config.volumeHeightRatio}
              onChange={(value) => handleChange('volumeHeightRatio', value)}
              controlKey="volumeHeightRatio"
              step="0.05"
              min="0"
              max="1"
            />
          </Box>
        </Box>
      </Box>

      {/* Candle Settings */}
      <Box>
        <Text fontSize="xs" color="gray.400" mb={2} fontWeight="semibold">
          Candle Settings
        </Text>
        <Box>
          <PinnableControl
            label="Spacing"
            value={config.candleSpacing}
            onChange={(value) => handleChange('candleSpacing', value)}
            controlKey="candleSpacing"
          />
          <Box mt={2}>
            <PinnableControl
              label="Wick Width"
              value={config.candleWickWidth}
              onChange={(value) => handleChange('candleWickWidth', value)}
              controlKey="candleWickWidth"
            />
          </Box>
        </Box>
      </Box>

      {/* Grid Settings */}
      <Box>
        <Text fontSize="xs" color="gray.400" mb={2} fontWeight="semibold">
          Grid Settings
        </Text>
        <PinnableControl
          label="Line Width"
          value={config.gridLineWidth}
          onChange={(value) => handleChange('gridLineWidth', value)}
          controlKey="gridLineWidth"
        />
      </Box>

      {/* Padding */}
      <Box>
        <Text fontSize="xs" color="gray.400" mb={2} fontWeight="semibold">
          Padding
        </Text>
        <Box>
          <PinnableControl
            label="Top"
            value={config.paddingTop}
            onChange={(value) => handleChange('paddingTop', value)}
            controlKey="paddingTop"
          />
          <Box mt={2}>
            <PinnableControl
              label="Bottom"
              value={config.paddingBottom}
              onChange={(value) => handleChange('paddingBottom', value)}
              controlKey="paddingBottom"
            />
          </Box>
          <Box mt={2}>
            <PinnableControl
              label="Left"
              value={config.paddingLeft}
              onChange={(value) => handleChange('paddingLeft', value)}
              controlKey="paddingLeft"
            />
          </Box>
          <Box mt={2}>
            <PinnableControl
              label="Right"
              value={config.paddingRight}
              onChange={(value) => handleChange('paddingRight', value)}
              controlKey="paddingRight"
            />
          </Box>
        </Box>
      </Box>
    </ControlPanel>
  );
};
