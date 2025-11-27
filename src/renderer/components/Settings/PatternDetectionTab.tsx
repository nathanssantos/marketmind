import { Field } from '@/renderer/components/ui/field';
import { Slider } from '@/renderer/components/ui/slider';
import { Switch } from '@/renderer/components/ui/switch';
import { usePatternDetectionConfigStore } from '@/renderer/store/patternDetectionConfigStore';
import { Box, Button, Grid, HStack, Separator, Stack, Text, VStack } from '@chakra-ui/react';
import type { AIStudyType } from '@shared/types';
import type React from 'react';
import { useTranslation } from 'react-i18next';

const PERCENT_MULTIPLIER = 100;
const MIN_CANDLES = 20;
const MAX_CANDLES = 200;
const CANDLES_STEP = 10;
const MIN_R2 = 50;
const MAX_VOLUME_WEIGHT = 50;
const CONFIDENCE_STEP = 5;
const VOLUME_STEP = 5;

interface PatternGroup {
    title: string;
    patterns: AIStudyType[];
}

const usePatternGroups = (): PatternGroup[] => {
    const { t } = useTranslation();

    return [
        {
            title: t('patternDetection.groups.reversalPatterns'),
            patterns: [
                'head-and-shoulders',
                'inverse-head-and-shoulders',
                'double-top',
                'double-bottom',
                'triple-top',
                'triple-bottom',
                'rounding-bottom',
            ],
        },
        {
            title: t('patternDetection.groups.continuationPatterns'),
            patterns: [
                'triangle-ascending',
                'triangle-descending',
                'triangle-symmetrical',
                'flag-bullish',
                'flag-bearish',
                'pennant',
                'cup-and-handle',
                'wedge-falling',
                'wedge-rising',
            ],
        },
        {
            title: t('patternDetection.groups.supportResistance'),
            patterns: ['support', 'resistance'],
        },
        {
            title: t('patternDetection.groups.zones'),
            patterns: ['buy-zone', 'sell-zone', 'liquidity-zone', 'accumulation-zone'],
        },
        {
            title: t('patternDetection.groups.gaps'),
            patterns: ['gap-common', 'gap-breakaway', 'gap-runaway', 'gap-exhaustion'],
        },
    ];
};

export const PatternDetectionTab = (): React.ReactElement => {
    const { t } = useTranslation();
    const { config, setConfig, resetToDefaults, togglePattern, isPatternEnabled } =
        usePatternDetectionConfigStore();
    const patternGroups = usePatternGroups();

    const getPatternLabel = (pattern: AIStudyType): string => t(`patternDetection.patterns.${pattern}`);

    const enabledCount = config.enabledPatterns.length;
    const totalPatterns = patternGroups.reduce((sum, group) => sum + group.patterns.length, 0);

    return (
        <VStack gap={6} align="stretch">
            <Box
                bg="blue.500/10"
                p={4}
                borderRadius="md"
                borderLeft="4px solid"
                borderColor="blue.500"
            >
                <Text fontSize="sm" fontWeight="semibold" mb={2}>
                    💡 {t('common.tips')}
                </Text>
                <Stack gap={1} fontSize="sm" color="fg.muted">
                    <Text>• {t('patternDetection.tips.sensitivity')}</Text>
                    <Text>• {t('patternDetection.tips.confidence')}</Text>
                    <Text>• {t('patternDetection.tips.period')}</Text>
                </Stack>
            </Box>

            <Box>
                <Button size="sm" variant="outline" onClick={resetToDefaults} width="full" colorPalette="red">
                    {t('patternDetection.resetDefaults')}
                </Button>
            </Box>

            <Separator />

            <Box>
                <Text fontSize="sm" fontWeight="bold" mb={4}>
                    {t('patternDetection.title')}
                </Text>
                <Stack gap={4}>
                    <Field label={t('patternDetection.sensitivity.label')} helperText={t('patternDetection.sensitivity.helper')}>
                        <Slider
                            value={[config.sensitivity]}
                            onValueChange={(e) => setConfig({ sensitivity: e[0]! })}
                            min={0}
                            max={PERCENT_MULTIPLIER}
                            step={1}
                            width="full"
                        />
                        <Text fontSize="sm" color="fg.muted" mt={1}>
                            {config.sensitivity}%
                        </Text>
                    </Field>

                    <Field
                        label={t('patternDetection.minConfidence.label')}
                        helperText={t('patternDetection.minConfidence.helper')}
                    >
                        <Slider
                            value={[config.minConfidence * PERCENT_MULTIPLIER]}
                            onValueChange={(e) =>
                                setConfig({ minConfidence: e[0]! / PERCENT_MULTIPLIER })
                            }
                            min={0}
                            max={PERCENT_MULTIPLIER}
                            step={CONFIDENCE_STEP}
                            width="full"
                        />
                        <Text fontSize="sm" color="fg.muted" mt={1}>
                            {Math.round(config.minConfidence * PERCENT_MULTIPLIER)}%
                        </Text>
                    </Field>

                    <Field
                        label={t('patternDetection.formationPeriod.label')}
                        helperText={t('patternDetection.formationPeriod.helper')}
                    >
                        <Slider
                            value={[config.formationPeriod]}
                            onValueChange={(e) => setConfig({ formationPeriod: e[0]! })}
                            min={MIN_CANDLES}
                            max={MAX_CANDLES}
                            step={CANDLES_STEP}
                            width="full"
                        />
                        <Text fontSize="sm" color="fg.muted" mt={1}>
                            {config.formationPeriod} {t('patternDetection.formationPeriod.candles')}
                        </Text>
                    </Field>

                    <Field
                        label={t('patternDetection.trendlineAccuracy.label')}
                        helperText={t('patternDetection.trendlineAccuracy.helper')}
                    >
                        <Slider
                            value={[config.trendlineR2Threshold * PERCENT_MULTIPLIER]}
                            onValueChange={(e) =>
                                setConfig({ trendlineR2Threshold: e[0]! / PERCENT_MULTIPLIER })
                            }
                            min={MIN_R2}
                            max={PERCENT_MULTIPLIER}
                            step={1}
                            width="full"
                        />
                        <Text fontSize="sm" color="fg.muted" mt={1}>
                            {Math.round(config.trendlineR2Threshold * PERCENT_MULTIPLIER)}%
                        </Text>
                    </Field>

                    <Field
                        label={t('patternDetection.volumeWeight.label')}
                        helperText={t('patternDetection.volumeWeight.helper')}
                    >
                        <Slider
                            value={[config.volumeConfirmationWeight * PERCENT_MULTIPLIER]}
                            onValueChange={(e) =>
                                setConfig({ volumeConfirmationWeight: e[0]! / PERCENT_MULTIPLIER })
                            }
                            min={0}
                            max={MAX_VOLUME_WEIGHT}
                            step={VOLUME_STEP}
                            width="full"
                        />
                        <Text fontSize="sm" color="fg.muted" mt={1}>
                            {Math.round(config.volumeConfirmationWeight * PERCENT_MULTIPLIER)}%
                        </Text>
                    </Field>
                </Stack>
            </Box>

            <Separator />

            <Box>
                <HStack justify="space-between" mb={4}>
                    <Text fontSize="sm" fontWeight="bold">{t('patternDetection.enabledPatterns')}</Text>
                    <Text fontSize="sm" color="fg.muted">
                        {enabledCount} / {totalPatterns} {t('patternDetection.enabled')}
                    </Text>
                </HStack>

                <VStack gap={6} align="stretch">
                    {patternGroups.map((group) => (
                        <Box key={group.title}>
                            <Text fontSize="xs" fontWeight="semibold" mb={3} color="fg.muted">
                                {group.title}
                            </Text>
                            <Grid templateColumns="repeat(auto-fill, minmax(250px, 1fr))" gap={3}>
                                {group.patterns.map((pattern) => (
                                    <HStack
                                        key={pattern}
                                        justify="space-between"
                                        p={2}
                                        borderRadius="md"
                                        bg="bg.subtle"
                                        _hover={{ bg: 'bg.muted' }}
                                    >
                                        <Text fontSize="sm">{getPatternLabel(pattern)}</Text>
                                        <Switch
                                            size="sm"
                                            checked={isPatternEnabled(pattern)}
                                            onCheckedChange={() => togglePattern(pattern)}
                                        />
                                    </HStack>
                                ))}
                            </Grid>
                        </Box>
                    ))}
                </VStack>
            </Box>

            <Separator />

            <Box>
                <Field>
                    <HStack justify="space-between">
                        <Box>
                            <Text fontWeight="medium">{t('patternDetection.showPreview.label')}</Text>
                            <Text fontSize="sm" color="fg.muted">
                                {t('patternDetection.showPreview.helper')}
                            </Text>
                        </Box>
                        <Switch
                            checked={config.showPreview}
                            onCheckedChange={(checked) => setConfig({ showPreview: checked })}
                        />
                    </HStack>
                </Field>
            </Box>
        </VStack>
    );
};
