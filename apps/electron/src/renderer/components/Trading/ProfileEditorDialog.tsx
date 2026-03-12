import { Box, Flex, HStack, SimpleGrid, Spinner, Stack, Text } from '@chakra-ui/react';
import {
  Button,
  Checkbox,
  CollapsibleSection,
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
  Field,
  Input,
  NumberInput,
  Select,
  Slider,
  Switch,
  Textarea,
} from '@renderer/components/ui';
import type { CreateTradingProfileInput, TradingProfile, UpdateTradingProfileInput } from '@marketmind/types';
import { useAvailableSetups } from '@renderer/hooks/useProfileEditor';
import { useTradingProfiles } from '@renderer/hooks/useTradingProfiles';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PROFILE_CONFIG_KEYS } from '@marketmind/types';

interface ProfileEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  profile: TradingProfile | null;
}

const FIB_LEVEL_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: '1', label: '100% (1.0)' },
  { value: '1.272', label: '127.2% (1.272)' },
  { value: '1.382', label: '138.2% (1.382)' },
  { value: '1.618', label: '161.8% (1.618)' },
  { value: '2', label: '200% (2.0)' },
  { value: '2.618', label: '261.8% (2.618)' },
  { value: '3', label: '300% (3.0)' },
  { value: '3.618', label: '361.8% (3.618)' },
  { value: '4.236', label: '423.6% (4.236)' },
];

const TRADING_MODE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'semi_assisted', label: 'Semi-Assisted' },
];

const DIRECTION_MODE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'long_only', label: 'Long Only' },
  { value: 'short_only', label: 'Short Only' },
];

const SWING_RANGE_OPTIONS = [
  { value: 'nearest', label: 'Nearest' },
  { value: 'extended', label: 'Extended' },
];

const STOP_MODE_OPTIONS = [
  { value: 'fibo_target', label: 'Fibonacci Target' },
  { value: 'nearest_swing', label: 'Nearest Swing' },
];

const TP_MODE_OPTIONS = [
  { value: 'default', label: 'Default (ATR)' },
  { value: 'fibonacci', label: 'Fibonacci' },
];

const TRAILING_MODE_OPTIONS = [
  { value: 'local', label: 'Local' },
  { value: 'binance', label: 'Binance' },
];

const TRAILING_DISTANCE_MODE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'fixed', label: 'Fixed' },
];

const ACTIVATION_MODE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'manual', label: 'Manual' },
];

const ALL_FILTER_KEYS = [
  'useTrendFilter', 'useAdxFilter', 'useDirectionFilter', 'useSuperTrendFilter',
  'useStochasticFilter', 'useStochasticRecoveryFilter', 'useMomentumTimingFilter', 'useStochasticHtfFilter', 'useStochasticRecoveryHtfFilter',
  'useChoppinessFilter', 'choppinessThresholdHigh', 'choppinessThresholdLow', 'useVwapFilter', 'useMarketRegimeFilter', 'useBollingerSqueezeFilter', 'useFvgFilter',
  'useVolumeFilter', 'useObvCheckLong', 'useObvCheckShort', 'volumeFilterObvLookbackLong', 'volumeFilterObvLookbackShort',
  'useBtcCorrelationFilter', 'useFundingFilter', 'useMtfFilter',
  'useConfluenceScoring', 'confluenceMinScore', 'useCooldown', 'cooldownMinutes',
];

const FIB_ENTRY_KEYS = ['fibonacciTargetLevelLong', 'fibonacciTargetLevelShort', 'fibonacciSwingRange', 'maxFibonacciEntryProgressPercentLong', 'maxFibonacciEntryProgressPercentShort', 'initialStopMode', 'tpCalculationMode'];
const RR_KEYS = ['minRiskRewardRatioLong', 'minRiskRewardRatioShort'];
const TRAILING_KEYS = ['trailingStopEnabled', 'trailingStopMode', 'trailingActivationPercentLong', 'trailingActivationPercentShort', 'trailingDistancePercentLong', 'trailingDistancePercentShort', 'trailingDistanceMode', 'trailingStopOffsetPercent', 'trailingActivationModeLong', 'trailingActivationModeShort', 'useAdaptiveTrailing'];
const RISK_KEYS = ['positionSizePercent', 'maxDrawdownEnabled', 'maxDrawdownPercent', 'dailyLossLimit', 'maxRiskPerStopEnabled', 'maxRiskPerStopPercent'];
const MODE_KEYS = ['tradingMode', 'directionMode'];

const extractConfigOverrides = (profile: TradingProfile): Record<string, unknown> => {
  const overrides: Record<string, unknown> = {};
  for (const key of PROFILE_CONFIG_KEYS) {
    const value = profile[key];
    if (value !== null && value !== undefined) overrides[key] = value;
  }
  return overrides;
};

const ovNum = (overrides: Record<string, unknown>, key: string, fallback: number): number => {
  const v = overrides[key];
  return typeof v === 'number' ? v : fallback;
};
const ovStr = (overrides: Record<string, unknown>, key: string, fallback: string): string => {
  const v = overrides[key];
  return typeof v === 'string' ? v : fallback;
};
const ovBool = (overrides: Record<string, unknown>, key: string): boolean => overrides[key] === true;

const OverrideBadge = ({ count }: { count: number }) => {
  if (count === 0) return null;
  return (
    <Box
      px={2}
      py={0.5}
      bg="blue.100"
      color="blue.800"
      borderRadius="full"
      fontSize="xs"
      fontWeight="medium"
      _dark={{ bg: 'blue.900', color: 'blue.200' }}
    >
      {count}
    </Box>
  );
};

interface OverrideRowProps {
  label: string;
  description?: string;
  isActive: boolean;
  onToggle: (checked: boolean) => void;
  children?: ReactNode;
}

const OverrideRow = ({ label, description, isActive, onToggle, children }: OverrideRowProps) => (
  <Box>
    <HStack justify="space-between">
      <Box>
        <Text fontSize="sm" fontWeight="medium">{label}</Text>
        {!isActive && description && (
          <Text fontSize="xs" color="fg.muted">{description}</Text>
        )}
      </Box>
      <Switch checked={isActive} onCheckedChange={onToggle} size="sm" />
    </HStack>
    {isActive && children && <Box mt={2}>{children}</Box>}
  </Box>
);

export const ProfileEditorDialog = ({ isOpen, onClose, profile }: ProfileEditorDialogProps) => {
  const { t } = useTranslation();
  const { createProfile, updateProfile, isCreatingProfile, isUpdatingProfile } = useTradingProfiles();
  const { setups: availableSetups, isLoading: isLoadingSetups } = useAvailableSetups();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [enabledSetupTypes, setEnabledSetupTypes] = useState<string[]>([]);
  const [maxPositionSize, setMaxPositionSize] = useState<number | undefined>(undefined);
  const [maxConcurrentPositions, setMaxConcurrentPositions] = useState<number | undefined>(undefined);
  const [isDefault, setIsDefault] = useState(false);
  const [overridePositionSize, setOverridePositionSize] = useState(false);
  const [overrideConcurrentPositions, setOverrideConcurrentPositions] = useState(false);
  const [co, setCo] = useState<Record<string, unknown>>({});

  const isEditing = profile !== null;

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setDescription(profile.description ?? '');
      setEnabledSetupTypes(profile.enabledSetupTypes);
      setMaxPositionSize(profile.maxPositionSize ?? undefined);
      setMaxConcurrentPositions(profile.maxConcurrentPositions ?? undefined);
      setIsDefault(profile.isDefault);
      setOverridePositionSize(profile.maxPositionSize !== null && profile.maxPositionSize !== undefined);
      setOverrideConcurrentPositions(profile.maxConcurrentPositions !== null && profile.maxConcurrentPositions !== undefined);
      setCo(extractConfigOverrides(profile));
    } else {
      setName('');
      setDescription('');
      setEnabledSetupTypes([]);
      setMaxPositionSize(undefined);
      setMaxConcurrentPositions(undefined);
      setIsDefault(false);
      setOverridePositionSize(false);
      setOverrideConcurrentPositions(false);
      setCo({});
    }
  }, [profile, isOpen]);

  const isActive = useCallback((key: string) => co[key] !== undefined, [co]);

  const setOv = useCallback((key: string, value: unknown) => {
    setCo((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearOv = useCallback((key: string) => {
    setCo((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const tog = useCallback((key: string, defaultValue: unknown) => (checked: boolean) => {
    if (checked) setOv(key, defaultValue);
    else clearOv(key);
  }, [setOv, clearOv]);

  const ovCount = useCallback((keys: string[]) => {
    return keys.filter((k) => co[k] !== undefined).length;
  }, [co]);

  const handleToggleSetup = useCallback((setupId: string) => {
    setEnabledSetupTypes((prev) =>
      prev.includes(setupId) ? prev.filter((id) => id !== setupId) : [...prev, setupId]
    );
  }, []);

  const handleToggleAll = useCallback(() => {
    setEnabledSetupTypes((prev) => {
      const allEnabled = availableSetups.every((s) => prev.includes(s.id));
      return allEnabled ? [] : availableSetups.map((s) => s.id);
    });
  }, [availableSetups]);

  const handleSubmit = async () => {
    if (!name.trim() || enabledSetupTypes.length === 0) return;

    const overridesPayload: Record<string, unknown> = {};
    if (isEditing) {
      for (const key of PROFILE_CONFIG_KEYS) {
        overridesPayload[key] = co[key] !== undefined ? co[key] : null;
      }
    } else {
      for (const key of PROFILE_CONFIG_KEYS) {
        if (co[key] !== undefined) overridesPayload[key] = co[key];
      }
    }

    if (isEditing && profile) {
      const data: UpdateTradingProfileInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        enabledSetupTypes,
        maxPositionSize: overridePositionSize ? maxPositionSize : undefined,
        maxConcurrentPositions: overrideConcurrentPositions ? maxConcurrentPositions : undefined,
        isDefault,
        ...overridesPayload,
      } as UpdateTradingProfileInput;
      await updateProfile(profile.id, data);
    } else {
      const data: CreateTradingProfileInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        enabledSetupTypes,
        maxPositionSize: overridePositionSize ? maxPositionSize : undefined,
        maxConcurrentPositions: overrideConcurrentPositions ? maxConcurrentPositions : undefined,
        isDefault,
        ...overridesPayload,
      } as CreateTradingProfileInput;
      await createProfile(data);
    }

    onClose();
  };

  const isSubmitting = isCreatingProfile || isUpdatingProfile;
  const canSubmit = name.trim().length > 0 && enabledSetupTypes.length > 0 && !isSubmitting;
  const allSetupsEnabled = availableSetups.length > 0 && availableSetups.every((s) => enabledSetupTypes.includes(s.id));
  const enabledCount = enabledSetupTypes.length;

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

  const riskBadgeCount = ovCount(RISK_KEYS) + (overridePositionSize ? 1 : 0) + (overrideConcurrentPositions ? 1 : 0);

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="xl">
      <DialogBackdrop />
      <DialogPositioner>
        <DialogContent>
          <DialogHeader px={4} pt={4}>
            <DialogTitle>
              {isEditing ? t('tradingProfiles.editProfile') : t('tradingProfiles.createProfile')}
            </DialogTitle>
          </DialogHeader>
          <DialogCloseTrigger />

          <DialogBody p={4} maxH="70vh" overflowY="auto">
            <Stack gap={2}>
              <CollapsibleSection
                title={t('tradingProfiles.sections.basicInfo')}
                description={t('tradingProfiles.sections.basicInfoDescription')}
                defaultOpen={true}
                size="lg"
              >
                <Stack gap={4}>
                  <Field label={t('tradingProfiles.fields.name')} required>
                    <Input
                      size="sm"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('tradingProfiles.placeholders.name')}
                      maxLength={100}
                      px={3}
                    />
                  </Field>
                  <Field label={t('tradingProfiles.fields.description')}>
                    <Textarea
                      size="sm"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t('tradingProfiles.placeholders.description')}
                      maxLength={500}
                      rows={2}
                      px={3}
                    />
                  </Field>
                  <HStack justify="space-between">
                    <Box>
                      <Text fontSize="sm" fontWeight="medium">
                        {t('tradingProfiles.fields.setAsDefault')}
                      </Text>
                      <Text fontSize="xs" color="fg.muted">
                        {t('tradingProfiles.fields.setAsDefaultDescription')}
                      </Text>
                    </Box>
                    <Switch checked={isDefault} onCheckedChange={setIsDefault} />
                  </HStack>
                </Stack>
              </CollapsibleSection>

              <CollapsibleSection
                title={t('tradingProfiles.sections.tradingMode')}
                description={t('tradingProfiles.sections.tradingModeDescription')}
                badge={<OverrideBadge count={ovCount(MODE_KEYS)} />}
                size="lg"
              >
                <Stack gap={4}>
                  <OverrideRow
                    label={t('tradingProfiles.overrides.tradingMode')}
                    description={t('tradingProfiles.overrides.usingGlobalDefault')}
                    isActive={isActive('tradingMode')}
                    onToggle={tog('tradingMode', 'auto')}
                  >
                    <Select
                      value={ovStr(co, 'tradingMode', 'auto')}
                      options={TRADING_MODE_OPTIONS}
                      onChange={(v) => setOv('tradingMode', v)}
                      size="sm"
                    />
                  </OverrideRow>
                  <OverrideRow
                    label={t('tradingProfiles.overrides.directionMode')}
                    description={t('tradingProfiles.overrides.usingGlobalDefault')}
                    isActive={isActive('directionMode')}
                    onToggle={tog('directionMode', 'auto')}
                  >
                    <Select
                      value={ovStr(co, 'directionMode', 'auto')}
                      options={DIRECTION_MODE_OPTIONS}
                      onChange={(v) => setOv('directionMode', v)}
                      size="sm"
                    />
                  </OverrideRow>
                </Stack>
              </CollapsibleSection>

              <CollapsibleSection
                title={t('tradingProfiles.fields.enabledSetups')}
                description={t('tradingProfiles.sections.setupsDescription')}
                defaultOpen={true}
                badge={
                  <Box
                    px={2}
                    py={0.5}
                    bg={enabledCount === availableSetups.length ? 'green.100' : enabledCount > 0 ? 'blue.100' : 'red.100'}
                    color={enabledCount === availableSetups.length ? 'green.800' : enabledCount > 0 ? 'blue.800' : 'red.800'}
                    borderRadius="full"
                    fontSize="xs"
                    fontWeight="medium"
                    _dark={{
                      bg: enabledCount === availableSetups.length ? 'green.900' : enabledCount > 0 ? 'blue.900' : 'red.900',
                      color: enabledCount === availableSetups.length ? 'green.200' : enabledCount > 0 ? 'blue.200' : 'red.200',
                    }}
                  >
                    {enabledCount}/{availableSetups.length}
                  </Box>
                }
                size="lg"
              >
                <Stack gap={4}>
                  <Box>
                    <Checkbox checked={allSetupsEnabled} onCheckedChange={handleToggleAll}>
                      <Text fontWeight="semibold" fontSize="sm">
                        {t('setupConfig.toggleAll')}
                      </Text>
                    </Checkbox>
                  </Box>
                  {isLoadingSetups ? (
                    <Flex justify="center" py={4}>
                      <Spinner size="sm" />
                    </Flex>
                  ) : availableSetups.length === 0 ? (
                    <Box p={4} textAlign="center">
                      <Text fontSize="sm" color="fg.muted">
                        {t('setupConfig.noStrategiesAvailable')}
                      </Text>
                    </Box>
                  ) : (
                    <SimpleGrid columns={{ base: 1, md: 2 }} gap={2}>
                      {availableSetups.map((setup) => (
                        <Box
                          key={setup.id}
                          p={2}
                          bg="bg.muted"
                          borderRadius="md"
                          borderLeft="3px solid"
                          borderColor={enabledSetupTypes.includes(setup.id) ? 'green.500' : 'gray.400'}
                          cursor="pointer"
                          _hover={{ bg: 'bg.subtle' }}
                          onClick={() => handleToggleSetup(setup.id)}
                        >
                          <Checkbox
                            checked={enabledSetupTypes.includes(setup.id)}
                            onCheckedChange={() => handleToggleSetup(setup.id)}
                          >
                            <Text fontSize="sm">
                              {t(`tradingProfiles.setups.${setup.id}`, setup.id)}
                            </Text>
                          </Checkbox>
                        </Box>
                      ))}
                    </SimpleGrid>
                  )}
                </Stack>
              </CollapsibleSection>

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

              <CollapsibleSection
                title={t('tradingProfiles.sections.fibEntry')}
                description={t('tradingProfiles.sections.fibEntryDescription')}
                badge={<OverrideBadge count={ovCount(FIB_ENTRY_KEYS)} />}
                size="lg"
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
                        step={5}
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
                        step={5}
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

              <CollapsibleSection
                title={t('tradingProfiles.sections.trailingStop')}
                description={t('tradingProfiles.sections.trailingStopDescription')}
                badge={<OverrideBadge count={ovCount(TRAILING_KEYS)} />}
                size="lg"
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
                        step={5}
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
                        step={5}
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
                        step={5}
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
                        step={5}
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
                        step={0.05}
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
                    />
                  </OverrideRow>
                  {renderBoolFilter('useAdaptiveTrailing', 'watcherManager.trailingStop.adaptiveMode')}
                </Stack>
              </CollapsibleSection>

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
                        min={1}
                        max={100}
                        step={1}
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
                            min={1}
                            max={50}
                            step={0.5}
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
                        min={1}
                        max={25}
                        step={0.5}
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
            </Stack>
          </DialogBody>

          <DialogFooter px={4} pb={4}>
            <Button size="2xs" variant="ghost" onClick={onClose} disabled={isSubmitting} px={3}>
              {t('common.cancel')}
            </Button>
            <Button
              size="2xs"
              variant="outline"
              onClick={() => void handleSubmit()}
              loading={isSubmitting}
              disabled={!canSubmit}
              px={3}
            >
              {isEditing ? t('common.save') : t('tradingProfiles.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPositioner>
    </DialogRoot>
  );
};
