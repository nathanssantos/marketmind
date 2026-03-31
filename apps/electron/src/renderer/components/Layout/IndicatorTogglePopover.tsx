import { Checkbox, IconButton, Popover, TooltipWrapper } from '@renderer/components/ui';
import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import { useIndicatorStore, DEFAULT_INDICATOR_PARAMS, type IndicatorId, type MAParams } from '@renderer/store';
import { memo, useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useTranslation } from 'react-i18next';
import { LuGauge } from 'react-icons/lu';

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
    activeIndicatorsOverride?: string[];
    onToggleIndicatorOverride?: (id: IndicatorId) => void;
}

export const IndicatorTogglePopover = memo(
    ({
        activeIndicatorsOverride,
        onToggleIndicatorOverride,
    }: IndicatorTogglePopoverProps) => {
        const { t } = useTranslation();
        const [isOpen, setIsOpen] = useState(false);
        const storeState = useIndicatorStore(
            useShallow((s) => ({ activeIndicators: s.activeIndicators, toggleIndicator: s.toggleIndicator }))
        );

        const activeIndicators = activeIndicatorsOverride ?? storeState.activeIndicators;
        const toggleIndicator = onToggleIndicatorOverride ?? storeState.toggleIndicator;

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
                            isActive: isIndicatorActive('stochastic'),
                            onToggle: () => toggleIndicator('stochastic'),
                        },
                        {
                            id: 'rsi',
                            label: t('chart.controls.rsi'),
                            isActive: isIndicatorActive('rsi'),
                            onToggle: () => toggleIndicator('rsi'),
                        },
                        {
                            id: 'rsi14',
                            label: t('chart.controls.rsi14'),
                            isActive: isIndicatorActive('rsi14'),
                            onToggle: () => toggleIndicator('rsi14'),
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
                            id: 'bollingerBands',
                            label: t('chart.controls.bollingerBands'),
                            isActive: isIndicatorActive('bollingerBands'),
                            onToggle: () => toggleIndicator('bollingerBands'),
                        },
                        {
                            id: 'atr',
                            label: t('chart.controls.atr'),
                            isActive: isIndicatorActive('atr'),
                            onToggle: () => toggleIndicator('atr'),
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
                            isActive: isIndicatorActive('volume'),
                            onToggle: () => toggleIndicator('volume'),
                        },
                        {
                            id: 'dailyVwap',
                            label: t('chart.controls.dailyVwap'),
                            isActive: isIndicatorActive('dailyVwap'),
                            onToggle: () => toggleIndicator('dailyVwap'),
                        },
                        {
                            id: 'weeklyVwap',
                            label: t('chart.controls.weeklyVwap'),
                            isActive: isIndicatorActive('weeklyVwap'),
                            onToggle: () => toggleIndicator('weeklyVwap'),
                        },
                        {
                            id: 'vwap',
                            label: t('chart.controls.vwap'),
                            isActive: isIndicatorActive('vwap'),
                            onToggle: () => toggleIndicator('vwap'),
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
                        {
                            id: 'activityIndicator',
                            label: t('chart.indicators.names.activityIndicator', 'Activity Indicator'),
                            isActive: isIndicatorActive('activityIndicator'),
                            onToggle: () => toggleIndicator('activityIndicator'),
                        },
                    ],
                },
                {
                    title: t('chart.indicators.categories.movingAverages'),
                    indicators: [
                        ...(['ema-7', 'ema-8', 'ema-9', 'ema-10', 'ema-19', 'ema-20', 'ema-21', 'ema-50', 'ema-70', 'ema-100', 'ema-200'] as const).map(id => {
                            const params = DEFAULT_INDICATOR_PARAMS[id] as MAParams;
                            return {
                                id,
                                label: `${params.type}${params.period}`,
                                isActive: isIndicatorActive(id),
                                onToggle: () => toggleIndicator(id),
                            };
                        }),
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
                {
                    title: t('chart.indicators.categories.orderFlow', 'Order Flow'),
                    indicators: [
                        {
                            id: 'liquidityHeatmap',
                            label: t('chart.indicators.names.liquidityHeatmap', 'Liquidity Heatmap'),
                            isActive: isIndicatorActive('liquidityHeatmap'),
                            onToggle: () => toggleIndicator('liquidityHeatmap'),
                        },
                        {
                            id: 'liquidationMarkers',
                            label: t('chart.indicators.names.liquidationMarkers', 'Liquidation Markers'),
                            isActive: isIndicatorActive('liquidationMarkers'),
                            onToggle: () => toggleIndicator('liquidationMarkers'),
                        },
                    ],
                },
            ],
            [
                t,
                isIndicatorActive,
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
                positioning={{ placement: 'right-start', offset: { mainAxis: 8 } }}
                trigger={
                    <Flex>
                        <TooltipWrapper
                            label={t('chart.indicators.configure')}
                            showArrow
                            placement="right"
                            isDisabled={isOpen}
                        >
                            <IconButton
                                aria-label={t('chart.indicators.configure')}
                                size="2xs"
                                variant="outline"
                                color="fg.muted"
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
