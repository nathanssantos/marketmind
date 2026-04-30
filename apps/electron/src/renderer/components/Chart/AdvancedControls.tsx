import { Box, Text } from '@chakra-ui/react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ControlPanel } from './ControlPanel';
import { PinnableControl } from './PinnableControl';

export interface AdvancedControlsConfig {
  rightMargin: number;
  volumeHeightRatio: number;

  klineSpacing: number;
  klineWickWidth: number;

  gridLineWidth: number;

  currentPriceLineWidth: number;
  currentPriceLineStyle: 'solid' | 'dashed' | 'dotted';

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
  const { t } = useTranslation();

  const handleChange = (key: keyof AdvancedControlsConfig, value: number): void => {
    onConfigChange({
      ...config,
      [key]: value,
    });
  };

  return (
    <ControlPanel
      title={t('chart.advanced.title')}
      defaultExpanded={false}
    >
      <Box>
        <Text fontSize="xs" color="fg.muted" mb={2} fontWeight="semibold">
          {t('chart.advanced.chartDimensions')}
        </Text>
        <Box>
          <PinnableControl
            label={t('chart.advanced.rightMargin')}
            value={config.rightMargin}
            onChange={(value) => handleChange('rightMargin', value)}
            controlKey="rightMargin"
          />
          <Box mt={2}>
            <PinnableControl
              label={t('chart.advanced.volumeHeight')}
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

      <Box>
        <Text fontSize="xs" color="fg.muted" mb={2} fontWeight="semibold">
          {t('chart.advanced.klineSettings')}
        </Text>
        <Box>
          <PinnableControl
            label={t('chart.advanced.spacing')}
            value={config.klineSpacing}
            onChange={(value) => handleChange('klineSpacing', value)}
            controlKey="klineSpacing"
          />
          <Box mt={2}>
            <PinnableControl
              label={t('chart.advanced.wickWidth')}
              value={config.klineWickWidth}
              onChange={(value) => handleChange('klineWickWidth', value)}
              controlKey="klineWickWidth"
            />
          </Box>
        </Box>
      </Box>

      <Box>
        <Text fontSize="xs" color="fg.muted" mb={2} fontWeight="semibold">
          {t('chart.advanced.gridSettings')}
        </Text>
        <PinnableControl
          label={t('chart.advanced.lineWidth')}
          value={config.gridLineWidth}
          onChange={(value) => handleChange('gridLineWidth', value)}
          controlKey="gridLineWidth"
        />
      </Box>

      <Box>
        <Text fontSize="xs" color="fg.muted" mb={2} fontWeight="semibold">
          {t('chart.advanced.padding')}
        </Text>
        <Box>
          <PinnableControl
            label={t('chart.advanced.top')}
            value={config.paddingTop}
            onChange={(value) => handleChange('paddingTop', value)}
            controlKey="paddingTop"
          />
          <Box mt={2}>
            <PinnableControl
              label={t('chart.advanced.bottom')}
              value={config.paddingBottom}
              onChange={(value) => handleChange('paddingBottom', value)}
              controlKey="paddingBottom"
            />
          </Box>
          <Box mt={2}>
            <PinnableControl
              label={t('chart.advanced.left')}
              value={config.paddingLeft}
              onChange={(value) => handleChange('paddingLeft', value)}
              controlKey="paddingLeft"
            />
          </Box>
          <Box mt={2}>
            <PinnableControl
              label={t('chart.advanced.right')}
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
