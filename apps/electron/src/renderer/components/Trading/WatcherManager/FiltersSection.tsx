import { Box, Collapsible, Flex, Grid, Separator, Stack, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';
import { FilterToggle } from './FilterToggle';
import type { WatcherConfig } from './types';

export interface FiltersSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  config: WatcherConfig | undefined;
  onFilterToggle: (filterKey: string, value: boolean) => void;
  isPending: boolean;
}

export const FiltersSection = ({
  isExpanded,
  onToggle,
  config,
  onFilterToggle,
  isPending,
}: FiltersSectionProps) => {
  const { t } = useTranslation();

  return (
    <Box>
      <Flex
        justify="space-between"
        align="center"
        cursor="pointer"
        onClick={onToggle}
        _hover={{ bg: 'bg.muted' }}
        p={2}
        mx={-2}
        borderRadius="md"
      >
        <Box>
          <Text fontSize="lg" fontWeight="bold">
            {t('settings.algorithmicAutoTrading.filters.title')}
          </Text>
          <Text fontSize="sm" color="fg.muted">
            {t('settings.algorithmicAutoTrading.filters.description')}
          </Text>
        </Box>
        {isExpanded ? <LuChevronUp size={20} /> : <LuChevronDown size={20} />}
      </Flex>

      <Collapsible.Root open={isExpanded}>
        <Collapsible.Content>
          <Stack gap={4} mt={4}>
            <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
              {t('settings.algorithmicAutoTrading.filters.directionFilters')}
            </Text>
            <Grid templateColumns="repeat(2, 1fr)" gap={4}>
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.mtf.title')}
                description={t('settings.algorithmicAutoTrading.filters.mtf.description')}
                checked={config?.useMtfFilter ?? true}
                onChange={(value) => onFilterToggle('useMtfFilter', value)}
                disabled={isPending}
              />
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.btcCorrelation.title')}
                description={t('settings.algorithmicAutoTrading.filters.btcCorrelation.description')}
                checked={config?.useBtcCorrelationFilter ?? true}
                onChange={(value) => onFilterToggle('useBtcCorrelationFilter', value)}
                disabled={isPending}
              />
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.marketRegime.title')}
                description={t('settings.algorithmicAutoTrading.filters.marketRegime.description')}
                checked={config?.useMarketRegimeFilter ?? true}
                onChange={(value) => onFilterToggle('useMarketRegimeFilter', value)}
                disabled={isPending}
              />
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.trend.title')}
                description={t('settings.algorithmicAutoTrading.filters.trend.description')}
                checked={config?.useTrendFilter ?? false}
                onChange={(value) => onFilterToggle('useTrendFilter', value)}
                disabled={isPending}
              />
            </Grid>

            <Separator />

            <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
              {t('settings.algorithmicAutoTrading.filters.timingFilters')}
            </Text>
            <Grid templateColumns="repeat(2, 1fr)" gap={4}>
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.momentumTiming.title')}
                description={t('settings.algorithmicAutoTrading.filters.momentumTiming.description')}
                checked={config?.useMomentumTimingFilter ?? true}
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
                label={t('settings.algorithmicAutoTrading.filters.adx.title')}
                description={t('settings.algorithmicAutoTrading.filters.adx.description')}
                checked={config?.useAdxFilter ?? false}
                onChange={(value) => onFilterToggle('useAdxFilter', value)}
                disabled={isPending}
              />
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.volume.title')}
                description={t('settings.algorithmicAutoTrading.filters.volume.description')}
                checked={config?.useVolumeFilter ?? true}
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
                checked={config?.useFundingFilter ?? true}
                onChange={(value) => onFilterToggle('useFundingFilter', value)}
                disabled={isPending}
              />
              <FilterToggle
                label={t('settings.algorithmicAutoTrading.filters.confluence.title')}
                description={t('settings.algorithmicAutoTrading.filters.confluence.description')}
                checked={config?.useConfluenceScoring ?? true}
                onChange={(value) => onFilterToggle('useConfluenceScoring', value)}
                disabled={isPending}
              />
            </Grid>
          </Stack>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
};
