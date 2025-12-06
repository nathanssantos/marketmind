import { useColorMode } from '@/renderer/components/ui/color-mode';
import { Badge, Box, Heading, Text } from '@chakra-ui/react';
import type { BacktestTrade } from '@shared/types/backtesting';
import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui/card';
import { Table } from '../ui/table';

interface TradeListTableProps {
    trades: BacktestTrade[];
}

const DECIMAL_PLACES = 2;
const MINUTES_PER_HOUR = 60;

export const TradeListTable = ({ trades }: TradeListTableProps): ReactElement => {
    const { t } = useTranslation();
    const { colorMode } = useColorMode();

    const positiveColor = useMemo(() => colorMode === 'dark' ? 'green.300' : 'green.500', [colorMode]);
    const negativeColor = useMemo(() => colorMode === 'dark' ? 'red.300' : 'red.500', [colorMode]);

    const formatCurrency = (value: number): string =>
        new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: DECIMAL_PLACES,
            maximumFractionDigits: DECIMAL_PLACES,
        }).format(value);

    const formatPercent = (value: number): string => `${value.toFixed(DECIMAL_PLACES)}%`;

    const formatDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const calculateDuration = (entry: string, exit?: string): string => {
        if (!exit) return 'N/A';
        const entryTime = new Date(entry).getTime();
        const exitTime = new Date(exit).getTime();
        const diffMs = exitTime - entryTime;
        const diffMins = Math.floor(diffMs / 1000 / MINUTES_PER_HOUR);
        const hours = Math.floor(diffMins / MINUTES_PER_HOUR);
        const mins = diffMins % MINUTES_PER_HOUR;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    return (
        <Card.Root>
            <Card.Header>
                <Heading size="md">{t('backtesting.trades.title')}</Heading>
                <Text fontSize="sm" color="gray.500" mt={1}>
                    {t('backtesting.trades.count', { count: trades.length })}
                </Text>
            </Card.Header>
            <Card.Body>
                <Box overflowX="auto">
                    <Table.Root size="sm" variant="outline">
                        <Table.Header>
                            <Table.Row>
                                <Table.ColumnHeader>{t('backtesting.trades.columns.side')}</Table.ColumnHeader>
                                <Table.ColumnHeader>{t('backtesting.trades.columns.setup')}</Table.ColumnHeader>
                                <Table.ColumnHeader>{t('backtesting.trades.columns.entry')}</Table.ColumnHeader>
                                <Table.ColumnHeader>{t('backtesting.trades.columns.exit')}</Table.ColumnHeader>
                                <Table.ColumnHeader>{t('backtesting.trades.columns.entryTime')}</Table.ColumnHeader>
                                <Table.ColumnHeader>{t('backtesting.trades.columns.exitTime')}</Table.ColumnHeader>
                                <Table.ColumnHeader>{t('backtesting.trades.columns.duration')}</Table.ColumnHeader>
                                <Table.ColumnHeader>{t('backtesting.trades.columns.pnl')}</Table.ColumnHeader>
                                <Table.ColumnHeader>{t('backtesting.trades.columns.pnlPercent')}</Table.ColumnHeader>
                                <Table.ColumnHeader>{t('backtesting.trades.columns.exitReason')}</Table.ColumnHeader>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {trades.map((trade, index) => {
                                const pnlColor = (trade.pnl ?? 0) > 0 ? positiveColor : negativeColor;
                                return (
                                    <Table.Row key={index}>
                                        <Table.Cell>
                                            <Badge colorScheme={trade.side === 'LONG' ? 'green' : 'red'}>
                                                {trade.side}
                                            </Badge>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Text fontSize="xs">{trade.setupType}</Text>
                                        </Table.Cell>
                                        <Table.Cell>{formatCurrency(trade.entryPrice)}</Table.Cell>
                                        <Table.Cell>
                                            {trade.exitPrice ? formatCurrency(trade.exitPrice) : '-'}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Text fontSize="xs">{formatDate(trade.entryTime)}</Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Text fontSize="xs">
                                                {trade.exitTime ? formatDate(trade.exitTime) : '-'}
                                            </Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Text fontSize="xs">
                                                {calculateDuration(trade.entryTime, trade.exitTime)}
                                            </Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Text color={pnlColor} fontWeight="medium">
                                                {trade.pnl !== undefined ? formatCurrency(trade.pnl) : '-'}
                                            </Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Text color={pnlColor} fontWeight="medium">
                                                {trade.pnlPercent !== undefined
                                                    ? formatPercent(trade.pnlPercent)
                                                    : '-'}
                                            </Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Badge
                                                colorScheme={
                                                    trade.exitReason === 'TAKE_PROFIT'
                                                        ? 'green'
                                                        : trade.exitReason === 'STOP_LOSS'
                                                            ? 'red'
                                                            : 'gray'
                                                }
                                                size="sm"
                                            >
                                                {trade.exitReason || 'OPEN'}
                                            </Badge>
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            })}
                        </Table.Body>
                    </Table.Root>
                </Box>
            </Card.Body>
        </Card.Root>
    );
};
