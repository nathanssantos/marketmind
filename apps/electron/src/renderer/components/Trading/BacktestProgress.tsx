import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import { ProgressBar, ProgressRoot } from '@renderer/components/ui/progress';

interface BacktestProgressProps {
  progress: number;
  currentKline?: number;
  totalKlines?: number;
  tradesFound?: number;
  currentEquity?: number;
  estimatedTimeRemaining?: number;
}

export const BacktestProgress = ({
  progress,
  currentKline,
  totalKlines,
  tradesFound,
  currentEquity,
  estimatedTimeRemaining,
}: BacktestProgressProps) => {
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <Stack gap={3} p={4} bg="bg.muted" borderRadius="md">
      <Text fontSize="sm" fontWeight="medium">
        Running Backtest...
      </Text>

      {/* Progress Bar */}
      <Box>
        <Flex justify="space-between" fontSize="xs" color="fg.muted" mb={2}>
          <Text>Progress</Text>
          <Text fontWeight="medium">{progress.toFixed(1)}%</Text>
        </Flex>
        <ProgressRoot value={progress} size="sm" colorPalette="blue">
          <ProgressBar />
        </ProgressRoot>
      </Box>

      {/* Stats Grid */}
      <Flex gap={4} fontSize="xs">
        {currentKline !== undefined && totalKlines !== undefined && (
          <Box flex={1}>
            <Text color="fg.muted" mb={1}>
              Klines Processed
            </Text>
            <Text fontWeight="medium">
              {currentKline.toLocaleString()} / {totalKlines.toLocaleString()}
            </Text>
          </Box>
        )}

        {tradesFound !== undefined && (
          <Box flex={1}>
            <Text color="fg.muted" mb={1}>
              Trades Found
            </Text>
            <Text fontWeight="medium" color="blue.500">
              {tradesFound}
            </Text>
          </Box>
        )}

        {currentEquity !== undefined && (
          <Box flex={1}>
            <Text color="fg.muted" mb={1}>
              Current Equity
            </Text>
            <Text fontWeight="medium" color="green.500">
              {formatCurrency(currentEquity)}
            </Text>
          </Box>
        )}
      </Flex>

      {/* Time Remaining */}
      {estimatedTimeRemaining !== undefined && estimatedTimeRemaining > 0 && (
        <Flex justify="space-between" fontSize="2xs" color="fg.muted">
          <Text>Estimated time remaining</Text>
          <Text fontWeight="medium">{formatTime(estimatedTimeRemaining)}</Text>
        </Flex>
      )}
    </Stack>
  );
};
