import { Button } from '@/renderer/components/ui/button';
import { Field } from '@/renderer/components/ui/field';
import { NumberInput } from '@/renderer/components/ui/number-input';
import { Select } from '@/renderer/components/ui/select';
import { DEFAULT_ADVANCED_CONFIG } from '@/renderer/constants/defaults';
import { useDebounceCallback } from '@/renderer/hooks/useDebounceCallback';
import { Box, Grid, Separator, Stack, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuRefreshCw } from 'react-icons/lu';
import type { AdvancedControlsConfig } from '../Chart/AdvancedControls';

interface ChartSettingsTabProps {
  config: AdvancedControlsConfig;
  onConfigChange: (config: AdvancedControlsConfig) => void;
}

export const ChartSettingsTab = ({ config, onConfigChange }: ChartSettingsTabProps) => {
  const { t } = useTranslation();

  const debouncedConfigChange = useDebounceCallback(onConfigChange, 300);

  const handleChange = (key: keyof AdvancedControlsConfig, value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    debouncedConfigChange({
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

  const handleReset = () => {
    onConfigChange(DEFAULT_ADVANCED_CONFIG);
  };

  return (
    <Stack gap={6}>
      <Box>
        <Text fontSize="md" fontWeight="medium" mb={3}>
          {t('settings.chart.chartDimensions')} & {t('settings.chart.klineSettings')}
        </Text>
        <Grid templateColumns="repeat(4, 1fr)" gap={4}>
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

          <Field label={t('settings.chart.klineSpacing')} helperText={t('settings.chart.klineSpacingHelper')}>
            <NumberInput
              value={config.klineSpacing}
              onChange={(e) => handleChange('klineSpacing', e.target.value)}
              min={2}
              max={30}
            />
          </Field>

          <Field label={t('settings.chart.wickWidth')} helperText={t('settings.chart.wickWidthHelper')}>
            <NumberInput
              value={config.klineWickWidth}
              onChange={(e) => handleChange('klineWickWidth', e.target.value)}
              min={1}
              max={10}
            />
          </Field>
        </Grid>
      </Box>

      <Box>
        <Text fontSize="md" fontWeight="medium" mb={3}>
          {t('settings.chart.gridSettings')} & {t('settings.chart.currentPriceLine')}
        </Text>
        <Grid templateColumns="repeat(4, 1fr)" gap={4}>
          <Field label={t('settings.chart.gridLineWidth')} helperText={t('settings.chart.gridLineWidthHelper')}>
            <NumberInput
              value={config.gridLineWidth}
              onChange={(e) => handleChange('gridLineWidth', e.target.value)}
              min={1}
              max={5}
            />
          </Field>

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
              usePortal={false}
            />
          </Field>
        </Grid>
      </Box>

      <Box>
        <Text fontSize="md" fontWeight="medium" mb={3}>
          {t('settings.chart.chartPadding')}
        </Text>
        <Grid templateColumns="repeat(4, 1fr)" gap={4}>
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
        </Grid>
      </Box>

      <Button
        variant="outline"
        onClick={handleReset}
      >
        <LuRefreshCw />
        {t('settings.resetToDefaults')}
      </Button>
    </Stack>
  );
};
