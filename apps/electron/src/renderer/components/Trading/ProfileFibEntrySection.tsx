import { Stack, Text } from '@chakra-ui/react';
import { CollapsibleSection, NumberInput, Select, Slider } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';
import { FIB_ENTRY_KEYS, FIB_LEVEL_OPTIONS, RR_KEYS, STOP_MODE_OPTIONS, SWING_RANGE_OPTIONS, TP_MODE_OPTIONS } from './profileEditorConstants';
import { OverrideBadge, OverrideRow, ovNum, ovStr } from './profileEditorUtils';
import type { ProfileOverrideActions } from './profileEditorUtils';

interface ProfileFibEntrySectionProps {
  actions: ProfileOverrideActions;
}

export const ProfileFibEntrySection = ({ actions }: ProfileFibEntrySectionProps) => {
  const { t } = useTranslation();
  const { co, isActive, setOv, tog, ovCount } = actions;

  return (
    <>
      <CollapsibleSection
        title={t('tradingProfiles.sections.fibEntry')}
        description={t('tradingProfiles.sections.fibEntryDescription')}
        badge={<OverrideBadge count={ovCount(FIB_ENTRY_KEYS)} />}
        size="lg"
      variant="static"
      >
        <Stack gap={4}>
          <OverrideRow
            label={t('tradingProfiles.overrides.fibTargetLevelLong')}
            description={t('tradingProfiles.overrides.usingGlobalDefault')}
            isActive={isActive('fibonacciTargetLevelLong')}
            onToggle={tog('fibonacciTargetLevelLong', 'auto')}
          >
            <Select
              value={ovStr(co, 'fibonacciTargetLevelLong', 'auto')}
              options={FIB_LEVEL_OPTIONS}
              onChange={(v) => setOv('fibonacciTargetLevelLong', v)}
              size="sm"
            />
          </OverrideRow>
          <OverrideRow
            label={t('tradingProfiles.overrides.fibTargetLevelShort')}
            description={t('tradingProfiles.overrides.usingGlobalDefault')}
            isActive={isActive('fibonacciTargetLevelShort')}
            onToggle={tog('fibonacciTargetLevelShort', 'auto')}
          >
            <Select
              value={ovStr(co, 'fibonacciTargetLevelShort', 'auto')}
              options={FIB_LEVEL_OPTIONS}
              onChange={(v) => setOv('fibonacciTargetLevelShort', v)}
              size="sm"
            />
          </OverrideRow>
          <OverrideRow
            label={t('tradingProfiles.overrides.fibSwingRange')}
            description={t('tradingProfiles.overrides.usingGlobalDefault')}
            isActive={isActive('fibonacciSwingRange')}
            onToggle={tog('fibonacciSwingRange', 'nearest')}
          >
            <Select
              value={ovStr(co, 'fibonacciSwingRange', 'nearest')}
              options={SWING_RANGE_OPTIONS}
              onChange={(v) => setOv('fibonacciSwingRange', v)}
              size="sm"
            />
          </OverrideRow>
          <OverrideRow
            label={t('tradingProfiles.overrides.entryProgressLong')}
            description={t('tradingProfiles.overrides.usingGlobalDefault')}
            isActive={isActive('maxFibonacciEntryProgressPercentLong')}
            onToggle={tog('maxFibonacciEntryProgressPercentLong', 100)}
          >
            <Stack gap={1}>
              <Slider
                value={[ovNum(co, 'maxFibonacciEntryProgressPercentLong', 100)]}
                onValueChange={(v) => setOv('maxFibonacciEntryProgressPercentLong', v[0])}
                min={0}
                max={200}
                step={0.1}
              />
              <Text fontSize="xs" color="fg.muted" textAlign="right">
                {ovNum(co, 'maxFibonacciEntryProgressPercentLong', 100)}%
              </Text>
            </Stack>
          </OverrideRow>
          <OverrideRow
            label={t('tradingProfiles.overrides.entryProgressShort')}
            description={t('tradingProfiles.overrides.usingGlobalDefault')}
            isActive={isActive('maxFibonacciEntryProgressPercentShort')}
            onToggle={tog('maxFibonacciEntryProgressPercentShort', 100)}
          >
            <Stack gap={1}>
              <Slider
                value={[ovNum(co, 'maxFibonacciEntryProgressPercentShort', 100)]}
                onValueChange={(v) => setOv('maxFibonacciEntryProgressPercentShort', v[0])}
                min={0}
                max={200}
                step={0.1}
              />
              <Text fontSize="xs" color="fg.muted" textAlign="right">
                {ovNum(co, 'maxFibonacciEntryProgressPercentShort', 100)}%
              </Text>
            </Stack>
          </OverrideRow>
          <OverrideRow
            label={t('tradingProfiles.overrides.initialStopMode')}
            description={t('tradingProfiles.overrides.usingGlobalDefault')}
            isActive={isActive('initialStopMode')}
            onToggle={tog('initialStopMode', 'fibo_target')}
          >
            <Select
              value={ovStr(co, 'initialStopMode', 'fibo_target')}
              options={STOP_MODE_OPTIONS}
              onChange={(v) => setOv('initialStopMode', v)}
              size="sm"
            />
          </OverrideRow>
          <OverrideRow
            label={t('tradingProfiles.overrides.tpCalculationMode')}
            description={t('tradingProfiles.overrides.usingGlobalDefault')}
            isActive={isActive('tpCalculationMode')}
            onToggle={tog('tpCalculationMode', 'default')}
          >
            <Select
              value={ovStr(co, 'tpCalculationMode', 'default')}
              options={TP_MODE_OPTIONS}
              onChange={(v) => setOv('tpCalculationMode', v)}
              size="sm"
            />
          </OverrideRow>
        </Stack>
      </CollapsibleSection>

      <CollapsibleSection
        title={t('tradingProfiles.sections.minRR')}
        description={t('tradingProfiles.sections.minRRDescription')}
        badge={<OverrideBadge count={ovCount(RR_KEYS)} />}
        size="lg"
      variant="static"
      >
        <Stack gap={4}>
          <OverrideRow
            label={t('settings.algorithmicAutoTrading.entrySettings.minRR.longTitle')}
            description={t('tradingProfiles.overrides.usingGlobalDefault')}
            isActive={isActive('minRiskRewardRatioLong')}
            onToggle={tog('minRiskRewardRatioLong', 1)}
          >
            <NumberInput
              size="sm"
              value={ovNum(co, 'minRiskRewardRatioLong', 1)}
              onChange={(e) => setOv('minRiskRewardRatioLong', e.target.value ? Number(e.target.value) : 1)}
              min={0}
              max={10}
              step={0.1}
              px={3}
            />
          </OverrideRow>
          <OverrideRow
            label={t('settings.algorithmicAutoTrading.entrySettings.minRR.shortTitle')}
            description={t('tradingProfiles.overrides.usingGlobalDefault')}
            isActive={isActive('minRiskRewardRatioShort')}
            onToggle={tog('minRiskRewardRatioShort', 0.75)}
          >
            <NumberInput
              size="sm"
              value={ovNum(co, 'minRiskRewardRatioShort', 0.75)}
              onChange={(e) => setOv('minRiskRewardRatioShort', e.target.value ? Number(e.target.value) : 0.75)}
              min={0}
              max={10}
              step={0.1}
              px={3}
            />
          </OverrideRow>
        </Stack>
      </CollapsibleSection>
    </>
  );
};
