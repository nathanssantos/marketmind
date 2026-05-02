import { Stack, Text } from '@chakra-ui/react';
import { CollapsibleSection, Select, Slider, Switch } from '@renderer/components/ui';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ACTIVATION_MODE_OPTIONS, TRAILING_DISTANCE_MODE_OPTIONS, TRAILING_KEYS, TRAILING_MODE_OPTIONS } from './profileEditorConstants';
import { OverrideBadge, OverrideRow, ovBool, ovNum, ovStr } from './profileEditorUtils';
import type { ProfileOverrideActions } from './profileEditorUtils';

interface ProfileTrailingStopSectionProps {
  actions: ProfileOverrideActions;
}

export const ProfileTrailingStopSection = ({ actions }: ProfileTrailingStopSectionProps) => {
  const { t } = useTranslation();
  const { co, isActive, setOv, tog, ovCount } = actions;

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
      title={t('tradingProfiles.sections.trailingStop')}
      description={t('tradingProfiles.sections.trailingStopDescription')}
      badge={<OverrideBadge count={ovCount(TRAILING_KEYS)} />}
      size="lg"
      variant="static"
    >
      <Stack gap={4}>
        <OverrideRow
          label={t('watcherManager.trailingStop.enabled')}
          description={t('tradingProfiles.overrides.usingGlobalDefault')}
          isActive={isActive('trailingStopEnabled')}
          onToggle={tog('trailingStopEnabled', true)}
        >
          <Switch
            checked={ovBool(co, 'trailingStopEnabled')}
            onCheckedChange={(v) => setOv('trailingStopEnabled', v)}
            size="sm"
          >
            <Text fontSize="xs">{ovBool(co, 'trailingStopEnabled') ? t('common.enabled') : t('common.disabled')}</Text>
          </Switch>
        </OverrideRow>
        <OverrideRow
          label={t('tradingProfiles.overrides.trailingStopMode')}
          description={t('tradingProfiles.overrides.usingGlobalDefault')}
          isActive={isActive('trailingStopMode')}
          onToggle={tog('trailingStopMode', 'local')}
        >
          <Select
            value={ovStr(co, 'trailingStopMode', 'local')}
            options={TRAILING_MODE_OPTIONS}
            onChange={(v) => setOv('trailingStopMode', v)}
            size="sm"
            usePortal={false}
          />
        </OverrideRow>
        <OverrideRow
          label={t('watcherManager.trailingStop.activationLong')}
          description={t('tradingProfiles.overrides.usingGlobalDefault')}
          isActive={isActive('trailingActivationPercentLong')}
          onToggle={tog('trailingActivationPercentLong', 50)}
        >
          <Stack gap={1}>
            <Slider
              value={[ovNum(co, 'trailingActivationPercentLong', 50)]}
              onValueChange={(v) => setOv('trailingActivationPercentLong', v[0])}
              min={5}
              max={100}
              step={0.1}
            />
            <Text fontSize="xs" color="fg.muted" textAlign="right">
              {ovNum(co, 'trailingActivationPercentLong', 50)}%
            </Text>
          </Stack>
        </OverrideRow>
        <OverrideRow
          label={t('watcherManager.trailingStop.activationShort')}
          description={t('tradingProfiles.overrides.usingGlobalDefault')}
          isActive={isActive('trailingActivationPercentShort')}
          onToggle={tog('trailingActivationPercentShort', 50)}
        >
          <Stack gap={1}>
            <Slider
              value={[ovNum(co, 'trailingActivationPercentShort', 50)]}
              onValueChange={(v) => setOv('trailingActivationPercentShort', v[0])}
              min={5}
              max={100}
              step={0.1}
            />
            <Text fontSize="xs" color="fg.muted" textAlign="right">
              {ovNum(co, 'trailingActivationPercentShort', 50)}%
            </Text>
          </Stack>
        </OverrideRow>
        <OverrideRow
          label={t('watcherManager.trailingStop.trailingDistanceLong')}
          description={t('tradingProfiles.overrides.usingGlobalDefault')}
          isActive={isActive('trailingDistancePercentLong')}
          onToggle={tog('trailingDistancePercentLong', 70)}
        >
          <Stack gap={1}>
            <Slider
              value={[ovNum(co, 'trailingDistancePercentLong', 70)]}
              onValueChange={(v) => setOv('trailingDistancePercentLong', v[0])}
              min={10}
              max={95}
              step={0.1}
            />
            <Text fontSize="xs" color="fg.muted" textAlign="right">
              {ovNum(co, 'trailingDistancePercentLong', 70)}%
            </Text>
          </Stack>
        </OverrideRow>
        <OverrideRow
          label={t('watcherManager.trailingStop.trailingDistanceShort')}
          description={t('tradingProfiles.overrides.usingGlobalDefault')}
          isActive={isActive('trailingDistancePercentShort')}
          onToggle={tog('trailingDistancePercentShort', 70)}
        >
          <Stack gap={1}>
            <Slider
              value={[ovNum(co, 'trailingDistancePercentShort', 70)]}
              onValueChange={(v) => setOv('trailingDistancePercentShort', v[0])}
              min={10}
              max={95}
              step={0.1}
            />
            <Text fontSize="xs" color="fg.muted" textAlign="right">
              {ovNum(co, 'trailingDistancePercentShort', 70)}%
            </Text>
          </Stack>
        </OverrideRow>
        <OverrideRow
          label={t('watcherManager.trailingStop.stopOffsetMode')}
          description={t('tradingProfiles.overrides.usingGlobalDefault')}
          isActive={isActive('trailingDistanceMode')}
          onToggle={tog('trailingDistanceMode', 'auto')}
        >
          <Select
            value={ovStr(co, 'trailingDistanceMode', 'auto')}
            options={TRAILING_DISTANCE_MODE_OPTIONS}
            onChange={(v) => setOv('trailingDistanceMode', v)}
            size="sm"
            usePortal={false}
          />
        </OverrideRow>
        <OverrideRow
          label={t('watcherManager.trailingStop.stopOffsetPercent')}
          description={t('tradingProfiles.overrides.usingGlobalDefault')}
          isActive={isActive('trailingStopOffsetPercent')}
          onToggle={tog('trailingStopOffsetPercent', 0.3)}
        >
          <Stack gap={1}>
            <Slider
              value={[ovNum(co, 'trailingStopOffsetPercent', 0.3)]}
              onValueChange={(v) => setOv('trailingStopOffsetPercent', v[0])}
              min={0.05}
              max={2}
              step={0.1}
            />
            <Text fontSize="xs" color="fg.muted" textAlign="right">
              {ovNum(co, 'trailingStopOffsetPercent', 0.3).toFixed(2)}%
            </Text>
          </Stack>
        </OverrideRow>
        <OverrideRow
          label={t('watcherManager.trailingStop.activationModeLong')}
          description={t('tradingProfiles.overrides.usingGlobalDefault')}
          isActive={isActive('trailingActivationModeLong')}
          onToggle={tog('trailingActivationModeLong', 'auto')}
        >
          <Select
            value={ovStr(co, 'trailingActivationModeLong', 'auto')}
            options={ACTIVATION_MODE_OPTIONS}
            onChange={(v) => setOv('trailingActivationModeLong', v)}
            size="sm"
            usePortal={false}
          />
        </OverrideRow>
        <OverrideRow
          label={t('watcherManager.trailingStop.activationModeShort')}
          description={t('tradingProfiles.overrides.usingGlobalDefault')}
          isActive={isActive('trailingActivationModeShort')}
          onToggle={tog('trailingActivationModeShort', 'auto')}
        >
          <Select
            value={ovStr(co, 'trailingActivationModeShort', 'auto')}
            options={ACTIVATION_MODE_OPTIONS}
            onChange={(v) => setOv('trailingActivationModeShort', v)}
            size="sm"
            usePortal={false}
          />
        </OverrideRow>
        {renderBoolFilter('useAdaptiveTrailing', 'watcherManager.trailingStop.adaptiveMode')}
      </Stack>
    </CollapsibleSection>
  );
};
