import { Box, Flex, Grid, Stack, Text, Tabs } from '@chakra-ui/react';
import { Button } from '@renderer/components/ui/button';
import { useBacktesting } from '@renderer/hooks/useBacktesting';
import type { Kline } from '@marketmind/types';
import type { BacktestResult } from '@marketmind/types';
import { useEffect, useState } from 'react';
import { BacktestChart } from './BacktestChart';
import { EquityCurveChart } from './EquityCurveChart';
import { TradeListTable } from '../Backtest/TradeListTable';

interface BacktestResultsProps {
  backtestId: string;
  onClose?: () => void;
  marketService?: any;
}

export const BacktestResults = ({ backtestId, onClose, marketService }: BacktestResultsProps) => {
  const { getBacktestResult } = useBacktesting();
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [klines, setKlines] = useState<Kline[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadResult = async () => {
      setIsLoading(true);
      const data = await getBacktestResult(backtestId);
      setResult(data);

      if (data && marketService) {
        try {
          const response = await marketService.fetchKlines({
            symbol: data.config.symbol,
            interval: data.config.interval,
            startTime: new Date(data.config.startDate).getTime(),
            endTime: new Date(data.config.endDate).getTime(),
            limit: 1000,
          });
          setKlines(response.klines || []);
        } catch (error) {
          console.error('Failed to load klines for backtest chart:', error);
        }
      }

      setIsLoading(false);
    };

    loadResult();
  }, [backtestId, getBacktestResult, marketService]);

  if (isLoading) {
    return (
      <Stack gap={3} p={4}>
        <Text fontSize="sm" color="fg.muted">Loading backtest results...</Text>
      </Stack>
    );
  }

  if (!result) {
    return (
      <Stack gap={3} p={4}>
        <Text fontSize="sm" color="red.500">Failed to load backtest results</Text>
        {onClose && (
          <Button size="xs" onClick={onClose}>
            Close
          </Button>
        )}
      </Stack>
    );
  }

  const metrics = result.metrics;
  const config = result.config;

  const formatNumber = (value: number, decimals = 2) => {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const formatPercent = (value: number, decimals = 2) => {
    return `${value >= 0 ? '+' : ''}${formatNumber(value, decimals)}%`;
  };

  const formatCurrency = (value: number) => {
    return `$${formatNumber(value, 2)}`;
  };

  return (
    <Stack gap={3} p={4}>
      <Flex justify="space-between" align="center">
        <Text fontSize="sm" fontWeight="bold">
          Backtest Results
        </Text>
        {onClose && (
          <Button size="2xs" variant="ghost" onClick={onClose}>
            Close
          </Button>
        )}
      </Flex>

      {/* Configuration Summary */}
      <Box p={3} bg="bg.muted" borderRadius="md">
        <Text fontSize="xs" fontWeight="medium" mb={2}>Configuration</Text>
        <Grid templateColumns="1fr 1fr" gap={1} fontSize="2xs">
          <Text color="fg.muted">Symbol:</Text>
          <Text>{config.symbol}</Text>
          <Text color="fg.muted">Interval:</Text>
          <Text>{config.interval}</Text>
          <Text color="fg.muted">Period:</Text>
          <Text>{new Date(config.startDate).toLocaleDateString()} - {new Date(config.endDate).toLocaleDateString()}</Text>
          <Text color="fg.muted">Initial Capital:</Text>
          <Text>{formatCurrency(config.initialCapital)}</Text>
        </Grid>
      </Box>

      {/* Performance Metrics */}
      <Box p={3} bg="bg.muted" borderRadius="md">
        <Text fontSize="xs" fontWeight="medium" mb={2}>Performance</Text>
        <Grid templateColumns="1fr 1fr" gap={1} fontSize="2xs">
          <Text color="fg.muted">Total PnL:</Text>
          <Text color={metrics.totalPnl >= 0 ? 'green.500' : 'red.500'} fontWeight="medium">
            {formatCurrency(metrics.totalPnl)} ({formatPercent(metrics.totalPnlPercent)})
          </Text>
          <Text color="fg.muted">Final Equity:</Text>
          <Text fontWeight="medium">
            {formatCurrency(config.initialCapital + metrics.totalPnl)}
          </Text>
          <Text color="fg.muted">Max Drawdown:</Text>
          <Text color="red.500">
            {formatCurrency(metrics.maxDrawdown)} ({formatPercent(metrics.maxDrawdownPercent)})
          </Text>
          <Text color="fg.muted">Sharpe Ratio:</Text>
          <Text>{formatNumber(metrics.sharpeRatio || 0, 2)}</Text>
        </Grid>
      </Box>

      {/* Trading Metrics */}
      <Box p={3} bg="bg.muted" borderRadius="md">
        <Text fontSize="xs" fontWeight="medium" mb={2}>Trading Statistics</Text>
        <Grid templateColumns="1fr 1fr" gap={1} fontSize="2xs">
          <Text color="fg.muted">Total Trades:</Text>
          <Text>{metrics.totalTrades}</Text>
          <Text color="fg.muted">Win Rate:</Text>
          <Text color={metrics.winRate >= 50 ? 'green.500' : 'orange.500'}>
            {formatPercent(metrics.winRate)}
          </Text>
          <Text color="fg.muted">Winning Trades:</Text>
          <Text color="green.500">{metrics.winningTrades}</Text>
          <Text color="fg.muted">Losing Trades:</Text>
          <Text color="red.500">{metrics.losingTrades}</Text>
          <Text color="fg.muted">Profit Factor:</Text>
          <Text color={metrics.profitFactor >= 1 ? 'green.500' : 'red.500'}>
            {formatNumber(metrics.profitFactor, 2)}
          </Text>
        </Grid>
      </Box>

      {/* Win/Loss Analysis */}
      <Box p={3} bg="bg.muted" borderRadius="md">
        <Text fontSize="xs" fontWeight="medium" mb={2}>Win/Loss Analysis</Text>
        <Grid templateColumns="1fr 1fr" gap={1} fontSize="2xs">
          <Text color="fg.muted">Avg Win:</Text>
          <Text color="green.500">{formatCurrency(metrics.avgWin)}</Text>
          <Text color="fg.muted">Avg Loss:</Text>
          <Text color="red.500">{formatCurrency(metrics.avgLoss)}</Text>
          <Text color="fg.muted">Largest Win:</Text>
          <Text color="green.500">{formatCurrency(metrics.largestWin)}</Text>
          <Text color="fg.muted">Largest Loss:</Text>
          <Text color="red.500">{formatCurrency(metrics.largestLoss)}</Text>
          <Text color="fg.muted">Avg PnL per Trade:</Text>
          <Text color={metrics.avgPnl >= 0 ? 'green.500' : 'red.500'}>
            {formatCurrency(metrics.avgPnl)} ({formatPercent(metrics.avgPnlPercent)})
          </Text>
        </Grid>
      </Box>

      {/* Costs */}
      <Box p={3} bg="bg.muted" borderRadius="md">
        <Text fontSize="xs" fontWeight="medium" mb={2}>Costs</Text>
        <Grid templateColumns="1fr 1fr" gap={1} fontSize="2xs">
          <Text color="fg.muted">Total Commission:</Text>
          <Text color="orange.500">{formatCurrency(metrics.totalCommission)}</Text>
          <Text color="fg.muted">Commission Rate:</Text>
          <Text>{formatPercent((config.commission || 0.001) * 100)}% per side</Text>
        </Grid>
      </Box>

      {/* Tabs for Charts and Trades */}
      <Tabs.Root defaultValue="overview" variant="enclosed">
        <Tabs.List>
          <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
          <Tabs.Trigger value="chart">Chart</Tabs.Trigger>
          <Tabs.Trigger value="trades">All Trades</Tabs.Trigger>
        </Tabs.List>

        {/* Overview Tab */}
        <Tabs.Content value="overview">
          {/* Equity Curve (moved here for better organization) */}
          {result.equityCurve.length > 0 && (
            <Box p={3} bg="bg.muted" borderRadius="md" mt={3}>
              <Text fontSize="xs" fontWeight="medium" mb={2}>Equity Curve</Text>
              <EquityCurveChart
                equityCurve={result.equityCurve}
                initialCapital={config.initialCapital}
                currency="USDT"
              />
            </Box>
          )}
        </Tabs.Content>

        {/* Chart Tab */}
        <Tabs.Content value="chart">
          {klines.length > 0 && result.trades.length > 0 ? (
            <Box p={3} bg="bg.muted" borderRadius="md" mt={3}>
              <Text fontSize="xs" fontWeight="medium" mb={2}>
                Trades on Chart
              </Text>
              <BacktestChart
                klines={klines}
                trades={result.trades}
                width={Math.min(window.innerWidth - 100, 1000)}
                height={500}
              />
              <Text fontSize="2xs" color="fg.muted" mt={2}>
                🔺 Green triangle = Profitable LONG entry | 🔻 Red triangle = Losing SHORT entry
                <br />
                Dotted lines connect entry to exit. Circles mark exit points.
              </Text>
            </Box>
          ) : (
            <Box p={4} textAlign="center" color="fg.muted" fontSize="sm" mt={3}>
              {klines.length === 0 ? 'No chart data available' : 'No trades to display'}
            </Box>
          )}
        </Tabs.Content>

        {/* Trades Tab */}
        <Tabs.Content value="trades">
          {result.trades.length > 0 ? (
            <Box mt={3}>
              <TradeListTable trades={result.trades} />
            </Box>
          ) : (
            <Box p={4} textAlign="center" color="fg.muted" fontSize="sm" mt={3}>
              No trades executed in this backtest
            </Box>
          )}
        </Tabs.Content>
      </Tabs.Root>

      {/* Duration */}
      <Box p={2} bg="bg.subtle" borderRadius="md">
        <Text fontSize="2xs" color="fg.muted" textAlign="center">
          Backtest completed in {result.duration}ms
        </Text>
      </Box>
    </Stack>
  );
};
