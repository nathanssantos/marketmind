import { Box, Flex, Grid, HStack, Stack, Text } from '@chakra-ui/react';
import { Badge, FormSection, Field, NumberInput, Select, Switch } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';
import type { WatcherConfig } from './types';

export interface PyramidingSectionProps {
  config: WatcherConfig | undefined;
  walletId: string;
  onConfigUpdate: (updates: Partial<WatcherConfig>) => void;
  onFilterToggle: (filterKey: string, value: boolean) => void;
  isPending: boolean;
  isIB?: boolean;
}

export const PyramidingSection = ({
  config,
  walletId,
  onConfigUpdate,
  onFilterToggle,
  isPending,
  isIB = false,
}: PyramidingSectionProps) => {
  const { t } = useTranslation();

  const getCurrentFiboPreset = (): string => {
    try {
      const levels = JSON.parse(config?.pyramidFiboLevels ?? '["1", "1.618"]');
      if (levels.length === 5) return 'all';
      if (levels.includes('1.618') && levels.length === 1) return '1.618';
      if (levels.includes('1') && levels.includes('1.618') && levels.length === 2) return 'conservative';
      if (levels.includes('1.272') && levels.includes('1.618') && levels.includes('2') && levels.length === 3) return 'moderate';
      return 'custom';
    } catch {
      return 'conservative';
    }
  };

  const handlePyramidModeChange = (value: string): void => {
    if (!walletId) return;
    if (value === 'disabled') {
      onConfigUpdate({ pyramidingEnabled: false });
    } else {
      onConfigUpdate({
        pyramidingEnabled: true,
        pyramidingMode: value as 'static' | 'dynamic' | 'fibonacci',
      });
    }
  };

  const handleFiboLevelsChange = (value: string): void => {
    if (!walletId) return;
    let levels: ('1' | '1.272' | '1.382' | '1.618' | '2' | '2.618' | '3' | '3.618' | '4.236')[];
    switch (value) {
      case '1.618':
        levels = ['1.618'];
        break;
      case 'conservative':
        levels = ['1', '1.618'];
        break;
      case 'moderate':
        levels = ['1.272', '1.618', '2'];
        break;
      case 'all':
        levels = ['1', '1.272', '1.618', '2', '2.618'];
        break;
      default:
        return;
    }
    onConfigUpdate({ pyramidFiboLevels: JSON.stringify(levels) });
  };

  return (
    <FormSection
      title={t('settings.algorithmicAutoTrading.pyramiding.title')}
      description={t('settings.algorithmicAutoTrading.pyramiding.description')}
    >
          <Field
            label={t('settings.algorithmicAutoTrading.pyramiding.modeLabel')}
            helperText={(() => {
              const v = config?.pyramidingEnabled ? (config?.pyramidingMode ?? 'static') : 'disabled';
              if (v === 'disabled') return t('settings.algorithmicAutoTrading.pyramiding.modeDisabledDesc');
              if (v === 'static') return t('settings.algorithmicAutoTrading.pyramiding.modeStaticDesc');
              if (v === 'dynamic') return t('settings.algorithmicAutoTrading.pyramiding.modeDynamicDesc');
              return t('settings.algorithmicAutoTrading.pyramiding.modeFibonacciDesc');
            })()}
          >
            <Select
              value={config?.pyramidingEnabled ? (config?.pyramidingMode ?? 'static') : 'disabled'}
              options={[
                { value: 'disabled', label: t('settings.algorithmicAutoTrading.pyramiding.modeDisabled') },
                { value: 'static', label: t('settings.algorithmicAutoTrading.pyramiding.modeStatic') },
                { value: 'dynamic', label: t('settings.algorithmicAutoTrading.pyramiding.modeDynamic') },
                { value: 'fibonacci', label: t('settings.algorithmicAutoTrading.pyramiding.modeFibonacci') },
              ]}
              onChange={handlePyramidModeChange}
              size="sm"
              usePortal={false}
            />
          </Field>

          {config?.pyramidingEnabled && (
            <>
              <Box mt={4}>
                <Text fontSize="sm" fontWeight="medium" mb={2}>
                  {t('settings.algorithmicAutoTrading.pyramiding.generalSettings')}
                </Text>
                <Grid templateColumns="1fr 1fr" gap={4}>
                  <Box>
                    <Text fontSize="xs" color="fg.muted" mb={1}>
                      {t('settings.algorithmicAutoTrading.pyramiding.maxEntries')}
                    </Text>
                    <NumberInput
                      min={2}
                      max={10}
                      value={String(config?.maxPyramidEntries ?? 5)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        if (!walletId) return;
                        const value = parseInt(e.target.value, 10);
                        if (!isNaN(value) && value >= 2 && value <= 10) {
                          onConfigUpdate({ maxPyramidEntries: value });
                        }
                      }}
                      size="sm"
                      w="80px"
                    />
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="fg.muted" mb={1}>
                      {t('settings.algorithmicAutoTrading.pyramiding.scaleFactor')}
                    </Text>
                    <Flex gap={2} align="center">
                      <NumberInput
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={config?.pyramidScaleFactor ?? '0.80'}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          if (!walletId) return;
                          const value = parseFloat(e.target.value);
                          if (!isNaN(value) && value >= 0.1 && value <= 1) {
                            onConfigUpdate({ pyramidScaleFactor: value.toFixed(2) });
                          }
                        }}
                        size="sm"
                        w="80px"
                      />
                      <Text fontSize="xs" color="fg.muted">
                        {t('settings.algorithmicAutoTrading.pyramiding.scaleFactorDesc')}
                      </Text>
                    </Flex>
                  </Box>
                </Grid>
              </Box>

              {config?.pyramidingMode === 'dynamic' && (
                <Box mt={4}>
                  <Text fontSize="sm" fontWeight="medium" mb={2}>
                    {t('settings.algorithmicAutoTrading.pyramiding.dynamicIndicators')}
                  </Text>
                  <Stack gap={2}>
                    <Flex justify="space-between" align="center">
                      <Box>
                        <Text fontSize="sm">{t('settings.algorithmicAutoTrading.pyramiding.useAdx')}</Text>
                        <Text fontSize="xs" color="fg.muted">{t('settings.algorithmicAutoTrading.pyramiding.useAdxDesc')}</Text>
                      </Box>
                      <HStack gap={2}>
                        {config?.pyramidUseAdx && (
                          <NumberInput
                            min={15}
                            max={50}
                            value={String(config?.pyramidAdxThreshold ?? 25)}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              if (!walletId) return;
                              const value = parseInt(e.target.value, 10);
                              if (!isNaN(value) && value >= 15 && value <= 50) {
                                onConfigUpdate({ pyramidAdxThreshold: value });
                              }
                            }}
                            size="sm"
                            w="60px"
                          />
                        )}
                        <Switch
                          checked={config?.pyramidUseAdx ?? true}
                          onCheckedChange={(value) => onFilterToggle('pyramidUseAdx', value)}
                          disabled={isPending}
                        />
                      </HStack>
                    </Flex>
                    <Flex justify="space-between" align="center">
                      <Box>
                        <Text fontSize="sm">{t('settings.algorithmicAutoTrading.pyramiding.useAtr')}</Text>
                        <Text fontSize="xs" color="fg.muted">{t('settings.algorithmicAutoTrading.pyramiding.useAtrDesc')}</Text>
                      </Box>
                      <Switch
                        checked={config?.pyramidUseAtr ?? true}
                        onCheckedChange={(value) => onFilterToggle('pyramidUseAtr', value)}
                        disabled={isPending}
                      />
                    </Flex>
                    <Flex justify="space-between" align="center">
                      <Box>
                        <Text fontSize="sm">{t('settings.algorithmicAutoTrading.pyramiding.useRsi')}</Text>
                        <Text fontSize="xs" color="fg.muted">{t('settings.algorithmicAutoTrading.pyramiding.useRsiDesc')}</Text>
                      </Box>
                      <Switch
                        checked={config?.pyramidUseRsi ?? false}
                        onCheckedChange={(value) => onFilterToggle('pyramidUseRsi', value)}
                        disabled={isPending}
                      />
                    </Flex>
                    <Flex justify="space-between" align="center" opacity={isIB ? 0.45 : 1}>
                      <Box>
                        <Flex align="center" gap={2}>
                          <Text fontSize="sm">{t('settings.algorithmicAutoTrading.pyramiding.leverageAware')}</Text>
                          <Badge size="sm" colorPalette={isIB ? 'gray' : 'purple'} variant="subtle">
                            {t('common.futuresOnly')}
                          </Badge>
                        </Flex>
                        <Text fontSize="xs" color="fg.muted">{t('settings.algorithmicAutoTrading.pyramiding.leverageAwareDesc')}</Text>
                      </Box>
                      <Switch
                        checked={isIB ? false : (config?.leverageAwarePyramid ?? true)}
                        onCheckedChange={(value) => onFilterToggle('leverageAwarePyramid', value)}
                        disabled={isPending || isIB}
                      />
                    </Flex>
                  </Stack>
                </Box>
              )}

              {config?.pyramidingMode === 'fibonacci' && (
                <Box mt={4}>
                  <Field
                    label={t('settings.algorithmicAutoTrading.pyramiding.fiboLevels')}
                    helperText={(() => {
                      const v = getCurrentFiboPreset();
                      if (v === '1.618') return t('settings.algorithmicAutoTrading.pyramiding.fiboGoldenDesc');
                      if (v === 'conservative') return t('settings.algorithmicAutoTrading.pyramiding.fiboConservativeDesc');
                      if (v === 'moderate') return t('settings.algorithmicAutoTrading.pyramiding.fiboModerateDesc');
                      if (v === 'all') return t('settings.algorithmicAutoTrading.pyramiding.fiboAllDesc');
                      return t('settings.algorithmicAutoTrading.pyramiding.fiboLevelsDesc');
                    })()}
                  >
                    <Select
                      value={getCurrentFiboPreset()}
                      options={[
                        { value: '1.618', label: t('settings.algorithmicAutoTrading.pyramiding.fiboGolden') },
                        { value: 'conservative', label: t('settings.algorithmicAutoTrading.pyramiding.fiboConservative') },
                        { value: 'moderate', label: t('settings.algorithmicAutoTrading.pyramiding.fiboModerate') },
                        { value: 'all', label: t('settings.algorithmicAutoTrading.pyramiding.fiboAll') },
                      ]}
                      onChange={handleFiboLevelsChange}
                      size="sm"
                      usePortal={false}
                    />
                  </Field>
                </Box>
              )}
            </>
          )}
    </FormSection>
  );
};
