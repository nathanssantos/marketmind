import { Field } from '@/renderer/components/ui/field';
import { Select } from '@/renderer/components/ui/select';
import { Slider } from '@/renderer/components/ui/slider';
import { Switch } from '@/renderer/components/ui/switch';
import { usePatternDetectionConfigStore } from '@/renderer/store/patternDetectionConfigStore';
import { useUIStore, type PatternDetectionMode } from '@/renderer/store/uiStore';
import { Box, Button, Grid, HStack, Separator, Stack, Text, VStack } from '@chakra-ui/react';
import type { AIPatternType } from '@marketmind/types';
import type React from 'react';
import { useTranslation } from 'react-i18next';

const PERCENT_MULTIPLIER = 100;
const MIN_KLINES = 20;
const MAX_KLINES = 200;
const KLINES_STEP = 10;
const MIN_R2 = 50;
const MAX_VOLUME_WEIGHT = 50;
const CONFIDENCE_STEP = 5;
const VOLUME_STEP = 5;
const MIN_PATTERNS = 5;
const MAX_PATTERNS = 50;
const PATTERNS_STEP = 5;
const MIN_OVERLAP = 30;
const MAX_OVERLAP = 90;
const OVERLAP_STEP = 5;

interface PatternGroup {
    title: string;
    patterns: AIPatternType[];
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
    const { patternDetectionMode, setPatternDetectionMode } = useUIStore();
    const patternGroups = usePatternGroups();

    const getPatternLabel = (pattern: AIPatternType): string => t(`patternDetection.patterns.${pattern}`);

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
                    {t('common.tips')}
                </Text>
                <Stack gap={1} fontSize="sm" color="fg.muted">
                    <Text>{t('patternDetection.tips.sensitivity')}</Text>
                    <Text>{t('patternDetection.tips.confidence')}</Text>
                    <Text>{t('patternDetection.tips.period')}</Text>
                </Stack>
            </Box>

            <Box>
                <Field label={t('patternDetection.mode.label')} helperText={t('patternDetection.mode.helper')}>
                    <Select
                        value={patternDetectionMode}
                        onChange={(value) => setPatternDetectionMode(value as PatternDetectionMode)}
                        options={[
                            { value: 'ai-only', label: t('patternDetection.mode.aiOnly') },
                            { value: 'algorithmic-only', label: t('patternDetection.mode.algorithmicOnly') },
                            { value: 'hybrid', label: t('patternDetection.mode.hybrid') },
                        ]}
                        usePortal={false}
                    />
                </Field>
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
                            min={MIN_KLINES}
                            max={MAX_KLINES}
                            step={KLINES_STEP}
                            width="full"
                        />
                        <Text fontSize="sm" color="fg.muted" mt={1}>
                            {config.formationPeriod} {t('patternDetection.formationPeriod.klines')}
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
                <Text fontSize="sm" fontWeight="bold" mb={4}>
                    {t('patternDetection.filtering.title')}
                </Text>
                <Stack gap={4}>
                    <Field
                        label={t('patternDetection.filtering.maxPatterns.label')}
                        helperText={t('patternDetection.filtering.maxPatterns.helper')}
                    >
                        <Slider
                            value={[config.maxPatternsTotal]}
                            onValueChange={(e) => setConfig({ maxPatternsTotal: e[0]! })}
                            min={MIN_PATTERNS}
                            max={MAX_PATTERNS}
                            step={PATTERNS_STEP}
                            width="full"
                        />
                        <Text fontSize="sm" color="fg.muted" mt={1}>
                            {config.maxPatternsTotal} {t('patternDetection.filtering.maxPatterns.patterns')}
                        </Text>
                    </Field>

                    <Field>
                        <HStack justify="space-between">
                            <Box>
                                <Text fontWeight="medium">{t('patternDetection.filtering.enableNested.label')}</Text>
                                <Text fontSize="sm" color="fg.muted">
                                    {t('patternDetection.filtering.enableNested.helper')}
                                </Text>
                            </Box>
                            <Switch
                                checked={config.enableNestedFiltering}
                                onCheckedChange={(checked) => setConfig({ enableNestedFiltering: !!checked })}
                            />
                        </HStack>
                    </Field>

                    <Field>
                        <HStack justify="space-between">
                            <Box>
                                <Text fontWeight="medium">{t('patternDetection.filtering.enableOverlap.label')}</Text>
                                <Text fontSize="sm" color="fg.muted">
                                    {t('patternDetection.filtering.enableOverlap.helper')}
                                </Text>
                            </Box>
                            <Switch
                                checked={config.enableOverlapFiltering}
                                onCheckedChange={(checked) => setConfig({ enableOverlapFiltering: !!checked })}
                            />
                        </HStack>
                    </Field>

                    {config.enableOverlapFiltering && (
                        <Field
                            label={t('patternDetection.filtering.overlapThreshold.label')}
                            helperText={t('patternDetection.filtering.overlapThreshold.helper')}
                        >
                            <Slider
                                value={[config.overlapThreshold * PERCENT_MULTIPLIER]}
                                onValueChange={(e) =>
                                    setConfig({ overlapThreshold: e[0]! / PERCENT_MULTIPLIER })
                                }
                                min={MIN_OVERLAP}
                                max={MAX_OVERLAP}
                                step={OVERLAP_STEP}
                                width="full"
                            />
                            <Text fontSize="sm" color="fg.muted" mt={1}>
                                {Math.round(config.overlapThreshold * PERCENT_MULTIPLIER)}%
                            </Text>
                        </Field>
                    )}

                    <Field>
                        <HStack justify="space-between">
                            <Box>
                                <Text fontWeight="medium">{t('patternDetection.filtering.highlightConflicts.label')}</Text>
                                <Text fontSize="sm" color="fg.muted">
                                    {t('patternDetection.filtering.highlightConflicts.helper')}
                                </Text>
                            </Box>
                            <Switch
                                checked={config.highlightConflicts}
                                onCheckedChange={(checked) => setConfig({ highlightConflicts: !!checked })}
                            />
                        </HStack>
                    </Field>

                    <Field>
                        <HStack justify="space-between">
                            <Box>
                                <Text fontWeight="medium">{t('patternDetection.filtering.showChannelCenterline.label')}</Text>
                                <Text fontSize="sm" color="fg.muted">
                                    {t('patternDetection.filtering.showChannelCenterline.helper')}
                                </Text>
                            </Box>
                            <Switch
                                checked={config.showChannelCenterline}
                                onCheckedChange={(checked) => setConfig({ showChannelCenterline: !!checked })}
                            />
                        </HStack>
                    </Field>
                </Stack>
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
                            onCheckedChange={(checked) => setConfig({ showPreview: !!checked })}
                        />
                    </HStack>
                </Field>
            </Box>
        </VStack>
    );
};
