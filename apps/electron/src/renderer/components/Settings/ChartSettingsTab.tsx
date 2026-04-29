import {
  Button,
  Checkbox,
  Field,
  FormSection,
  NumberInput,
  Select,
  Switch,
  useColorMode,
} from '@renderer/components/ui';
import { DEFAULT_ADVANCED_CONFIG } from '@/renderer/constants/defaults';
import { PALETTE_IDS, getPalette } from '@/renderer/constants/chartPalettes';
import { useDebounceCallback } from '@/renderer/hooks/useDebounceCallback';
import { useChartPref } from '@/renderer/store/preferencesStore';
import { useUIStore } from '@/renderer/store/uiStore';
import { Box, Flex, Grid, HStack, Stack, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuRefreshCw } from 'react-icons/lu';
import type { AdvancedControlsConfig } from '../Chart/AdvancedControls';

interface ChartSettingsTabProps {
  config: AdvancedControlsConfig;
  onConfigChange: (config: AdvancedControlsConfig) => void;
}

export const ChartSettingsTab = ({ config, onConfigChange }: ChartSettingsTabProps) => {
  const { t } = useTranslation();
  const { colorMode } = useColorMode();
  const [chartType, setChartType] = useChartPref<'kline' | 'line'>('chartType', 'kline');
  const [colorPalette, setColorPalette] = useChartPref<string>('chartColorPalette', 'default');
  const [showGrid, setShowGrid] = useChartPref('showGrid', true);
  const [showCurrentPriceLine, setShowCurrentPriceLine] = useChartPref('showCurrentPriceLine', true);
  const [showCrosshair, setShowCrosshair] = useChartPref('showCrosshair', true);
  const [chartFlipped, setChartFlipped] = useChartPref<boolean>('chartFlipped', false);
  const [liquidityColorMode, setLiquidityColorMode] = useChartPref<'colored' | 'intensity'>('liquidityColorMode', 'colored');
  const enableShiftAltOrderEntry = useUIStore((state) => state.enableShiftAltOrderEntry);
  const setEnableShiftAltOrderEntry = useUIStore((state) => state.setEnableShiftAltOrderEntry);

  const debouncedConfigChange = useDebounceCallback(onConfigChange, 300);

  const handleChange = (key: keyof AdvancedControlsConfig, value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;
    debouncedConfigChange({ ...config, [key]: numValue });
  };

  const handleStyleChange = (value: string) => {
    onConfigChange({ ...config, currentPriceLineStyle: value as 'solid' | 'dashed' | 'dotted' });
  };

  const handleReset = () => onConfigChange(DEFAULT_ADVANCED_CONFIG);

  return (
    <Stack gap={5}>
      <FormSection
        title={t('settings.chart.chartType')}
        description={t('settings.chart.defaultChartTypeHelper')}
      >
        <Field label={t('settings.chart.defaultChartType')}>
          <Select
            value={chartType}
            onChange={(value) => setChartType(value as 'kline' | 'line')}
            options={[
              { value: 'kline', label: t('chart.controls.klineChart') },
              { value: 'line', label: t('chart.controls.lineChart') },
            ]}
            size="sm"
            usePortal={false}
          />
        </Field>
      </FormSection>

      <FormSection title={t('settings.chart.displayOptions')}>
        <Stack gap={2}>
          <Switch checked={showGrid} onCheckedChange={setShowGrid} size="sm" data-testid="chart-show-grid">
            {t('chart.controls.grid')}
          </Switch>
          <Switch checked={showCurrentPriceLine} onCheckedChange={setShowCurrentPriceLine} size="sm" data-testid="chart-show-current-price">
            {t('chart.controls.currentPrice')}
          </Switch>
          <Switch checked={showCrosshair} onCheckedChange={setShowCrosshair} size="sm" data-testid="chart-show-crosshair">
            {t('chart.controls.crosshair')}
          </Switch>
          <Switch checked={chartFlipped} onCheckedChange={setChartFlipped} size="sm" data-testid="chart-flipped">
            {t('chart.controls.flipVertical')}
          </Switch>
          <Text fontSize="2xs" color="fg.muted" ml={6} mt={-1}>
            {t('chart.controls.flipVerticalHelper')}
          </Text>
          <Switch
            checked={liquidityColorMode === 'intensity'}
            onCheckedChange={(checked) => setLiquidityColorMode(checked ? 'intensity' : 'colored')}
            size="sm"
            data-testid="chart-liquidity-intensity"
          >
            {t('settings.chart.liquidityIntensity')}
          </Switch>
          <Text fontSize="2xs" color="fg.muted" ml={6} mt={-1}>
            {t('settings.chart.liquidityIntensityHelper')}
          </Text>
        </Stack>
      </FormSection>

      <FormSection title={t('settings.chart.colorPalette')}>
        <Grid templateColumns="repeat(5, 1fr)" gap={2}>
          {PALETTE_IDS.map((id) => {
            const palette = getPalette(id, colorMode);
            const isSelected = colorPalette === id;
            return (
              <Box
                key={id}
                cursor="pointer"
                borderWidth={2}
                borderColor={isSelected ? 'accent.solid' : 'transparent'}
                borderRadius="md"
                p={1.5}
                bg={palette.background}
                onClick={() => setColorPalette(id)}
                transition="border-color 0.15s"
                _hover={{ borderColor: isSelected ? 'blue.400' : 'gray.500' }}
                data-testid={`chart-palette-${id}`}
              >
                <Flex gap={1} mb={1} justify="center">
                  <Box w="12px" h="22px" bg={palette.bullish} borderRadius="sm" />
                  <Box w="12px" h="22px" bg={palette.bearish} borderRadius="sm" />
                  <Box w="12px" h="22px" bg={palette.bullish} borderRadius="sm" />
                  <Box w="12px" h="22px" bg={palette.bearish} borderRadius="sm" />
                </Flex>
                <HStack gap={0} justify="center">
                  {[0, 1, 2].map((i) => (
                    <Box key={i} flex={1} h="1px" bg={palette.grid} />
                  ))}
                </HStack>
                <Text fontSize="2xs" textAlign="center" mt={1} color={colorMode === 'dark' ? 'gray.300' : 'gray.600'}>
                  {palette.name}
                </Text>
              </Box>
            );
          })}
        </Grid>
      </FormSection>

      <FormSection title={t('settings.chart.chartDimensions')}>
        <Grid templateColumns="repeat(2, 1fr)" gap={3}>
          <Field label={t('settings.chart.rightMargin')} helperText={t('settings.chart.rightMarginHelper')}>
            <NumberInput value={config.rightMargin} onChange={(e) => handleChange('rightMargin', e.target.value)} min={0} max={500} size="sm" />
          </Field>
          <Field label={t('settings.chart.volumeHeightRatio')} helperText={t('settings.chart.volumeHeightRatioHelper')}>
            <NumberInput value={config.volumeHeightRatio} onChange={(e) => handleChange('volumeHeightRatio', e.target.value)} min={0} max={1} step={0.05} size="sm" />
          </Field>
          <Field label={t('settings.chart.klineSpacing')} helperText={t('settings.chart.klineSpacingHelper')}>
            <NumberInput value={config.klineSpacing} onChange={(e) => handleChange('klineSpacing', e.target.value)} min={2} max={30} size="sm" />
          </Field>
          <Field label={t('settings.chart.wickWidth')} helperText={t('settings.chart.wickWidthHelper')}>
            <NumberInput value={config.klineWickWidth} onChange={(e) => handleChange('klineWickWidth', e.target.value)} min={1} max={10} size="sm" />
          </Field>
        </Grid>
      </FormSection>

      <FormSection title={t('settings.chart.gridSettings')}>
        <Grid templateColumns="repeat(2, 1fr)" gap={3}>
          <Field label={t('settings.chart.gridLineWidth')} helperText={t('settings.chart.gridLineWidthHelper')}>
            <NumberInput value={config.gridLineWidth} onChange={(e) => handleChange('gridLineWidth', e.target.value)} min={1} max={5} size="sm" />
          </Field>
          <Field label={t('settings.chart.lineWidth')} helperText={t('settings.chart.lineWidthHelper')}>
            <NumberInput value={config.currentPriceLineWidth} onChange={(e) => handleChange('currentPriceLineWidth', e.target.value)} min={1} max={5} size="sm" />
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
              size="sm"
              usePortal={false}
            />
          </Field>
        </Grid>
      </FormSection>

      <FormSection title={t('settings.chart.chartPadding')}>
        <Grid templateColumns="repeat(4, 1fr)" gap={3}>
          <Field label={t('settings.chart.topPadding')}>
            <NumberInput value={config.paddingTop} onChange={(e) => handleChange('paddingTop', e.target.value)} min={0} max={100} size="sm" />
          </Field>
          <Field label={t('settings.chart.bottomPadding')}>
            <NumberInput value={config.paddingBottom} onChange={(e) => handleChange('paddingBottom', e.target.value)} min={0} max={100} size="sm" />
          </Field>
          <Field label={t('settings.chart.leftPadding')}>
            <NumberInput value={config.paddingLeft} onChange={(e) => handleChange('paddingLeft', e.target.value)} min={0} max={100} size="sm" />
          </Field>
          <Field label={t('settings.chart.rightPadding')}>
            <NumberInput value={config.paddingRight} onChange={(e) => handleChange('paddingRight', e.target.value)} min={0} max={100} size="sm" />
          </Field>
        </Grid>
      </FormSection>

      <FormSection title={t('settings.chart.trading')}>
        <Box>
          <Checkbox checked={enableShiftAltOrderEntry} onCheckedChange={setEnableShiftAltOrderEntry}>
            {t('settings.chart.enableShiftAltOrderEntry')}
          </Checkbox>
          <Text fontSize="2xs" color="fg.muted" mt={1} ml={6}>
            {t('settings.chart.enableShiftAltOrderEntryHelper')}
          </Text>
        </Box>
      </FormSection>

      <Box>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <LuRefreshCw />
          {t('settings.resetToDefaults')}
        </Button>
      </Box>
    </Stack>
  );
};
