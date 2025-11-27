import { Box, CloseButton, Flex, Stack, Text, useToken } from '@chakra-ui/react';
import {
    Dialog,
} from '@renderer/components/ui/dialog';
import { useTradingStore } from '@renderer/store/tradingStore';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface WalletPerformanceDialogProps {
    isOpen: boolean;
    onClose: () => void;
    walletId: string | null;
}

export const WalletPerformanceDialog = ({ isOpen, onClose, walletId }: WalletPerformanceDialogProps) => {
    const { t } = useTranslation();
    const wallets = useTradingStore((state) => state.wallets);
    const wallet = wallets.find(w => w.id === walletId);

    const [
        chartPrimary,
        chartSecondary,
        chartGrid,
        chartTextMuted,
    ] = useToken('colors', [
        'chart.line.default',
        'fg.muted',
        'chart.grid',
        'chart.axis.label',
    ]);

    if (!wallet) return null;

    const chartData = wallet.performance.map(p => ({
        date: new Date(p.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        balance: p.balance,
        initialBalance: wallet.initialBalance,
        pnl: p.pnl,
    }));

    const formatCurrency = (value: number) => {
        return `${wallet.currency} ${value.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    };

    const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { date: string } }> }) => {
        if (active && payload && payload.length >= 2) {
            return (
                <Box p={2} bg="bg.panel" borderRadius="md" borderWidth="1px" borderColor="border">
                    <Text fontSize="xs" fontWeight="medium" mb={1}>{payload[0]?.payload.date}</Text>
                    <Stack gap={0.5} fontSize="xs">
                        <Text style={{ color: chartPrimary }}>
                            {t('trading.wallets.balance')}: {formatCurrency(payload[0]?.value ?? 0)}
                        </Text>
                        <Text color="fg.muted">
                            {t('trading.wallets.initialBalance')}: {formatCurrency(payload[1]?.value ?? 0)}
                        </Text>
                    </Stack>
                </Box>
            );
        }
        return null;
    };

    const totalPnL = wallet.balance - wallet.initialBalance;
    const totalPnLPercent = ((totalPnL / wallet.initialBalance) * 100);
    const isProfitable = totalPnL >= 0;

    const tradeDays = Math.max(1, Math.ceil((Date.now() - new Date(wallet.createdAt).getTime()) / (1000 * 60 * 60 * 24)));
    const avgDailyReturn = tradeDays > 1 && wallet.performance[0] && wallet.performance[wallet.performance.length - 1]
        ? (wallet.performance[wallet.performance.length - 1]!.balance - wallet.performance[0].balance) / tradeDays
        : 0;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="xl">
            <Dialog.Backdrop />
            <Dialog.Positioner>
                <Dialog.Content maxH="85vh">
                    <CloseButton
                        position="absolute"
                        top={4}
                        right={4}
                        onClick={onClose}
                        size="sm"
                    />
                    <Dialog.Header>
                        <Dialog.Title>{t('trading.wallets.performanceTitle', { name: wallet.name })}</Dialog.Title>
                    </Dialog.Header>

                    <Dialog.Body overflowY="auto">
                        <Stack gap={4}>
                            <Flex wrap="wrap" gap={2}>
                                <Box flex="1" minW="180px" p={3} bg="bg.muted" borderRadius="md">
                                    <Text fontSize="xs" color="fg.muted" mb={1}>{t('trading.wallets.currentBalance')}</Text>
                                    <Text fontSize="md" fontWeight="bold">
                                        {wallet.currency} {wallet.balance.toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })}
                                    </Text>
                                </Box>

                                <Box flex="1" minW="180px" p={3} bg="bg.muted" borderRadius="md">
                                    <Text fontSize="xs" color="fg.muted" mb={1}>{t('trading.wallets.totalPnL')}</Text>
                                    <Text
                                        fontSize="md"
                                        fontWeight="bold"
                                        color={isProfitable ? 'green.500' : 'red.500'}
                                    >
                                        {isProfitable ? '+' : ''}{totalPnL.toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })}
                                        {' '}({isProfitable ? '+' : ''}{totalPnLPercent.toFixed(2)}%)
                                    </Text>
                                </Box>

                                <Box flex="1" minW="180px" p={3} bg="bg.muted" borderRadius="md">
                                    <Text fontSize="xs" color="fg.muted" mb={1}>{t('trading.wallets.tradeDays')}</Text>
                                    <Text fontSize="md" fontWeight="bold">{tradeDays}</Text>
                                </Box>

                                <Box flex="1" minW="180px" p={3} bg="bg.muted" borderRadius="md">
                                    <Text fontSize="xs" color="fg.muted" mb={1}>{t('trading.wallets.avgDailyReturn')}</Text>
                                    <Text fontSize="md" fontWeight="bold">
                                        {wallet.currency} {avgDailyReturn.toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })}
                                    </Text>
                                </Box>
                            </Flex>

                            {chartData.length > 0 && (
                                <Box h="400px">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                                            <XAxis
                                                dataKey="date"
                                                style={{ fontSize: '12px', fill: chartTextMuted }}
                                            />
                                            <YAxis
                                                tickFormatter={(value) => `${wallet.currency} ${value.toLocaleString()}`}
                                                style={{ fontSize: '12px', fill: chartTextMuted }}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                                            <defs>
                                                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={chartPrimary} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={chartPrimary} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <Area
                                                type="monotone"
                                                dataKey="balance"
                                                stroke={chartPrimary}
                                                fillOpacity={1}
                                                fill="url(#colorBalance)"
                                                name={t('trading.wallets.balance')}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="initialBalance"
                                                stroke={chartSecondary}
                                                strokeDasharray="5 5"
                                                dot={false}
                                                name={t('trading.wallets.initialBalance')}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </Box>
                            )}
                        </Stack>
                    </Dialog.Body>
                </Dialog.Content>
            </Dialog.Positioner>
        </Dialog.Root>
    );
};
