import { Box, Flex, IconButton, Stack, Text } from '@chakra-ui/react';
import { useIndicatorStore, type IndicatorId } from '@renderer/store';
import { memo, useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/shallow';
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
        const { activeIndicators, toggleIndicator } = useIndicatorStore(
            useShallow((s) => ({ activeIndicators: s.activeIndicators, toggleIndicator: s.toggleIndicator }))
        );

        const isIndicatorActive = useCallback(
            (id: IndicatorId): boolean => activeIndicators.includes(id),
            [activeIndicators]
        );

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
                        {
                            id: 'williamsR',
                            label: t('chart.indicators.names.williamsR', 'Williams %R'),
                            isActive: isIndicatorActive('williamsR'),
                            onToggle: () => toggleIndicator('williamsR'),
                        },
                        {
                            id: 'cci',
                            label: t('chart.indicators.names.cci', 'CCI'),
                            isActive: isIndicatorActive('cci'),
                            onToggle: () => toggleIndicator('cci'),
                        },
                        {
                            id: 'stochRsi',
                            label: t('chart.indicators.names.stochRsi', 'Stoch RSI'),
                            isActive: isIndicatorActive('stochRsi'),
                            onToggle: () => toggleIndicator('stochRsi'),
                        },
                        {
                            id: 'mfi',
                            label: t('chart.indicators.names.mfi', 'MFI'),
                            isActive: isIndicatorActive('mfi'),
                            onToggle: () => toggleIndicator('mfi'),
                        },
                        {
                            id: 'cmo',
                            label: t('chart.indicators.names.cmo', 'CMO'),
                            isActive: isIndicatorActive('cmo'),
                            onToggle: () => toggleIndicator('cmo'),
                        },
                        {
                            id: 'ultimateOsc',
                            label: t('chart.indicators.names.ultimateOsc', 'Ultimate Osc'),
                            isActive: isIndicatorActive('ultimateOsc'),
                            onToggle: () => toggleIndicator('ultimateOsc'),
                        },
                    ],
                },
                {
                    title: t('chart.indicators.categories.momentum'),
                    indicators: [
                        {
                            id: 'macd',
                            label: t('chart.indicators.names.macd', 'MACD'),
                            isActive: isIndicatorActive('macd'),
                            onToggle: () => toggleIndicator('macd'),
                        },
                        {
                            id: 'roc',
                            label: t('chart.indicators.names.roc', 'ROC'),
                            isActive: isIndicatorActive('roc'),
                            onToggle: () => toggleIndicator('roc'),
                        },
                        {
                            id: 'ao',
                            label: t('chart.indicators.names.ao', 'Awesome Osc'),
                            isActive: isIndicatorActive('ao'),
                            onToggle: () => toggleIndicator('ao'),
                        },
                        {
                            id: 'tsi',
                            label: t('chart.indicators.names.tsi', 'TSI'),
                            isActive: isIndicatorActive('tsi'),
                            onToggle: () => toggleIndicator('tsi'),
                        },
                        {
                            id: 'ppo',
                            label: t('chart.indicators.names.ppo', 'PPO'),
                            isActive: isIndicatorActive('ppo'),
                            onToggle: () => toggleIndicator('ppo'),
                        },
                    ],
                },
                {
                    title: t('chart.indicators.categories.trend'),
                    indicators: [
                        {
                            id: 'adx',
                            label: t('chart.indicators.names.adx', 'ADX'),
                            isActive: isIndicatorActive('adx'),
                            onToggle: () => toggleIndicator('adx'),
                        },
                        {
                            id: 'supertrend',
                            label: t('chart.indicators.names.supertrend', 'Supertrend'),
                            isActive: isIndicatorActive('supertrend'),
                            onToggle: () => toggleIndicator('supertrend'),
                        },
                        {
                            id: 'parabolicSar',
                            label: t('chart.indicators.names.parabolicSar', 'Parabolic SAR'),
                            isActive: isIndicatorActive('parabolicSar'),
                            onToggle: () => toggleIndicator('parabolicSar'),
                        },
                        {
                            id: 'aroon',
                            label: t('chart.indicators.names.aroon', 'Aroon'),
                            isActive: isIndicatorActive('aroon'),
                            onToggle: () => toggleIndicator('aroon'),
                        },
                        {
                            id: 'vortex',
                            label: t('chart.indicators.names.vortex', 'Vortex'),
                            isActive: isIndicatorActive('vortex'),
                            onToggle: () => toggleIndicator('vortex'),
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
                        {
                            id: 'keltner',
                            label: t('chart.indicators.names.keltner', 'Keltner'),
                            isActive: isIndicatorActive('keltner'),
                            onToggle: () => toggleIndicator('keltner'),
                        },
                        {
                            id: 'donchian',
                            label: t('chart.indicators.names.donchian', 'Donchian'),
                            isActive: isIndicatorActive('donchian'),
                            onToggle: () => toggleIndicator('donchian'),
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
                        {
                            id: 'obv',
                            label: t('chart.indicators.names.obv', 'OBV'),
                            isActive: isIndicatorActive('obv'),
                            onToggle: () => toggleIndicator('obv'),
                        },
                        {
                            id: 'cmf',
                            label: t('chart.indicators.names.cmf', 'CMF'),
                            isActive: isIndicatorActive('cmf'),
                            onToggle: () => toggleIndicator('cmf'),
                        },
                        {
                            id: 'klinger',
                            label: t('chart.indicators.names.klinger', 'Klinger'),
                            isActive: isIndicatorActive('klinger'),
                            onToggle: () => toggleIndicator('klinger'),
                        },
                        {
                            id: 'elderRay',
                            label: t('chart.indicators.names.elderRay', 'Elder Ray'),
                            isActive: isIndicatorActive('elderRay'),
                            onToggle: () => toggleIndicator('elderRay'),
                        },
                    ],
                },
                {
                    title: t('chart.indicators.categories.priceStructure'),
                    indicators: [
                        {
                            id: 'ichimoku',
                            label: t('chart.indicators.names.ichimoku', 'Ichimoku Cloud'),
                            isActive: isIndicatorActive('ichimoku'),
                            onToggle: () => toggleIndicator('ichimoku'),
                        },
                        {
                            id: 'pivotPoints',
                            label: t('chart.indicators.names.pivotPoints', 'Pivot Points'),
                            isActive: isIndicatorActive('pivotPoints'),
                            onToggle: () => toggleIndicator('pivotPoints'),
                        },
                        {
                            id: 'fibonacci',
                            label: t('chart.indicators.names.fibonacci', 'Fibonacci'),
                            isActive: isIndicatorActive('fibonacci'),
                            onToggle: () => toggleIndicator('fibonacci'),
                        },
                        {
                            id: 'fvg',
                            label: t('chart.indicators.names.fvg', 'FVG'),
                            isActive: isIndicatorActive('fvg'),
                            onToggle: () => toggleIndicator('fvg'),
                        },
                        {
                            id: 'liquidityLevels',
                            label: t('chart.indicators.names.liquidityLevels', 'Liquidity Levels'),
                            isActive: isIndicatorActive('liquidityLevels'),
                            onToggle: () => toggleIndicator('liquidityLevels'),
                        },
                    ],
                },
                {
                    title: t('chart.indicators.categories.movingAverages'),
                    indicators: [
                        ...movingAverages.map((ma, index) => ({
                            id: `ma-${index}`,
                            label: `${ma.type === 'EMA' ? 'EMA' : 'SMA'}${ma.period}`,
                            isActive: ma.visible !== false,
                            onToggle: () => onMovingAverageToggle(index),
                        })),
                        {
                            id: 'dema',
                            label: t('chart.indicators.names.dema', 'DEMA'),
                            isActive: isIndicatorActive('dema'),
                            onToggle: () => toggleIndicator('dema'),
                        },
                        {
                            id: 'tema',
                            label: t('chart.indicators.names.tema', 'TEMA'),
                            isActive: isIndicatorActive('tema'),
                            onToggle: () => toggleIndicator('tema'),
                        },
                        {
                            id: 'wma',
                            label: t('chart.indicators.names.wma', 'WMA'),
                            isActive: isIndicatorActive('wma'),
                            onToggle: () => toggleIndicator('wma'),
                        },
                        {
                            id: 'hma',
                            label: t('chart.indicators.names.hma', 'HMA'),
                            isActive: isIndicatorActive('hma'),
                            onToggle: () => toggleIndicator('hma'),
                        },
                    ],
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
                isIndicatorActive,
                onShowVolumeChange,
                onShowStochasticChange,
                onShowRSIChange,
                onShowBollingerBandsChange,
                onShowATRChange,
                onShowVWAPChange,
                onMovingAverageToggle,
                toggleIndicator,
            ]
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
