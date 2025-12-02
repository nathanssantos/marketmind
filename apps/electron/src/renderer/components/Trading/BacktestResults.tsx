import { Box, Flex, Grid, Stack, Text } from '@chakra-ui/react';
import { Button } from '@renderer/components/ui/button';
import { useBacktesting } from '@renderer/hooks/useBacktesting';
import type { BacktestResult } from '@shared/types/backtesting';
import { useEffect, useState } from 'react';
import { EquityCurveChart } from './EquityCurveChart';

interface BacktestResultsProps {
  backtestId: string;
  onClose?: () => void;
}

export const BacktestResults = ({ backtestId, onClose }: BacktestResultsProps) => {
  const { getBacktestResult } = useBacktesting();
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadResult = async () => {
      setIsLoading(true);
      const data = await getBacktestResult(backtestId);
      setResult(data);
      setIsLoading(false);
    };

    loadResult();
  }, [backtestId, getBacktestResult]);

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

      {/* Equity Curve */}
      {result.equityCurve.length > 0 && (
        <Box p={3} bg="bg.muted" borderRadius="md">
          <Text fontSize="xs" fontWeight="medium" mb={2}>Equity Curve</Text>
          <EquityCurveChart
            equityCurve={result.equityCurve}
            initialCapital={config.initialCapital}
            currency="USDT"
          />
        </Box>
      )}

      {/* Recent Trades */}
      {result.trades.length > 0 && (
        <Box p={3} bg="bg.muted" borderRadius="md">
          <Text fontSize="xs" fontWeight="medium" mb={2}>
            Recent Trades ({result.trades.length} total)
          </Text>
          <Stack gap={2} maxH="200px" overflowY="auto">
            {result.trades.slice(-10).reverse().map((trade) => (
              <Box
                key={trade.id}
                p={2}
                bg="bg.default"
                borderRadius="sm"
                borderLeft="3px solid"
                borderColor={(trade.netPnl ?? 0) >= 0 ? 'green.500' : 'red.500'}
              >
                <Flex justify="space-between" fontSize="2xs" mb={1}>
                  <Text fontWeight="medium">
                    {trade.side} {trade.setupType}
                  </Text>
                  <Text color={(trade.netPnl ?? 0) >= 0 ? 'green.500' : 'red.500'} fontWeight="medium">
                    {formatCurrency(trade.netPnl ?? 0)}
                  </Text>
                </Flex>
                <Grid templateColumns="1fr 1fr 1fr" gap={1} fontSize="3xs" color="fg.muted">
                  <Text>Entry: {formatNumber(trade.entryPrice)}</Text>
                  <Text>Exit: {formatNumber(trade.exitPrice || 0)}</Text>
                  <Text>Qty: {formatNumber(trade.quantity, 4)}</Text>
                </Grid>
                <Flex justify="space-between" fontSize="3xs" color="fg.muted" mt={1}>
                  <Text>{trade.exitReason}</Text>
                  <Text>Confidence: {trade.setupConfidence}%</Text>
                </Flex>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Duration */}
      <Box p={2} bg="bg.subtle" borderRadius="md">
        <Text fontSize="2xs" color="fg.muted" textAlign="center">
          Backtest completed in {result.duration}ms
        </Text>
      </Box>
    </Stack>
  );
};
