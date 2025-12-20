import { Box, Flex, IconButton, Stack, Text } from '@chakra-ui/react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuGauge } from 'react-icons/lu';
import type { MovingAverageConfig } from '../Chart/useMovingAverageRenderer';
import { Checkbox } from '../ui/checkbox';
import { Popover } from '../ui/popover';
import { TooltipWrapper } from '../ui/Tooltip';

interface IndicatorCategory {
    title: string;
    indicators: {
        id: string;
        label: string;
        isActive: boolean;
        onToggle: () => void;
    }[];
}

interface IndicatorTogglePopoverProps {
    showVolume: boolean;
    showStochastic: boolean;
    showRSI: boolean;
    showBollingerBands: boolean;
    showATR: boolean;
    showVWAP: boolean;
    movingAverages: MovingAverageConfig[];
    onShowVolumeChange: (show: boolean) => void;
    onShowStochasticChange: (show: boolean) => void;
    onShowRSIChange: (show: boolean) => void;
    onShowBollingerBandsChange: (show: boolean) => void;
    onShowATRChange: (show: boolean) => void;
    onShowVWAPChange: (show: boolean) => void;
    onMovingAverageToggle: (index: number) => void;
}

export const IndicatorTogglePopover = memo(
    ({
        showVolume,
        showStochastic,
        showRSI,
        showBollingerBands,
        showATR,
        showVWAP,
        movingAverages,
        onShowVolumeChange,
        onShowStochasticChange,
        onShowRSIChange,
        onShowBollingerBandsChange,
        onShowATRChange,
        onShowVWAPChange,
        onMovingAverageToggle,
    }: IndicatorTogglePopoverProps) => {
        const { t } = useTranslation();
        const [isOpen, setIsOpen] = useState(false);

        const categories: IndicatorCategory[] = useMemo(
            () => [
                {
                    title: t('chart.indicators.categories.oscillators'),
                    indicators: [
                        {
                            id: 'stochastic',
                            label: t('chart.controls.stochastic'),
                            isActive: showStochastic,
                            onToggle: () => onShowStochasticChange(!showStochastic),
                        },
                        {
                            id: 'rsi',
                            label: t('chart.controls.rsi'),
                            isActive: showRSI,
                            onToggle: () => onShowRSIChange(!showRSI),
                        },
                    ],
                },
                {
                    title: t('chart.indicators.categories.volatility'),
                    indicators: [
                        {
                            id: 'bollinger',
                            label: t('chart.controls.bollingerBands'),
                            isActive: showBollingerBands,
                            onToggle: () => onShowBollingerBandsChange(!showBollingerBands),
                        },
                        {
                            id: 'atr',
                            label: t('chart.controls.atr'),
                            isActive: showATR,
                            onToggle: () => onShowATRChange(!showATR),
                        },
                    ],
                },
                {
                    title: t('chart.indicators.categories.volume'),
                    indicators: [
                        {
                            id: 'volume',
                            label: t('chart.controls.volume'),
                            isActive: showVolume,
                            onToggle: () => onShowVolumeChange(!showVolume),
                        },
                        {
                            id: 'vwap',
                            label: t('chart.controls.vwap'),
                            isActive: showVWAP,
                            onToggle: () => onShowVWAPChange(!showVWAP),
                        },
                    ],
                },
                {
                    title: t('chart.indicators.categories.movingAverages'),
                    indicators: movingAverages.map((ma, index) => ({
                        id: `ma-${index}`,
                        label: `${ma.type === 'EMA' ? 'EMA' : 'SMA'}${ma.period}`,
                        isActive: ma.visible !== false,
                        onToggle: () => onMovingAverageToggle(index),
                    })),
                },
            ],
            [
                t,
                showVolume,
                showStochastic,
                showRSI,
                showBollingerBands,
                showATR,
                showVWAP,
                movingAverages,
                onShowVolumeChange,
                onShowStochasticChange,
                onShowRSIChange,
                onShowBollingerBandsChange,
                onShowATRChange,
                onShowVWAPChange,
                onMovingAverageToggle,
            ]
        );

        const toggleAll = useCallback((): void => {
            const allActive = categories.every((category) =>
                category.indicators.every((ind) => ind.isActive)
            );

            categories.forEach((category) => {
                category.indicators.forEach((ind) => {
                    if (allActive && ind.isActive) {
                        ind.onToggle();
                    } else if (!allActive && !ind.isActive) {
                        ind.onToggle();
                    }
                });
            });
        }, [categories]);

        const allActive = useMemo(
            () =>
                categories.every((category) =>
                    category.indicators.every((ind) => ind.isActive)
                ),
            [categories]
        );

        const activeCount = useMemo(
            () =>
                categories.reduce(
                    (sum, category) =>
                        sum + category.indicators.filter((ind) => ind.isActive).length,
                    0
                ),
            [categories]
        );

        const totalCount = useMemo(
            () =>
                categories.reduce(
                    (sum, category) => sum + category.indicators.length,
                    0
                ),
            [categories]
        );

        return (
            <Popover
                open={isOpen}
                onOpenChange={(e) => setIsOpen(e.open)}
                showArrow={false}
                width="320px"
                positioning={{ placement: 'bottom-start', offset: { mainAxis: 8 } }}
                trigger={
                    <Flex>
                        <TooltipWrapper
                            label={t('chart.indicators.configure')}
                            showArrow
                            placement="top"
                            isDisabled={isOpen}
                        >
                            <IconButton
                                aria-label={t('chart.indicators.configure')}
                                size="2xs"
                                variant="solid"
                                colorPalette="blue"
                            >
                                <LuGauge />
                            </IconButton>
                        </TooltipWrapper>
                    </Flex>
                }
            >
                <Box p={4} maxH="600px" overflowY="auto">
                    <Stack gap={4}>
                        <Flex justify="space-between" align="center">
                            <Text fontSize="sm" fontWeight="bold">
                                {t('chart.indicators.title')}
                            </Text>
                            <Text fontSize="xs" color="fg.muted">
                                {activeCount}/{totalCount}
                            </Text>
                        </Flex>

                        <Stack gap={4} maxH="500px" overflowY="auto">
                            {categories.map((category) => (
                                <Stack key={category.title} gap={2}>
                                    <Text
                                        fontSize="xs"
                                        fontWeight="bold"
                                        color="fg.muted"
                                        textTransform="uppercase"
                                        letterSpacing="wide"
                                    >
                                        {category.title}
                                    </Text>
                                    <Stack gap={1.5} pl={2}>
                                        {category.indicators.map((indicator) => (
                                            <Checkbox
                                                key={indicator.id}
                                                checked={indicator.isActive}
                                                onCheckedChange={indicator.onToggle}
                                            >
                                                <Text fontSize="sm">{indicator.label}</Text>
                                            </Checkbox>
                                        ))}
                                    </Stack>
                                </Stack>
                            ))}
                        </Stack>
                    </Stack>
                </Box>
            </Popover>
        );
    }
);

IndicatorTogglePopover.displayName = 'IndicatorTogglePopover';
