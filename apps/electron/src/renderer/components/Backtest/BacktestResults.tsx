import { Badge, Box, Grid, Heading, HStack, Separator, Stack, Text } from '@chakra-ui/react';
import type { BacktestResult } from '@marketmind/types';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useBacktestMetrics } from '../../hooks/useBacktestMetrics';
import { Card } from '../ui/card';
import { Stat, StatRow } from '../ui/stat';

interface BacktestResultsProps {
    result: BacktestResult;
}

const getBadgeColor = (label: 'excellent' | 'good' | 'fair'): string => {
    switch (label) {
        case 'excellent':
            return 'green';
        case 'good':
            return 'blue';
        case 'fair':
            return 'orange';
    }
};

export const BacktestResults = ({ result }: BacktestResultsProps): ReactElement => {
    const { t } = useTranslation();
    const {
        metrics,
        config,
        formatCurrency,
        formatPercent,
        formatNumber,
        formatDuration,
        isProfitable,
        pnlColor,
        positiveColor,
        negativeColor,
        profitFactorLabel,
        sharpeRatioLabel,
        commissionPercent,
        maxPositionSize,
        commissionImpact,
    } = useBacktestMetrics(result);

    return (
        <Stack gap={4} w="full">
            <Card.Root>
                <Card.Header>
                    <Heading size="md">{t('backtesting.results.title')}</Heading>
                    <Text fontSize="sm" color="gray.500" mt={1}>
                        {config.symbol} • {config.interval} • {config.startDate} {t('common.to')}{' '}
                        {config.endDate}
                    </Text>
                </Card.Header>
                <Card.Body>
                    <Stack gap={4}>
                        <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4}>
                            <Stat
                                label={t('backtesting.metrics.totalPnl')}
                                value={formatCurrency(metrics.totalPnl)}
                                valueColor={pnlColor}
                                helpText={
                                    <HStack gap={1}>
                                        <Text color={pnlColor}>{isProfitable ? '↑' : '↓'}</Text>
                                        <Text>{formatPercent(metrics.totalPnlPercent)}</Text>
                                    </HStack>
                                }
                            />

                            <Stat
                                label={t('backtesting.metrics.winRate')}
                                value={formatPercent(metrics.winRate)}
                                helpText={`${metrics.winningTrades}${t('backtesting.metrics.wins')} / ${metrics.losingTrades}${t('backtesting.metrics.losses')}`}
                            />

                            <Stat
                                label={t('backtesting.metrics.profitFactor')}
                                value={
                                    metrics.profitFactor === Infinity
                                        ? '∞'
                                        : formatNumber(metrics.profitFactor)
                                }
                                helpText={
                                    <Badge colorScheme={getBadgeColor(profitFactorLabel)}>
                                        {t(`backtesting.quality.${profitFactorLabel}`)}
                                    </Badge>
                                }
                            />

                            <Stat
                                label={t('backtesting.metrics.totalTrades')}
                                value={metrics.totalTrades}
                                helpText={`${t('backtesting.metrics.avgDuration')}: ${formatDuration(metrics.avgTradeDuration)}${t('common.hours')}`}
                            />
                        </Grid>

                        <Separator />

                        <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4}>
                            <Stat
                                label={t('backtesting.metrics.avgWin')}
                                value={formatCurrency(metrics.avgWin)}
                                valueColor={positiveColor}
                                helpText={`${t('backtesting.metrics.duration')}: ${formatDuration(metrics.avgWinDuration)}${t('common.hours')}`}
                            />

                            <Stat
                                label={t('backtesting.metrics.avgLoss')}
                                value={formatCurrency(metrics.avgLoss)}
                                valueColor={negativeColor}
                                helpText={`${t('backtesting.metrics.duration')}: ${formatDuration(metrics.avgLossDuration)}${t('common.hours')}`}
                            />

                            <Stat
                                label={t('backtesting.metrics.largestWin')}
                                value={formatCurrency(metrics.largestWin)}
                                valueColor={positiveColor}
                            />

                            <Stat
                                label={t('backtesting.metrics.largestLoss')}
                                value={formatCurrency(metrics.largestLoss)}
                                valueColor={negativeColor}
                            />
                        </Grid>

                        <Separator />

                        <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4}>
                            <Stat
                                label={t('backtesting.metrics.maxDrawdown')}
                                value={formatCurrency(metrics.maxDrawdown)}
                                valueColor={negativeColor}
                                helpText={formatPercent(metrics.maxDrawdownPercent)}
                            />

                            <Stat
                                label={t('backtesting.metrics.sharpeRatio')}
                                value={metrics.sharpeRatio ? formatNumber(metrics.sharpeRatio) : 'N/A'}
                                helpText={
                                    sharpeRatioLabel ? (
                                        <Badge colorScheme={getBadgeColor(sharpeRatioLabel)}>
                                            {t(`backtesting.quality.${sharpeRatioLabel}`)}
                                        </Badge>
                                    ) : undefined
                                }
                            />

                            <Stat
                                label={t('backtesting.metrics.sortinoRatio')}
                                value={metrics.sortinoRatio ? formatNumber(metrics.sortinoRatio) : 'N/A'}
                                helpText={t('backtesting.metrics.downsideRisk')}
                            />

                            <Stat
                                label={t('backtesting.metrics.totalCommission')}
                                value={formatCurrency(metrics.totalCommission)}
                                valueColor={negativeColor}
                                helpText={commissionImpact}
                            />
                        </Grid>

                        <Separator />

                        <Box>
                            <Text fontWeight="bold" fontSize="sm" mb={2}>
                                {t('backtesting.configuration.title')}:
                            </Text>
                            <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={2}>
                                <StatRow
                                    label={t('backtesting.configuration.initialCapital')}
                                    value={formatCurrency(config.initialCapital)}
                                />
                                <StatRow
                                    label={t('backtesting.configuration.maxPosition')}
                                    value={`${maxPositionSize}%`}
                                />
                                <StatRow
                                    label={t('backtesting.configuration.commission')}
                                    value={commissionPercent}
                                />
                                {config.setupTypes && config.setupTypes.length > 0 && (
                                    <StatRow
                                        label={t('backtesting.configuration.setups')}
                                        value={config.setupTypes.join(', ')}
                                    />
                                )}
                            </Grid>
                        </Box>
                    </Stack>
                </Card.Body>
            </Card.Root>
        </Stack>
    );
};
