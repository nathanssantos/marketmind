import { Field } from '@/renderer/components/ui/field';
import { Slider } from '@/renderer/components/ui/slider';
import { Switch } from '@/renderer/components/ui/switch';
import { useSetupStore } from '@/renderer/store/setupStore';
import { Box, Button, HStack, Separator, Stack, Text } from '@chakra-ui/react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { LuRefreshCw } from 'react-icons/lu';

const MIN_CONFIDENCE = 50;
const MAX_CONFIDENCE = 100;
const CONFIDENCE_STEP = 5;

interface SetupSection {
    setupKey: 'setup91' | 'setup92' | 'setup93' | 'setup94' | 'pattern123' | 'bullTrap' | 'bearTrap' | 'breakoutRetest' | 'pinInside' | 'orderBlockFVG' | 'vwapEmaCross' | 'divergence' | 'liquiditySweep';
    titleKey: string;
    descriptionKey: string;
}

const useSetupSections = (): SetupSection[] => [
    {
        setupKey: 'setup91',
        titleKey: 'setupConfig.setups.setup91.title',
        descriptionKey: 'setupConfig.setups.setup91.description',
    },
    {
        setupKey: 'setup92',
        titleKey: 'setupConfig.setups.setup92.title',
        descriptionKey: 'setupConfig.setups.setup92.description',
    },
    {
        setupKey: 'setup93',
        titleKey: 'setupConfig.setups.setup93.title',
        descriptionKey: 'setupConfig.setups.setup93.description',
    },
    {
        setupKey: 'setup94',
        titleKey: 'setupConfig.setups.setup94.title',
        descriptionKey: 'setupConfig.setups.setup94.description',
    },
    {
        setupKey: 'pattern123',
        titleKey: 'setupConfig.setups.pattern123.title',
        descriptionKey: 'setupConfig.setups.pattern123.description',
    },
    {
        setupKey: 'bullTrap',
        titleKey: 'setupConfig.setups.bullTrap.title',
        descriptionKey: 'setupConfig.setups.bullTrap.description',
    },
    {
        setupKey: 'bearTrap',
        titleKey: 'setupConfig.setups.bearTrap.title',
        descriptionKey: 'setupConfig.setups.bearTrap.description',
    },
    {
        setupKey: 'breakoutRetest',
        titleKey: 'setupConfig.setups.breakoutRetest.title',
        descriptionKey: 'setupConfig.setups.breakoutRetest.description',
    },
    {
        setupKey: 'pinInside',
        titleKey: 'setupConfig.setups.pinInside.title',
        descriptionKey: 'setupConfig.setups.pinInside.description',
    },
    {
        setupKey: 'orderBlockFVG',
        titleKey: 'setupConfig.setups.orderBlockFVG.title',
        descriptionKey: 'setupConfig.setups.orderBlockFVG.description',
    },
    {
        setupKey: 'vwapEmaCross',
        titleKey: 'setupConfig.setups.vwapEmaCross.title',
        descriptionKey: 'setupConfig.setups.vwapEmaCross.description',
    },
    {
        setupKey: 'divergence',
        titleKey: 'setupConfig.setups.divergence.title',
        descriptionKey: 'setupConfig.setups.divergence.description',
    },
    {
        setupKey: 'liquiditySweep',
        titleKey: 'setupConfig.setups.liquiditySweep.title',
        descriptionKey: 'setupConfig.setups.liquiditySweep.description',
    },
];

export const SetupConfigTab = (): React.ReactElement => {
    const { t } = useTranslation();
    const { config, updateSetupConfig, setConfig, resetConfigToDefaults, isAutoTradingActive } = useSetupStore();
    const sections = useSetupSections();

    const handleToggleSetup = (setupKey: 'setup91' | 'setup92' | 'setup93' | 'setup94' | 'pattern123' | 'bullTrap' | 'bearTrap' | 'breakoutRetest' | 'pinInside' | 'orderBlockFVG' | 'vwapEmaCross' | 'divergence' | 'liquiditySweep'): void => {
        updateSetupConfig(setupKey, {
            enabled: !config[setupKey].enabled,
        });
    };

    const handleConfigChange = (
        setupKey: 'setup91' | 'setup92' | 'setup93' | 'setup94' | 'pattern123' | 'bullTrap' | 'bearTrap' | 'breakoutRetest' | 'pinInside' | 'orderBlockFVG' | 'vwapEmaCross' | 'divergence' | 'liquiditySweep',
        field: string,
        value: number,
    ): void => {
        updateSetupConfig(setupKey, {
            [field]: value,
        });
    };

    const handleToggleTrendFilter = (): void => {
        setConfig({ enableTrendFilter: !config.enableTrendFilter });
    };

    const handleToggleCounterTrend = (): void => {
        setConfig({ allowCounterTrend: !config.allowCounterTrend });
    };

    return (
        <Stack gap={6}>
            <Box
                bg="green.500/10"
                p={4}
                borderRadius="md"
                borderLeft="4px solid"
                borderColor="green.500"
            >
                <Text fontSize="sm" fontWeight="semibold" mb={2}>
                    {t('common.tips')}
                </Text>
                <Stack gap={1} fontSize="sm" color="fg.muted">
                    <Text>• {t('setupConfig.tips.confidence')}</Text>
                    <Text>• {t('setupConfig.tips.algorithmic')}</Text>
                    <Text>• {t('setupConfig.tips.toolbar')}</Text>
                </Stack>
            </Box>

            <Box>
                <Button
                    variant="outline"
                    onClick={resetConfigToDefaults}
                    width="full"
                    colorPalette="red"
                    disabled={isAutoTradingActive}
                >
                    <LuRefreshCw />
                    {t('settings.resetToDefaults')}
                </Button>
            </Box>

            <Separator />

            <Box>
                <Text fontSize="sm" fontWeight="bold" mb={4}>
                    {t('setupConfig.trendFilter.title')}
                </Text>
                <Stack gap={4}>
                    <HStack justify="space-between">
                        <Box flex="1">
                            <Text fontWeight="medium">{t('setupConfig.trendFilter.enable')}</Text>
                            <Text fontSize="sm" color="fg.muted">
                                {t('setupConfig.trendFilter.enableDescription')}
                            </Text>
                        </Box>
                        <Switch
                            checked={config.enableTrendFilter}
                            onCheckedChange={handleToggleTrendFilter}
                        />
                    </HStack>

                    {config.enableTrendFilter && (
                        <HStack justify="space-between" pl={4}>
                            <Box flex="1">
                                <Text fontWeight="medium">{t('setupConfig.trendFilter.allowCounter')}</Text>
                                <Text fontSize="sm" color="fg.muted">
                                    {t('setupConfig.trendFilter.allowCounterDescription')}
                                </Text>
                            </Box>
                            <Switch
                                checked={config.allowCounterTrend}
                                onCheckedChange={handleToggleCounterTrend}
                            />
                        </HStack>
                    )}
                </Stack>
            </Box>

            <Separator />

            <Box>
                <Text fontSize="sm" fontWeight="bold" mb={4}>
                    {t('setupConfig.status.title')}
                </Text>
                <Stack gap={4}>
                    <HStack justify="space-between">
                        <Box>
                            <Text fontWeight="medium">{t('setupConfig.status.autoTrading')}</Text>
                            <Text fontSize="sm" color="fg.muted">
                                {isAutoTradingActive ? t('setupConfig.status.active') : t('setupConfig.status.inactive')}
                            </Text>
                        </Box>
                        <Switch
                            checked={isAutoTradingActive}
                            onCheckedChange={() => { }}
                            disabled
                        />
                    </HStack>
                </Stack>
            </Box>

            <Separator />

            {sections.map((section) => {
                const setupConfig = config[section.setupKey];
                const isEnabled = setupConfig.enabled;

                return (
                    <Box key={section.setupKey}>
                        <HStack justify="space-between" mb={4}>
                            <Box flex="1">
                                <Text fontSize="md" fontWeight="bold">
                                    {t(section.titleKey)}
                                </Text>
                                <Text fontSize="sm" color="fg.muted">
                                    {t(section.descriptionKey)}
                                </Text>
                            </Box>
                            <Switch
                                checked={isEnabled}
                                onCheckedChange={() => handleToggleSetup(section.setupKey)}
                            />
                        </HStack>

                        {isEnabled && (
                            <Stack gap={4} pl={4} borderLeft="2px solid" borderColor="border">
                                <Field
                                    label={t('setupConfig.parameters.minConfidence.label')}
                                    helperText={t('setupConfig.parameters.minConfidence.helper')}
                                >
                                    <Slider
                                        value={[setupConfig.minConfidence]}
                                        onValueChange={(e) =>
                                            handleConfigChange(section.setupKey, 'minConfidence', e[0]!)
                                        }
                                        min={MIN_CONFIDENCE}
                                        max={MAX_CONFIDENCE}
                                        step={CONFIDENCE_STEP}
                                        width="full"
                                    />
                                    <Text fontSize="sm" color="fg.muted" mt={1}>
                                        {setupConfig.minConfidence}%
                                    </Text>
                                </Field>
                            </Stack>
                        )}

                        <Separator mt={6} />
                    </Box>
                );
            })}

            <Box>
                <Text fontSize="sm" fontWeight="bold" mb={2}>
                    {t('setupConfig.summary.title')}
                </Text>
                <HStack gap={3}>
                    <Box bg="bg.muted" p={3} borderRadius="md" flex="1">
                        <Text fontSize="xs" color="fg.muted">
                            {t('setupConfig.summary.enabledSetups')}
                        </Text>
                        <Text fontSize="lg" fontWeight="bold">
                            {Object.entries(config).filter(([key, value]) =>
                                key !== 'enableTrendFilter' &&
                                key !== 'allowCounterTrend' &&
                                key !== 'trendEmaPeriod' &&
                                key !== 'setupCooldownPeriod' &&
                                (value as { enabled: boolean }).enabled
                            ).length}/{sections.length}
                        </Text>
                    </Box>
                    <Box bg="bg.muted" p={3} borderRadius="md" flex="1">
                        <Text fontSize="xs" color="fg.muted">
                            {t('setupConfig.summary.avgConfidence')}
                        </Text>
                        <Text fontSize="lg" fontWeight="bold">
                            {Math.round(
                                sections.reduce((sum, s) => sum + config[s.setupKey].minConfidence, 0) / sections.length
                            )}
                            %
                        </Text>
                    </Box>
                </HStack>
            </Box>
        </Stack>
    );
};
