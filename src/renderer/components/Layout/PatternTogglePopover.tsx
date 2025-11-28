import {
    Box,
    Flex,
    IconButton,
    Stack,
    Text,
} from '@chakra-ui/react';
import type { AIStudyType } from '@shared/types';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HiAdjustmentsHorizontal } from 'react-icons/hi2';
import { useUIStore } from '../../store/uiStore';
import { Checkbox } from '../ui/checkbox';
import { Popover } from '../ui/popover';
import { TooltipWrapper } from '../ui/Tooltip';

const PATTERN_CATEGORIES = {
    basic: [
        { value: 'support', labelKey: 'support' },
        { value: 'resistance', labelKey: 'resistance' },
    ],
    trendlines: [
        { value: 'trendline-bullish', labelKey: 'bullishTrendline' },
        { value: 'trendline-bearish', labelKey: 'bearishTrendline' },
    ],
    fibonacci: [
        { value: 'fibonacci-retracement', labelKey: 'fibonacciRetracement' },
        { value: 'fibonacci-extension', labelKey: 'fibonacciExtension' },
    ],
    channels: [
        { value: 'channel-ascending', labelKey: 'ascendingChannel' },
        { value: 'channel-descending', labelKey: 'descendingChannel' },
        { value: 'channel-horizontal', labelKey: 'horizontalChannel' },
    ],
    triangles: [
        { value: 'triangle-ascending', labelKey: 'ascendingTriangle' },
        { value: 'triangle-descending', labelKey: 'descendingTriangle' },
        { value: 'triangle-symmetrical', labelKey: 'symmetricalTriangle' },
    ],
    wedges: [
        { value: 'wedge-rising', labelKey: 'risingWedge' },
        { value: 'wedge-falling', labelKey: 'fallingWedge' },
    ],
    advanced: [
        { value: 'head-and-shoulders', labelKey: 'headAndShoulders' },
        { value: 'inverse-head-and-shoulders', labelKey: 'inverseHeadAndShoulders' },
        { value: 'double-top', labelKey: 'doubleTop' },
        { value: 'double-bottom', labelKey: 'doubleBottom' },
        { value: 'triple-top', labelKey: 'tripleTop' },
        { value: 'triple-bottom', labelKey: 'tripleBottom' },
    ],
    extra: [
        { value: 'flag-bullish', labelKey: 'flagBullish' },
        { value: 'flag-bearish', labelKey: 'flagBearish' },
        { value: 'pennant', labelKey: 'pennant' },
        { value: 'cup-and-handle', labelKey: 'cupAndHandle' },
        { value: 'rounding-bottom', labelKey: 'roundingBottom' },
        { value: 'gap-common', labelKey: 'gapCommon' },
        { value: 'gap-breakaway', labelKey: 'gapBreakaway' },
        { value: 'gap-runaway', labelKey: 'gapRunaway' },
        { value: 'gap-exhaustion', labelKey: 'gapExhaustion' },
        { value: 'liquidity-zone', labelKey: 'liquidityZone' },
        { value: 'sell-zone', labelKey: 'sellZone' },
        { value: 'buy-zone', labelKey: 'buyZone' },
        { value: 'accumulation-zone', labelKey: 'accumulationZone' },
    ],
} as const;

const CATEGORY_LABELS = {
    basic: 'basicPatterns',
    trendlines: 'trendlines',
    fibonacci: 'fibonacci',
    channels: 'channels',
    triangles: 'triangles',
    wedges: 'wedges',
    advanced: 'advancedPatterns',
    extra: 'extraPatterns',
} as const;

export const PatternTogglePopover = memo(() => {
    const { t } = useTranslation();
    const { algorithmicDetectionSettings, setAlgorithmicDetectionSettings } = useUIStore();
    const enabledPatterns = algorithmicDetectionSettings.enabledPatterns;
    const [isOpen, setIsOpen] = useState(false);

    const togglePattern = (pattern: AIStudyType) => {
        const currentPatterns = enabledPatterns || [];
        const isEnabled = currentPatterns.includes(pattern);

        const newPatterns = isEnabled
            ? currentPatterns.filter(p => p !== pattern)
            : [...currentPatterns, pattern];

        setAlgorithmicDetectionSettings({ enabledPatterns: newPatterns });
    };

    const toggleCategory = (category: keyof typeof PATTERN_CATEGORIES) => {
        const categoryPatterns = PATTERN_CATEGORIES[category].map(p => p.value as AIStudyType);
        const currentPatterns = enabledPatterns || [];
        const allEnabled = categoryPatterns.every(p => currentPatterns.includes(p));

        const newPatterns = allEnabled
            ? currentPatterns.filter(p => !categoryPatterns.includes(p))
            : [...new Set([...currentPatterns, ...categoryPatterns])];

        setAlgorithmicDetectionSettings({ enabledPatterns: newPatterns });
    };

    const isCategoryEnabled = (category: keyof typeof PATTERN_CATEGORIES) => {
        const categoryPatterns = PATTERN_CATEGORIES[category].map(p => p.value as AIStudyType);
        const currentPatterns = enabledPatterns || [];
        return categoryPatterns.every(p => currentPatterns.includes(p));
    };

    return (
        <Popover
            open={isOpen}
            onOpenChange={(e) => setIsOpen(e.open)}
            showArrow={false}
            width="300px"
            positioning={{ placement: 'bottom-start', offset: { mainAxis: 8 } }}
            trigger={
                <Flex>
                    <TooltipWrapper label={t('patterns.configurePatterns')} showArrow placement="top" isDisabled={isOpen}>
                        <IconButton
                            aria-label={t('patterns.configurePatterns')}
                            size="2xs"
                            variant="solid"
                            colorPalette="blue"
                        >
                            <HiAdjustmentsHorizontal />
                        </IconButton>
                    </TooltipWrapper>
                </Flex>
            }
        >
            <Box p={4} maxH="600px" overflowY="auto">
                <Stack gap={4}>
                    <Text fontSize="sm" fontWeight="bold">
                        {t('patterns.enabledPatterns')}
                    </Text>

                    {(Object.keys(PATTERN_CATEGORIES) as Array<keyof typeof PATTERN_CATEGORIES>).map((category) => (
                        <Box key={category}>
                            <Box mb={2}>
                                <Checkbox
                                    checked={isCategoryEnabled(category)}
                                    onCheckedChange={() => toggleCategory(category)}
                                >
                                    <Text fontWeight="semibold" fontSize="sm">
                                        {t(`patterns.${CATEGORY_LABELS[category]}`)}
                                    </Text>
                                </Checkbox>
                            </Box>
                            <Stack gap={1} pl={6}>
                                {PATTERN_CATEGORIES[category].map((pattern) => (
                                    <TooltipWrapper
                                        key={pattern.value}
                                        label={t(`patterns.${pattern.labelKey}Tooltip`)}
                                        placement="right"
                                        showArrow
                                    >
                                        <Box>
                                            <Checkbox
                                                checked={enabledPatterns?.includes(pattern.value as AIStudyType)}
                                                onCheckedChange={() => togglePattern(pattern.value as AIStudyType)}
                                            >
                                                <Text fontSize="sm">
                                                    {t(`patterns.${pattern.labelKey}`)}
                                                </Text>
                                            </Checkbox>
                                        </Box>
                                    </TooltipWrapper>
                                ))}
                            </Stack>
                        </Box>
                    ))}
                </Stack>
            </Box>
        </Popover>
    );
});

PatternTogglePopover.displayName = 'PatternTogglePopover';
