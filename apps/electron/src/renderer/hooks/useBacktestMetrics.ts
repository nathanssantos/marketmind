import type { BacktestResult } from '@marketmind/types';
import { useColorMode } from '../components/ui/color-mode';

const DECIMAL_PLACES = 2;
const MINUTES_PER_HOUR = 60;
const PERCENT_MULTIPLIER = 100;
const DEFAULT_COMMISSION = 0.001;
const DEFAULT_MAX_POSITION = 10;

const PROFIT_FACTOR_EXCELLENT = 2;
const PROFIT_FACTOR_GOOD = 1.5;
const SHARPE_EXCELLENT = 2;
const SHARPE_GOOD = 1;

export const useBacktestMetrics = (result: BacktestResult) => {
    const { metrics, config } = result;

    const { colorMode } = useColorMode();
    const positiveColor = colorMode === 'light' ? 'green.500' : 'green.300';
    const negativeColor = colorMode === 'light' ? 'red.500' : 'red.300';

    const isProfitable = metrics.totalPnl > 0;
    const pnlColor = isProfitable ? positiveColor : negativeColor;

    const formatCurrency = (value: number): string =>
        new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: DECIMAL_PLACES,
            maximumFractionDigits: DECIMAL_PLACES,
        }).format(value);

    const formatPercent = (value: number): string => `${value.toFixed(DECIMAL_PLACES)}%`;

    const formatNumber = (value: number, decimals = DECIMAL_PLACES): string => value.toFixed(decimals);

    const formatDuration = (minutes: number): string =>
        formatNumber(minutes / MINUTES_PER_HOUR, 1);

    const getProfitFactorLabel = (): 'excellent' | 'good' | 'fair' => {
        if (metrics.profitFactor >= PROFIT_FACTOR_EXCELLENT) return 'excellent';
        if (metrics.profitFactor >= PROFIT_FACTOR_GOOD) return 'good';
        return 'fair';
    };

    const getSharpeRatioLabel = (): 'excellent' | 'good' | 'fair' | null => {
        if (!metrics.sharpeRatio) return null;
        if (metrics.sharpeRatio >= SHARPE_EXCELLENT) return 'excellent';
        if (metrics.sharpeRatio >= SHARPE_GOOD) return 'good';
        return 'fair';
    };

    const getCommissionPercent = (): string =>
        formatPercent((config.commission ?? DEFAULT_COMMISSION) * PERCENT_MULTIPLIER);

    const getMaxPositionSize = (): number => config.maxPositionSize ?? DEFAULT_MAX_POSITION;

    const getCommissionImpact = (): string =>
        formatPercent((metrics.totalCommission / config.initialCapital) * PERCENT_MULTIPLIER);

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
        profitFactorLabel: getProfitFactorLabel(),
        sharpeRatioLabel: getSharpeRatioLabel(),
        commissionPercent: getCommissionPercent(),
        maxPositionSize: getMaxPositionSize(),
        commissionImpact: getCommissionImpact(),
    };
};
