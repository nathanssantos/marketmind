import { Slider } from '@/renderer/components/ui/slider';
import { Box, Grid, HStack, Separator, Stack, Text } from '@chakra-ui/react';
import { Button } from '@renderer/components/ui/button';
import { CollapsibleSection } from '@renderer/components/ui/CollapsibleSection';
import { useTranslation } from 'react-i18next';
import { LuArrowUpDown, LuTrendingDown, LuTrendingUp } from 'react-icons/lu';
import { FilterToggle } from './FilterToggle';
import type { WatcherConfig } from './types';
import type { DirectionMode } from './WatchersList';

export interface FiltersSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  config: WatcherConfig | undefined;
  onFilterToggle: (filterKey: string, value: boolean) => void;
  isPending: boolean;
  isIB?: boolean;
  directionMode: DirectionMode;
  onDirectionModeChange: (mode: DirectionMode) => void;
  confluenceMinScore: number;
  onConfluenceMinScoreChange: (value: number) => void;
}

export const FiltersSection = ({
  isExpanded,
  onToggle,
  config,
  onFilterToggle,
  isPending,
  isIB = false,
  directionMode,
  onDirectionModeChange,
  confluenceMinScore,
  onConfluenceMinScoreChange,
}: FiltersSectionProps) => {
  const { t } = useTranslation();

  return (
    <CollapsibleSection
      title={t('settings.algorithmicAutoTrading.filters.title')}
      description={t('settings.algorithmicAutoTrading.filters.description')}
      open={isExpanded}
      onOpenChange={onToggle}
      size="lg"
    >
          <Stack gap={4}>
            <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
              {t('settings.algorithmicAutoTrading.filters.directionFilters')}
            </Text>

            <Box>
              <Text fontSize="xs" fontWeight="medium" mb={2}>
                {t('settings.algorithmicAutoTrading.directionMode.title')}
              </Text>
              <HStack gap={1}>
                <Button
                  size="xs"
                  variant={directionMode === 'short_only' ? 'solid' : 'outline'}
                  colorPalette={directionMode === 'short_only' ? 'red' : 'gray'}
                  onClick={() => onDirectionModeChange(directionMode === 'short_only' ? 'auto' : 'short_only')}
                  disabled={isPending}
                  flex={1}
                >
                  <LuTrendingDown />
                  {t('settings.algorithmicAutoTrading.directionMode.shortOnly')}
                </Button>
                <Button
                  size="xs"
                  variant={directionMode === 'auto' ? 'solid' : 'outline'}
                  colorPalette={directionMode === 'auto' ? 'gray' : 'gray'}
                  onClick={() => onDirectionModeChange('auto')}
                  disabled={isPending}
                  flex={1}
                >
                  <LuArrowUpDown />
                  {t('settings.algorithmicAutoTrading.directionMode.auto')}
                </Button>
                <Button
                  size="xs"
                  variant={directionMode === 'long_only' ? 'solid' : 'outline'}
                  colorPalette={directionMode === 'long_only' ? 'green' : 'gray'}
                  onClick={() => onDirectionModeChange(directionMode === 'long_only' ? 'auto' : 'long_only')}
                  disabled={isPending}
                  flex={1}
                >
                  <LuTrendingUp />
                  {t('settings.algorithmicAutoTrading.directionMode.longOnly')}
                </Button>
              </HStack>
              <Text fontSize="xs" color="fg.muted" mt={1}>
                {t('settings.algorithmicAutoTrading.directionMode.description')}
              </Text>
            </Box>

            <Grid templateColumns="repeat(2, 1fr)" gap={4}>
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.mtf.title')}
                description={t('settings.algorithmicAutoTrading.filters.mtf.description')}
                checked={config?.useMtfFilter ?? false}
                onChange={(value) => onFilterToggle('useMtfFilter', value)}
                disabled={isPending}
              />
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.btcCorrelation.title')}
                description={t('settings.algorithmicAutoTrading.filters.btcCorrelation.description')}
                checked={config?.useBtcCorrelationFilter ?? false}
                onChange={(value) => onFilterToggle('useBtcCorrelationFilter', value)}
                disabled={isPending}
                tag={t('common.cryptoOnly')}
                tagColorPalette="orange"
                forceDisabled={isIB}
              />
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.marketRegime.title')}
                description={t('settings.algorithmicAutoTrading.filters.marketRegime.description')}
                checked={config?.useMarketRegimeFilter ?? false}
                onChange={(value) => onFilterToggle('useMarketRegimeFilter', value)}
                disabled={isPending}
              />
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.trend.title')}
                description={t('settings.algorithmicAutoTrading.filters.trend.description')}
                checked={config?.useTrendFilter ?? true}
                onChange={(value) => onFilterToggle('useTrendFilter', value)}
                disabled={isPending}
              />
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.direction.title')}
                description={t('settings.algorithmicAutoTrading.filters.direction.description')}
                checked={config?.useDirectionFilter ?? false}
                onChange={(value) => onFilterToggle('useDirectionFilter', value)}
                disabled={isPending}
              />
              {config?.useDirectionFilter && (
                <Box gridColumn="span 2" pl={4} borderLeftWidth="2px" borderLeftColor="green.500">
                  <Grid templateColumns="repeat(2, 1fr)" gap={3}>
                    <FilterToggle
                      label={t('settings.algorithmicAutoTrading.filters.direction.enableLongInBear')}
                      description={t('settings.algorithmicAutoTrading.filters.direction.enableLongInBearDescription')}
                      checked={config?.enableLongInBearMarket ?? false}
                      onChange={(v) => onFilterToggle('enableLongInBearMarket', v)}
                      disabled={isPending}
                    />
                    <FilterToggle
                      label={t('settings.algorithmicAutoTrading.filters.direction.enableShortInBull')}
                      description={t('settings.algorithmicAutoTrading.filters.direction.enableShortInBullDescription')}
                      checked={config?.enableShortInBullMarket ?? false}
                      onChange={(v) => onFilterToggle('enableShortInBullMarket', v)}
                      disabled={isPending}
                    />
                  </Grid>
                </Box>
              )}
            </Grid>

            <Separator />

            <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
              {t('settings.algorithmicAutoTrading.filters.timingFilters')}
            </Text>
            <Grid templateColumns="repeat(2, 1fr)" gap={4}>
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.momentumTiming.title')}
                description={t('settings.algorithmicAutoTrading.filters.momentumTiming.description')}
                checked={config?.useMomentumTimingFilter ?? false}
                onChange={(value) => onFilterToggle('useMomentumTimingFilter', value)}
                disabled={isPending}
              />
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.stochastic.title')}
                description={t('settings.algorithmicAutoTrading.filters.stochastic.description')}
                checked={config?.useStochasticFilter ?? false}
                onChange={(value) => onFilterToggle('useStochasticFilter', value)}
                disabled={isPending}
              />
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.stochasticRecovery.title')}
                description={t('settings.algorithmicAutoTrading.filters.stochasticRecovery.description')}
                checked={config?.useStochasticRecoveryFilter ?? false}
                onChange={(value) => onFilterToggle('useStochasticRecoveryFilter', value)}
                disabled={isPending}
              />
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.stochasticHtf.title')}
                description={t('settings.algorithmicAutoTrading.filters.stochasticHtf.description')}
                checked={config?.useStochasticHtfFilter ?? false}
                onChange={(value) => onFilterToggle('useStochasticHtfFilter', value)}
                disabled={isPending}
              />
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.stochasticRecoveryHtf.title')}
                description={t('settings.algorithmicAutoTrading.filters.stochasticRecoveryHtf.description')}
                checked={config?.useStochasticRecoveryHtfFilter ?? false}
                onChange={(value) => onFilterToggle('useStochasticRecoveryHtfFilter', value)}
                disabled={isPending}
              />
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.adx.title')}
                description={t('settings.algorithmicAutoTrading.filters.adx.description')}
                checked={config?.useAdxFilter ?? true}
                onChange={(value) => onFilterToggle('useAdxFilter', value)}
                disabled={isPending}
              />
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.volume.title')}
                description={t('settings.algorithmicAutoTrading.filters.volume.description')}
                checked={config?.useVolumeFilter ?? false}
                onChange={(value) => onFilterToggle('useVolumeFilter', value)}
                disabled={isPending}
              />
            </Grid>

            <Separator />

            <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
              {t('settings.algorithmicAutoTrading.filters.marketFilters')}
            </Text>
            <Grid templateColumns="repeat(2, 1fr)" gap={4}>
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.funding.title')}
                description={t('settings.algorithmicAutoTrading.filters.funding.description')}
                checked={config?.useFundingFilter ?? false}
                onChange={(value) => onFilterToggle('useFundingFilter', value)}
                disabled={isPending}
                tag={t('common.futuresOnly')}
                tagColorPalette="purple"
                forceDisabled={isIB}
              />
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.confluence.title')}
                description={t('settings.algorithmicAutoTrading.filters.confluence.description')}
                checked={config?.useConfluenceScoring ?? false}
                onChange={(value) => onFilterToggle('useConfluenceScoring', value)}
                disabled={isPending}
              />
              {config?.useConfluenceScoring && (
                <Box gridColumn="span 2" pl={4} borderLeftWidth="2px" borderLeftColor="blue.500">
                  <Text fontSize="sm" fontWeight="medium" mb={1}>
                    {t('settings.algorithmicAutoTrading.filters.confluence.minScore')}
                  </Text>
                  <Text fontSize="xs" color="fg.muted" mb={2}>
                    {t('settings.algorithmicAutoTrading.filters.confluence.minScoreDescription')}
                  </Text>
                  <HStack gap={4}>
                    <Slider
                      value={[confluenceMinScore]}
                      onValueChange={(values) => onConfluenceMinScoreChange(values[0] ?? 60)}
                      min={0}
                      max={100}
                      step={5}
                      width="full"
                    />
                    <Text fontSize="sm" fontWeight="medium" minW="40px" textAlign="right">
                      {confluenceMinScore}
                    </Text>
                  </HStack>
                </Box>
              )}
            </Grid>

            <Separator />

            <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
              {t('settings.algorithmicAutoTrading.filters.volatilityFilters')}
            </Text>
            <Grid templateColumns="repeat(2, 1fr)" gap={4}>
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.choppiness.title')}
                description={t('settings.algorithmicAutoTrading.filters.choppiness.description')}
                checked={config?.useChoppinessFilter ?? false}
                onChange={(value) => onFilterToggle('useChoppinessFilter', value)}
                disabled={isPending}
              />
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.session.title')}
                description={t('settings.algorithmicAutoTrading.filters.session.description')}
                checked={config?.useSessionFilter ?? false}
                onChange={(value) => onFilterToggle('useSessionFilter', value)}
                disabled={isPending}
              />
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.bollingerSqueeze.title')}
                description={t('settings.algorithmicAutoTrading.filters.bollingerSqueeze.description')}
                checked={config?.useBollingerSqueezeFilter ?? false}
                onChange={(value) => onFilterToggle('useBollingerSqueezeFilter', value)}
                disabled={isPending}
              />
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.vwap.title')}
                description={t('settings.algorithmicAutoTrading.filters.vwap.description')}
                checked={config?.useVwapFilter ?? false}
                onChange={(value) => onFilterToggle('useVwapFilter', value)}
                disabled={isPending}
              />
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.supertrend.title')}
                description={t('settings.algorithmicAutoTrading.filters.supertrend.description')}
                checked={config?.useSuperTrendFilter ?? false}
                onChange={(value) => onFilterToggle('useSuperTrendFilter', value)}
                disabled={isPending}
              />
            </Grid>

            <Separator />

            <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
              {t('settings.algorithmicAutoTrading.filters.smartMoneyFilters')}
            </Text>
            <Grid templateColumns="repeat(2, 1fr)" gap={4}>
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.fvg.title')}
                description={t('settings.algorithmicAutoTrading.filters.fvg.description')}
                checked={config?.useFvgFilter ?? false}
                onChange={(value) => onFilterToggle('useFvgFilter', value)}
                disabled={isPending}
              />
            </Grid>
          </Stack>
    </CollapsibleSection>
  );
};
