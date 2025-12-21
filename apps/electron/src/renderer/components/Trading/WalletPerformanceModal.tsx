import {
  Box,
  CloseButton,
  Flex,
  Grid,
  GridItem,
  Spinner,
  Stack,
  Text,
  useToken,
} from '@chakra-ui/react';
import { Dialog } from '@renderer/components/ui/dialog';
import { useBackendAnalytics } from '@renderer/hooks/useBackendAnalytics';
import { useBackendWallet } from '@renderer/hooks/useBackendWallet';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface WalletPerformanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletId: string | null;
}

export const WalletPerformanceModal = ({
  isOpen,
  onClose,
  walletId,
}: WalletPerformanceModalProps) => {
  const { t } = useTranslation();
  const { wallets } = useBackendWallet();
  const backendWallet = wallets.find((w) => w.id === walletId);
  const { performance, equityCurve, isLoading } = useBackendAnalytics(walletId || '', 'all');

  const [chartPrimary, chartSecondary, chartGrid, chartTextMuted] = useToken('colors', [
    'chart.line.default',
    'fg.muted',
    'chart.grid',
    'chart.axis.label',
  ]);

  if (!walletId || !backendWallet) return null;

  const wallet = {
    id: backendWallet.id,
    name: backendWallet.name,
    balance: parseFloat(backendWallet.currentBalance || '0'),
    initialBalance: parseFloat(backendWallet.initialBalance || '0'),
    currency: (backendWallet.currency || 'USDT') as string,
    createdAt: new Date(backendWallet.createdAt),
  };

  const totalPnL = wallet.balance - wallet.initialBalance;
  const totalPnLPercent = wallet.initialBalance > 0 ? (totalPnL / wallet.initialBalance) * 100 : 0;

  const formatCurrency = (value: number, showSign = false) => {
    const sign = showSign && value >= 0 ? '+' : '';
    return `${sign}${wallet.currency} ${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatPercent = (value: number, showSign = true) => {
    const sign = showSign && value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const getValueColor = (value: number) => {
    if (value > 0) return 'green.500';
    if (value < 0) return 'red.500';
    return 'fg.muted';
  };

  const chartData = equityCurve.map((point) => ({
    time: new Date(point.timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    equity: point.balance,
    initialCapital: wallet.initialBalance,
  }));

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ value: number; payload: { time: string } }>;
  }) => {
    if (active && payload && payload.length >= 1) {
      const equity = payload[0]?.value ?? 0;
      const pnl = equity - wallet.initialBalance;
      const pnlPercent = wallet.initialBalance > 0 ? (pnl / wallet.initialBalance) * 100 : 0;

      return (
        <Box p={2} bg="bg.panel" borderRadius="md" borderWidth="1px" borderColor="border">
          <Text fontSize="xs" fontWeight="medium" mb={1}>
            {payload[0]?.payload.time}
          </Text>
          <Box fontSize="2xs" gap={0.5}>
            <Text style={{ color: chartPrimary }}>
              {t('trading.wallets.equity')}: {formatCurrency(equity)}
            </Text>
            <Text color={pnl >= 0 ? 'green.500' : 'red.500'}>
              {t('trading.wallets.pnl')}: {formatCurrency(pnl, true)} ({formatPercent(pnlPercent)})
            </Text>
          </Box>
        </Box>
      );
    }
    return null;
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="xl">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxH="90vh" maxW="900px">
          <CloseButton position="absolute" top={4} right={4} onClick={onClose} size="sm" />
          <Dialog.Header>
            <Dialog.Title>
              {t('trading.wallets.performanceTitle', { name: wallet.name })}
            </Dialog.Title>
          </Dialog.Header>

          <Dialog.Body overflowY="auto">
            {isLoading ? (
              <Flex justify="center" align="center" py={12}>
                <Spinner size="lg" />
              </Flex>
            ) : (
              <Stack gap={4}>
                <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }} gap={3}>
                  <MetricCard
                    label={t('trading.wallets.currentBalance')}
                    value={formatCurrency(wallet.balance)}
                  />
                  <MetricCard
                    label={t('trading.wallets.netPnL')}
                    value={formatCurrency(totalPnL, true)}
                    valueColor={getValueColor(totalPnL)}
                    subtext={`${formatPercent(totalPnLPercent)} (${t('trading.wallets.afterFees')})`}
                  />
                  <MetricCard
                    label={t('trading.analytics.performance.winRate')}
                    value={`${performance?.winRate?.toFixed(1) ?? 0}%`}
                    subtext={`${performance?.winningTrades ?? 0}W / ${performance?.losingTrades ?? 0}L`}
                  />
                  <MetricCard
                    label={t('trading.analytics.performance.profitFactor')}
                    value={performance?.profitFactor?.toFixed(2) ?? '0'}
                    valueColor={getValueColor((performance?.profitFactor ?? 0) - 1)}
                  />
                </Grid>

                <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }} gap={3}>
                  <MetricCard
                    label={t('trading.analytics.performance.totalTrades')}
                    value={String(performance?.totalTrades ?? 0)}
                  />
                  <MetricCard
                    label={t('trading.analytics.performance.avgWin')}
                    value={formatCurrency(performance?.avgWin ?? 0, true)}
                    valueColor="green.500"
                  />
                  <MetricCard
                    label={t('trading.analytics.performance.avgLoss')}
                    value={formatCurrency(performance?.avgLoss ?? 0)}
                    valueColor="red.500"
                  />
                  <MetricCard
                    label={t('trading.analytics.performance.largestWin')}
                    value={formatCurrency(performance?.largestWin ?? 0, true)}
                    valueColor="green.500"
                  />
                  <MetricCard
                    label={t('trading.analytics.performance.largestLoss')}
                    value={formatCurrency(performance?.largestLoss ?? 0)}
                    valueColor="red.500"
                  />
                </Grid>

                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={3}>
                    {t('trading.wallets.equityCurve')}
                  </Text>
                  {chartData.length > 1 ? (
                    <Box h="280px">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                          <XAxis
                            dataKey="time"
                            style={{ fontSize: '10px', fill: chartTextMuted }}
                          />
                          <YAxis
                            tickFormatter={(value) =>
                              `${wallet.currency} ${value.toLocaleString()}`
                            }
                            style={{ fontSize: '10px', fill: chartTextMuted }}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <defs>
                            <linearGradient id="colorEquityWallet" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={chartPrimary} stopOpacity={0.3} />
                              <stop offset="95%" stopColor={chartPrimary} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Area
                            type="monotone"
                            dataKey="equity"
                            stroke={chartPrimary}
                            fillOpacity={1}
                            fill="url(#colorEquityWallet)"
                            name={t('trading.wallets.equity')}
                          />
                          <Line
                            type="monotone"
                            dataKey="initialCapital"
                            stroke={chartSecondary}
                            strokeDasharray="5 5"
                            dot={false}
                            name={t('trading.wallets.initialBalance')}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </Box>
                  ) : (
                    <Box p={6} textAlign="center" bg="bg.muted" borderRadius="md">
                      <Text fontSize="sm" color="fg.muted">
                        {t('trading.wallets.noTradesYet')}
                      </Text>
                    </Box>
                  )}
                </Box>

                <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }} gap={3}>
                  <MetricCard
                    label={t('trading.analytics.performance.maxDrawdown')}
                    value={`-${performance?.maxDrawdown?.toFixed(2) ?? 0}%`}
                    valueColor="red.500"
                  />
                  <MetricCard
                    label={t('trading.analytics.performance.grossPnL')}
                    value={formatCurrency(performance?.grossPnL ?? 0, true)}
                    valueColor={getValueColor(performance?.grossPnL ?? 0)}
                  />
                  <MetricCard
                    label={t('trading.analytics.performance.fees')}
                    value={formatCurrency(performance?.totalFees ?? 0)}
                    valueColor="red.500"
                  />
                </Grid>
              </Stack>
            )}
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};

interface MetricCardProps {
  label: string;
  value: string;
  valueColor?: string;
  subtext?: string;
}

const MetricCard = ({ label, value, valueColor, subtext }: MetricCardProps) => (
  <GridItem>
    <Box p={3} bg="bg.muted" borderRadius="md" h="100%">
      <Text fontSize="2xs" color="fg.muted" mb={1}>
        {label}
      </Text>
      <Text fontSize="sm" fontWeight="bold" color={valueColor}>
        {value}
      </Text>
      {subtext && (
        <Text fontSize="2xs" color="fg.muted">
          {subtext}
        </Text>
      )}
    </Box>
  </GridItem>
);
