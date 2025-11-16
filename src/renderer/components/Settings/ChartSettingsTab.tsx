import { Field } from '@/renderer/components/ui/field';
import { NumberInput } from '@/renderer/components/ui/number-input';
import { Select } from '@/renderer/components/ui/select';
import { Box, Stack, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import type { AdvancedControlsConfig } from '../Chart/AdvancedControls';

interface ChartSettingsTabProps {
  config: AdvancedControlsConfig;
  onConfigChange: (config: AdvancedControlsConfig) => void;
}

export const ChartSettingsTab = ({ config, onConfigChange }: ChartSettingsTabProps) => {
  const { t } = useTranslation();

  const handleChange = (key: keyof AdvancedControlsConfig, value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;
    
    onConfigChange({
      ...config,
      [key]: numValue,
    });
  };

  const handleStyleChange = (value: string) => {
    onConfigChange({
      ...config,
      currentPriceLineStyle: value as 'solid' | 'dashed' | 'dotted',
    });
  };

  return (
    <Stack gap={6}>
      {/* Chart Dimensions */}
      <Box>
        <Text fontSize="sm" fontWeight="bold" mb={4}>
          {t('settings.chart.chartDimensions')}
        </Text>
        <Stack gap={4}>
          <Field label={t('settings.chart.rightMargin')} helperText={t('settings.chart.rightMarginHelper')}>
            <NumberInput
              value={config.rightMargin}
              onChange={(e) => handleChange('rightMargin', e.target.value)}
              min={0}
              max={500}
            />
          </Field>

          <Field label={t('settings.chart.volumeHeightRatio')} helperText={t('settings.chart.volumeHeightRatioHelper')}>
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
          {t('settings.chart.candleSettings')}
        </Text>
        <Stack gap={4}>
          <Field label={t('settings.chart.candleSpacing')} helperText={t('settings.chart.candleSpacingHelper')}>
            <NumberInput
              value={config.candleSpacing}
              onChange={(e) => handleChange('candleSpacing', e.target.value)}
              min={2}
              max={30}
            />
          </Field>

          <Field label={t('settings.chart.wickWidth')} helperText={t('settings.chart.wickWidthHelper')}>
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
          {t('settings.chart.gridSettings')}
        </Text>
        <Field label={t('settings.chart.gridLineWidth')} helperText={t('settings.chart.gridLineWidthHelper')}>
          <NumberInput
            value={config.gridLineWidth}
            onChange={(e) => handleChange('gridLineWidth', e.target.value)}
            min={1}
            max={5}
          />
        </Field>
      </Box>

      {/* Current Price Line Settings */}
      <Box>
        <Text fontSize="sm" fontWeight="bold" mb={4}>
          {t('settings.chart.currentPriceLine')}
        </Text>
        <Stack gap={4}>
          <Field label={t('settings.chart.lineWidth')} helperText={t('settings.chart.lineWidthHelper')}>
            <NumberInput
              value={config.currentPriceLineWidth}
              onChange={(e) => handleChange('currentPriceLineWidth', e.target.value)}
              min={1}
              max={5}
            />
          </Field>

          <Field label={t('settings.chart.lineStyle')} helperText={t('settings.chart.lineStyleHelper')}>
            <Select
              value={config.currentPriceLineStyle}
              onChange={handleStyleChange}
              options={[
                { value: 'solid', label: t('settings.chart.solid') },
                { value: 'dashed', label: t('settings.chart.dashed') },
                { value: 'dotted', label: t('settings.chart.dotted') },
              ]}
            />
          </Field>
        </Stack>
      </Box>

      {/* Padding */}
      <Box>
        <Text fontSize="sm" fontWeight="bold" mb={4}>
          {t('settings.chart.chartPadding')}
        </Text>
        <Stack gap={4}>
          <Field label={t('settings.chart.topPadding')}>
            <NumberInput
              value={config.paddingTop}
              onChange={(e) => handleChange('paddingTop', e.target.value)}
              min={0}
              max={100}
            />
          </Field>

          <Field label={t('settings.chart.bottomPadding')}>
            <NumberInput
              value={config.paddingBottom}
              onChange={(e) => handleChange('paddingBottom', e.target.value)}
              min={0}
              max={100}
            />
          </Field>

          <Field label={t('settings.chart.leftPadding')}>
            <NumberInput
              value={config.paddingLeft}
              onChange={(e) => handleChange('paddingLeft', e.target.value)}
              min={0}
              max={100}
            />
          </Field>

          <Field label={t('settings.chart.rightPadding')}>
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
