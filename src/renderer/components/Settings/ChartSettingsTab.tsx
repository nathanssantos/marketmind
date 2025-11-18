import { Button } from '@/renderer/components/ui/button';
import { Field } from '@/renderer/components/ui/field';
import { NumberInput } from '@/renderer/components/ui/number-input';
import { Select } from '@/renderer/components/ui/select';
import { DEFAULT_ADVANCED_CONFIG } from '@/renderer/constants/defaults';
import { useDebounceCallback } from '@/renderer/hooks/useDebounceCallback';
import { Box, Separator, Stack, Text } from '@chakra-ui/react';
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
      <Box
        bg="blue.500/10"
        p={4}
        borderRadius="md"
        borderLeft="4px solid"
        borderColor="blue.500"
      >
        <Text fontSize="sm" fontWeight="semibold" mb={2}>
          💡 {t('common.tips')}
        </Text>
        <Stack gap={1} fontSize="sm" color="fg.muted">
          <Text>• {t('settings.chart.tipsRealtime')}</Text>
          <Text>• {t('settings.chart.tipsReset')}</Text>
        </Stack>
      </Box>

      <Box>
        <Button
          variant="outline"
          onClick={handleReset}
          width="full"
          colorPalette="red"
        >
          <LuRefreshCw />
          {t('settings.resetToDefaults')}
        </Button>
      </Box>

      <Separator />

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
