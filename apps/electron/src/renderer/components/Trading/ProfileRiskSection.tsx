import { Box, HStack, Stack, Text } from '@chakra-ui/react';
import { CollapsibleSection, Field, NumberInput, Slider, Switch } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';
import { RISK_KEYS } from './profileEditorConstants';
import { OverrideBadge, OverrideRow, ovBool, ovNum } from './profileEditorUtils';
import type { ProfileOverrideActions } from './profileEditorUtils';

interface ProfileRiskSectionProps {
  actions: ProfileOverrideActions;
  overridePositionSize: boolean;
  setOverridePositionSize: (v: boolean) => void;
  maxPositionSize: number | undefined;
  setMaxPositionSize: (v: number | undefined) => void;
  overrideConcurrentPositions: boolean;
  setOverrideConcurrentPositions: (v: boolean) => void;
  maxConcurrentPositions: number | undefined;
  setMaxConcurrentPositions: (v: number | undefined) => void;
}

export const ProfileRiskSection = ({
  actions,
  overridePositionSize,
  setOverridePositionSize,
  maxPositionSize,
  setMaxPositionSize,
  overrideConcurrentPositions,
  setOverrideConcurrentPositions,
  maxConcurrentPositions,
  setMaxConcurrentPositions,
}: ProfileRiskSectionProps) => {
  const { t } = useTranslation();
  const { co, isActive, setOv, tog, ovCount } = actions;

  const riskBadgeCount = ovCount(RISK_KEYS) + (overridePositionSize ? 1 : 0) + (overrideConcurrentPositions ? 1 : 0);

  return (
    <CollapsibleSection
      title={t('tradingProfiles.sections.riskManagement')}
      description={t('tradingProfiles.sections.riskManagementDescription')}
      badge={<OverrideBadge count={riskBadgeCount} />}
      size="lg"
    >
      <Stack gap={4}>
        <HStack justify="space-between">
          <Box>
            <Text fontSize="sm" fontWeight="medium">
              {t('tradingProfiles.fields.overrideMaxPosition')}
            </Text>
            <Text fontSize="xs" color="fg.muted">
              {t('tradingProfiles.fields.overrideMaxPositionDescription')}
            </Text>
          </Box>
          <Switch
            checked={overridePositionSize}
            onCheckedChange={(checked) => {
              setOverridePositionSize(checked);
              if (!checked) setMaxPositionSize(undefined);
            }}
          />
        </HStack>
        {overridePositionSize && (
          <Field label={t('tradingProfiles.fields.maxPositionSize')}>
            <NumberInput
              size="sm"
              value={maxPositionSize ?? ''}
              onChange={(e) => setMaxPositionSize(e.target.value ? Number(e.target.value) : undefined)}
              min={1}
              max={100}
              px={3}
            />
          </Field>
        )}
        <HStack justify="space-between">
          <Box>
            <Text fontSize="sm" fontWeight="medium">
              {t('tradingProfiles.fields.overrideMaxConcurrent')}
            </Text>
            <Text fontSize="xs" color="fg.muted">
              {t('tradingProfiles.fields.overrideMaxConcurrentDescription')}
            </Text>
          </Box>
          <Switch
            checked={overrideConcurrentPositions}
            onCheckedChange={(checked) => {
              setOverrideConcurrentPositions(checked);
              if (!checked) setMaxConcurrentPositions(undefined);
            }}
          />
        </HStack>
        {overrideConcurrentPositions && (
          <Field label={t('tradingProfiles.fields.maxConcurrentPositions')}>
            <NumberInput
              size="sm"
              value={maxConcurrentPositions ?? ''}
              onChange={(e) => setMaxConcurrentPositions(e.target.value ? Number(e.target.value) : undefined)}
              min={1}
              max={10}
              px={3}
            />
          </Field>
        )}
        <OverrideRow
          label={t('tradingProfiles.overrides.positionSizePercent')}
          description={t('tradingProfiles.overrides.usingGlobalDefault')}
          isActive={isActive('positionSizePercent')}
          onToggle={tog('positionSizePercent', 5)}
        >
          <Stack gap={1}>
            <Slider
              value={[ovNum(co, 'positionSizePercent', 5)]}
              onValueChange={(v) => setOv('positionSizePercent', v[0])}
              min={0.3}
              max={100}
              step={0.1}
            />
            <Text fontSize="xs" color="fg.muted" textAlign="right">
              {ovNum(co, 'positionSizePercent', 5)}%
            </Text>
          </Stack>
        </OverrideRow>
        <OverrideRow
          label={t('watcherManager.riskManagement.maxDrawdown.title')}
          description={t('tradingProfiles.overrides.usingGlobalDefault')}
          isActive={isActive('maxDrawdownEnabled')}
          onToggle={tog('maxDrawdownEnabled', true)}
        >
          <Stack gap={2}>
            <Switch
              checked={ovBool(co, 'maxDrawdownEnabled')}
              onCheckedChange={(v) => setOv('maxDrawdownEnabled', v)}
              size="sm"
            >
              <Text fontSize="xs">{ovBool(co, 'maxDrawdownEnabled') ? t('common.enabled') : t('common.disabled')}</Text>
            </Switch>
            {ovBool(co, 'maxDrawdownEnabled') && (
              <Field label={t('tradingProfiles.overrides.maxDrawdownPercent')}>
                <NumberInput
                  size="sm"
                  value={ovNum(co, 'maxDrawdownPercent', 10)}
                  onChange={(e) => setOv('maxDrawdownPercent', e.target.value ? Number(e.target.value) : 10)}
                  min={0.3}
                  max={50}
                  step={0.1}
                  px={3}
                />
              </Field>
            )}
          </Stack>
        </OverrideRow>
        <OverrideRow
          label={t('tradingProfiles.overrides.dailyLossLimit')}
          description={t('tradingProfiles.overrides.usingGlobalDefault')}
          isActive={isActive('dailyLossLimit')}
          onToggle={tog('dailyLossLimit', 5)}
        >
          <Stack gap={1}>
            <Slider
              value={[ovNum(co, 'dailyLossLimit', 5)]}
              onValueChange={(v) => setOv('dailyLossLimit', v[0])}
              min={0.3}
              max={25}
              step={0.1}
            />
            <Text fontSize="xs" color="fg.muted" textAlign="right">
              {ovNum(co, 'dailyLossLimit', 5)}%
            </Text>
          </Stack>
        </OverrideRow>
        <OverrideRow
          label={t('watcherManager.riskManagement.maxRiskPerStop.title')}
          description={t('tradingProfiles.overrides.usingGlobalDefault')}
          isActive={isActive('maxRiskPerStopEnabled')}
          onToggle={tog('maxRiskPerStopEnabled', true)}
        >
          <Stack gap={2}>
            <Switch
              checked={ovBool(co, 'maxRiskPerStopEnabled')}
              onCheckedChange={(v) => setOv('maxRiskPerStopEnabled', v)}
              size="sm"
            >
              <Text fontSize="xs">{ovBool(co, 'maxRiskPerStopEnabled') ? t('common.enabled') : t('common.disabled')}</Text>
            </Switch>
            {ovBool(co, 'maxRiskPerStopEnabled') && (
              <Field label={t('tradingProfiles.overrides.maxRiskPerStopPercent')}>
                <NumberInput
                  size="sm"
                  value={ovNum(co, 'maxRiskPerStopPercent', 2)}
                  onChange={(e) => setOv('maxRiskPerStopPercent', e.target.value ? Number(e.target.value) : 2)}
                  min={0.1}
                  max={10}
                  step={0.1}
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
