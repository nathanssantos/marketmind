import { HStack, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { CollapsibleSection, Field, NumberInput, Switch } from '@renderer/components/ui';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ALL_FILTER_KEYS } from './profileEditorConstants';
import { OverrideBadge, OverrideRow, ovBool, ovNum } from './profileEditorUtils';
import type { ProfileOverrideActions } from './profileEditorUtils';

interface ProfileFiltersSectionProps {
  actions: ProfileOverrideActions;
}

export const ProfileFiltersSection = ({ actions }: ProfileFiltersSectionProps) => {
  const { t } = useTranslation();
  const { co, isActive, setOv, clearOv, tog, ovCount } = actions;

  const renderBoolFilter = useCallback((key: string, labelKey: string) => (
    <OverrideRow
      key={key}
      label={t(labelKey)}
      description={t('tradingProfiles.overrides.usingGlobalDefault')}
      isActive={isActive(key)}
      onToggle={tog(key, true)}
    >
      <Switch
        checked={ovBool(co, key)}
        onCheckedChange={(v) => setOv(key, v)}
        size="sm"
      >
        <Text fontSize="xs">{ovBool(co, key) ? t('common.enabled') : t('common.disabled')}</Text>
      </Switch>
    </OverrideRow>
  ), [t, co, isActive, tog, setOv]);

  return (
    <CollapsibleSection
      title={t('tradingProfiles.sections.filters')}
      description={t('tradingProfiles.sections.filtersDescription')}
      badge={<OverrideBadge count={ovCount(ALL_FILTER_KEYS)} />}
      size="lg"
    >
      <Stack gap={4}>
        <Text fontSize="xs" fontWeight="bold" color="fg.muted" textTransform="uppercase">
          {t('tradingProfiles.sections.filtersTrend')}
        </Text>
        {renderBoolFilter('useTrendFilter', 'settings.algorithmicAutoTrading.filters.trend.title')}
        {renderBoolFilter('useAdxFilter', 'settings.algorithmicAutoTrading.filters.adx.title')}
        {renderBoolFilter('useDirectionFilter', 'settings.algorithmicAutoTrading.filters.direction.title')}
        {renderBoolFilter('useSuperTrendFilter', 'settings.algorithmicAutoTrading.filters.supertrend.title')}

        <Text fontSize="xs" fontWeight="bold" color="fg.muted" textTransform="uppercase">
          {t('tradingProfiles.sections.filtersMomentum')}
        </Text>
        {renderBoolFilter('useStochasticFilter', 'settings.algorithmicAutoTrading.filters.stochastic.title')}
        {renderBoolFilter('useStochasticRecoveryFilter', 'settings.algorithmicAutoTrading.filters.stochasticRecovery.title')}
        {renderBoolFilter('useMomentumTimingFilter', 'settings.algorithmicAutoTrading.filters.momentumTiming.title')}
        {renderBoolFilter('useStochasticHtfFilter', 'settings.algorithmicAutoTrading.filters.stochasticHtf.title')}
        {renderBoolFilter('useStochasticRecoveryHtfFilter', 'settings.algorithmicAutoTrading.filters.stochasticRecoveryHtf.title')}

        <Text fontSize="xs" fontWeight="bold" color="fg.muted" textTransform="uppercase">
          {t('tradingProfiles.sections.filtersStructure')}
        </Text>
        <OverrideRow
          label={t('settings.algorithmicAutoTrading.filters.choppiness.title')}
          description={t('tradingProfiles.overrides.usingGlobalDefault')}
          isActive={isActive('useChoppinessFilter')}
          onToggle={tog('useChoppinessFilter', true)}
        >
          <Stack gap={2}>
            <Switch
              checked={ovBool(co, 'useChoppinessFilter')}
              onCheckedChange={(v) => setOv('useChoppinessFilter', v)}
              size="sm"
            >
              <Text fontSize="xs">{ovBool(co, 'useChoppinessFilter') ? t('common.enabled') : t('common.disabled')}</Text>
            </Switch>
            {ovBool(co, 'useChoppinessFilter') && (
              <SimpleGrid columns={2} gap={2}>
                <Field label={t('tradingProfiles.overrides.choppinessThresholdHigh')}>
                  <NumberInput
                    size="sm"
                    value={ovNum(co, 'choppinessThresholdHigh', 61.8)}
                    onChange={(e) => setOv('choppinessThresholdHigh', e.target.value ? Number(e.target.value) : 61.8)}
                    min={30}
                    max={80}
                    step={0.1}
                    px={3}
                  />
                </Field>
                <Field label={t('tradingProfiles.overrides.choppinessThresholdLow')}>
                  <NumberInput
                    size="sm"
                    value={ovNum(co, 'choppinessThresholdLow', 38.2)}
                    onChange={(e) => setOv('choppinessThresholdLow', e.target.value ? Number(e.target.value) : 38.2)}
                    min={20}
                    max={60}
                    step={0.1}
                    px={3}
                  />
                </Field>
              </SimpleGrid>
            )}
          </Stack>
        </OverrideRow>
        {renderBoolFilter('useVwapFilter', 'settings.algorithmicAutoTrading.filters.vwap.title')}
        {renderBoolFilter('useMarketRegimeFilter', 'settings.algorithmicAutoTrading.filters.marketRegime.title')}
        {renderBoolFilter('useBollingerSqueezeFilter', 'settings.algorithmicAutoTrading.filters.bollingerSqueeze.title')}
        {renderBoolFilter('useFvgFilter', 'settings.algorithmicAutoTrading.filters.fvg.title')}

        <Text fontSize="xs" fontWeight="bold" color="fg.muted" textTransform="uppercase">
          {t('tradingProfiles.sections.filtersVolume')}
        </Text>
        {renderBoolFilter('useVolumeFilter', 'settings.algorithmicAutoTrading.filters.volume.title')}
        <OverrideRow
          label={t('tradingProfiles.overrides.obvCheck')}
          description={t('tradingProfiles.overrides.usingGlobalDefault')}
          isActive={isActive('useObvCheckLong') || isActive('useObvCheckShort')}
          onToggle={(checked) => {
            if (checked) {
              setOv('useObvCheckLong', true);
              setOv('useObvCheckShort', true);
            } else {
              clearOv('useObvCheckLong');
              clearOv('useObvCheckShort');
            }
          }}
        >
          <Stack gap={2}>
            <HStack gap={4}>
              <Switch
                checked={ovBool(co, 'useObvCheckLong')}
                onCheckedChange={(v) => setOv('useObvCheckLong', v)}
                size="sm"
              >
                <Text fontSize="xs">Long</Text>
              </Switch>
              <Switch
                checked={ovBool(co, 'useObvCheckShort')}
                onCheckedChange={(v) => setOv('useObvCheckShort', v)}
                size="sm"
              >
                <Text fontSize="xs">Short</Text>
              </Switch>
            </HStack>
            <SimpleGrid columns={2} gap={2}>
              <Field label={t('tradingProfiles.overrides.obvLookbackLong')}>
                <NumberInput
                  size="sm"
                  value={(co['volumeFilterObvLookbackLong'] as number) ?? ''}
                  onChange={(e) => {
                    if (e.target.value) setOv('volumeFilterObvLookbackLong', Number(e.target.value));
                    else clearOv('volumeFilterObvLookbackLong');
                  }}
                  min={5}
                  max={200}
                  px={3}
                />
              </Field>
              <Field label={t('tradingProfiles.overrides.obvLookbackShort')}>
                <NumberInput
                  size="sm"
                  value={(co['volumeFilterObvLookbackShort'] as number) ?? ''}
                  onChange={(e) => {
                    if (e.target.value) setOv('volumeFilterObvLookbackShort', Number(e.target.value));
                    else clearOv('volumeFilterObvLookbackShort');
                  }}
                  min={5}
                  max={200}
                  px={3}
                />
              </Field>
            </SimpleGrid>
          </Stack>
        </OverrideRow>

        <Text fontSize="xs" fontWeight="bold" color="fg.muted" textTransform="uppercase">
          {t('tradingProfiles.sections.filtersCorrelation')}
        </Text>
        {renderBoolFilter('useBtcCorrelationFilter', 'settings.algorithmicAutoTrading.filters.btcCorrelation.title')}
        {renderBoolFilter('useFundingFilter', 'settings.algorithmicAutoTrading.filters.funding.title')}
        {renderBoolFilter('useMtfFilter', 'settings.algorithmicAutoTrading.filters.mtf.title')}

        <Text fontSize="xs" fontWeight="bold" color="fg.muted" textTransform="uppercase">
          {t('tradingProfiles.sections.filtersScoring')}
        </Text>
        <OverrideRow
          label={t('settings.algorithmicAutoTrading.filters.confluence.title')}
          description={t('tradingProfiles.overrides.usingGlobalDefault')}
          isActive={isActive('useConfluenceScoring')}
          onToggle={tog('useConfluenceScoring', true)}
        >
          <Stack gap={2}>
            <Switch
              checked={ovBool(co, 'useConfluenceScoring')}
              onCheckedChange={(v) => setOv('useConfluenceScoring', v)}
              size="sm"
            >
              <Text fontSize="xs">{ovBool(co, 'useConfluenceScoring') ? t('common.enabled') : t('common.disabled')}</Text>
            </Switch>
            {ovBool(co, 'useConfluenceScoring') && (
              <Field label={t('settings.algorithmicAutoTrading.filters.confluence.minScore')}>
                <NumberInput
                  size="sm"
                  value={ovNum(co, 'confluenceMinScore', 50)}
                  onChange={(e) => setOv('confluenceMinScore', e.target.value ? Number(e.target.value) : 50)}
                  min={0}
                  max={100}
                  px={3}
                />
              </Field>
            )}
          </Stack>
        </OverrideRow>
        <OverrideRow
          label={t('tradingProfiles.overrides.cooldown')}
          description={t('tradingProfiles.overrides.usingGlobalDefault')}
          isActive={isActive('useCooldown')}
          onToggle={tog('useCooldown', true)}
        >
          <Stack gap={2}>
            <Switch
              checked={ovBool(co, 'useCooldown')}
              onCheckedChange={(v) => setOv('useCooldown', v)}
              size="sm"
            >
              <Text fontSize="xs">{ovBool(co, 'useCooldown') ? t('common.enabled') : t('common.disabled')}</Text>
            </Switch>
            {ovBool(co, 'useCooldown') && (
              <Field label={t('tradingProfiles.overrides.cooldownMinutes')}>
                <NumberInput
                  size="sm"
                  value={ovNum(co, 'cooldownMinutes', 60)}
                  onChange={(e) => setOv('cooldownMinutes', e.target.value ? Number(e.target.value) : 60)}
                  min={1}
                  max={1440}
                  px={3}
                />
              </Field>
            )}
          </Stack>
        </OverrideRow>
      </Stack>
    </CollapsibleSection>
  );
};
