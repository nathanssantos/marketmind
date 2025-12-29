import type { BacktestResult } from '@marketmind/types';
import { useColorMode } from '../components/ui/color-mode';

export const DECIMAL_PLACES = 2;
export const MINUTES_PER_HOUR = 60;
export const PERCENT_MULTIPLIER = 100;
export const DEFAULT_COMMISSION = 0.001;
export const DEFAULT_MAX_POSITION = 10;

export const PROFIT_FACTOR_EXCELLENT = 2;
export const PROFIT_FACTOR_GOOD = 1.5;
export const SHARPE_EXCELLENT = 2;
export const SHARPE_GOOD = 1;

export const formatCurrency = (value: number, decimals = DECIMAL_PLACES): string =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value);

export const formatPercent = (value: number, decimals = DECIMAL_PLACES): string =>
    `${value.toFixed(decimals)}%`;

export const formatNumber = (value: number, decimals = DECIMAL_PLACES): string =>
    value.toFixed(decimals);

export const formatDuration = (minutes: number, decimals = 1): string =>
    formatNumber(minutes / MINUTES_PER_HOUR, decimals);

export const getProfitFactorLabel = (profitFactor: number): 'excellent' | 'good' | 'fair' => {
    if (profitFactor >= PROFIT_FACTOR_EXCELLENT) return 'excellent';
    if (profitFactor >= PROFIT_FACTOR_GOOD) return 'good';
    return 'fair';
};

export const getSharpeRatioLabel = (sharpeRatio: number | null | undefined): 'excellent' | 'good' | 'fair' | null => {
    if (!sharpeRatio) return null;
    if (sharpeRatio >= SHARPE_EXCELLENT) return 'excellent';
    if (sharpeRatio >= SHARPE_GOOD) return 'good';
    return 'fair';
};

export const getCommissionPercent = (commission: number | undefined): string =>
    formatPercent((commission ?? DEFAULT_COMMISSION) * PERCENT_MULTIPLIER);

export const getMaxPositionSize = (maxPositionSize: number | undefined): number =>
    maxPositionSize ?? DEFAULT_MAX_POSITION;

export const getCommissionImpact = (totalCommission: number, initialCapital: number): string =>
    formatPercent((totalCommission / initialCapital) * PERCENT_MULTIPLIER);

export const getThemeColors = (colorMode: 'light' | 'dark') => ({
    positiveColor: colorMode === 'light' ? 'green.500' : 'green.300',
    negativeColor: colorMode === 'light' ? 'red.500' : 'red.300',
});

export const useBacktestMetrics = (result: BacktestResult) => {
    const { metrics, config } = result;

    const { colorMode } = useColorMode();
    const { positiveColor, negativeColor } = getThemeColors(colorMode);

    const isProfitable = metrics.totalPnl > 0;
    const pnlColor = isProfitable ? positiveColor : negativeColor;

    return {
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
        profitFactorLabel: getProfitFactorLabel(metrics.profitFactor),
        sharpeRatioLabel: getSharpeRatioLabel(metrics.sharpeRatio),
        commissionPercent: getCommissionPercent(config.commission),
        maxPositionSize: getMaxPositionSize(config.maxPositionSize),
        commissionImpact: getCommissionImpact(metrics.totalCommission, config.initialCapital),
    };
};
