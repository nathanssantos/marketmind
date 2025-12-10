import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  Grid,
  GridItem,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useState } from 'react';
import { useBackendAnalytics, type AnalyticsPeriod } from '../../hooks/useBackendAnalytics';

interface PerformancePanelProps {
  walletId: string;
}

export const PerformancePanel = ({ walletId }: PerformancePanelProps) => {
  const [period, setPeriod] = useState<AnalyticsPeriod>('all');
  const { performance, isLoadingPerformance } = useBackendAnalytics(walletId, period);

  if (isLoadingPerformance) {
    return (
      <Stack gap={4} p={4} bg="gray.50" _dark={{ bg: 'gray.800' }} borderRadius="md" borderWidth="1px">
        <Flex justify="center" align="center" py={8}>
          <Spinner size="lg" />
        </Flex>
      </Stack>
    );
  }

  if (!performance) {
    return (
      <Stack gap={4} p={4} bg="gray.50" _dark={{ bg: 'gray.800' }} borderRadius="md" borderWidth="1px">
        <Text textAlign="center" color="gray.500" py={8}>
          No performance data available
        </Text>
      </Stack>
    );
  }

  const getValueColor = (value: number) => {
    if (value > 0) return 'green.500';
    if (value < 0) return 'red.500';
    return 'gray.500';
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const formatCurrency = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}$${Math.abs(value).toFixed(2)}`;
  };

  const periods: { value: AnalyticsPeriod; label: string }[] = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'all', label: 'All Time' },
  ];

  return (
    <Stack gap={4} p={6} bg="gray.50" _dark={{ bg: 'gray.800' }} borderRadius="md" borderWidth="1px">
      <Flex justify="space-between" align="center" pb={2} borderBottomWidth="1px">
        <Text fontSize="lg" fontWeight="bold">
          Performance
        </Text>
        <ButtonGroup size="sm" variant="outline">
          {periods.map((p) => (
            <Button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              variant={period === p.value ? 'solid' : 'outline'}
            >
              {p.label}
            </Button>
          ))}
        </ButtonGroup>
      </Flex>

      <Grid
        templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' }}
        gap={4}
      >
        {/* Total Return */}
        <GridItem>
          <Box
            p={4}
            bg="white"
            _dark={{ bg: 'gray.700' }}
            borderRadius="md"
            borderWidth="1px"
            transition="all 0.2s"
            _hover={{ transform: 'translateY(-2px)', shadow: 'md' }}
          >
            <Text fontSize="xs" color="gray.600" _dark={{ color: 'gray.400' }} mb={2} fontWeight="medium">
              TOTAL RETURN
            </Text>
            <Text fontSize="2xl" fontWeight="bold" color={getValueColor(performance.totalReturn)}>
              {formatPercent(performance.totalReturn)}
            </Text>
          </Box>
        </GridItem>

        {/* Net PnL */}
        <GridItem>
          <Box
            p={4}
            bg="white"
            _dark={{ bg: 'gray.700' }}
            borderRadius="md"
            borderWidth="1px"
            transition="all 0.2s"
            _hover={{ transform: 'translateY(-2px)', shadow: 'md' }}
          >
            <Text fontSize="xs" color="gray.600" _dark={{ color: 'gray.400' }} mb={2} fontWeight="medium">
              NET PNL
            </Text>
            <Text fontSize="2xl" fontWeight="bold" color={getValueColor(performance.netPnL)}>
              {formatCurrency(performance.netPnL)}
            </Text>
            <Text fontSize="xs" color="gray.500" mt={1}>
              Gross: {formatCurrency(performance.totalPnL)} - Fees: ${performance.totalFees.toFixed(2)}
            </Text>
          </Box>
        </GridItem>

        {/* Win Rate */}
        <GridItem>
          <Box
            p={4}
            bg="white"
            _dark={{ bg: 'gray.700' }}
            borderRadius="md"
            borderWidth="1px"
            transition="all 0.2s"
            _hover={{ transform: 'translateY(-2px)', shadow: 'md' }}
          >
            <Text fontSize="xs" color="gray.600" _dark={{ color: 'gray.400' }} mb={2} fontWeight="medium">
              WIN RATE
            </Text>
            <Text fontSize="2xl" fontWeight="bold">
              {performance.winRate.toFixed(1)}%
            </Text>
            <Text fontSize="xs" color="gray.500" mt={1}>
              {performance.winningTrades}W / {performance.losingTrades}L
            </Text>
          </Box>
        </GridItem>

        {/* Profit Factor */}
        <GridItem>
          <Box
            p={4}
            bg="white"
            _dark={{ bg: 'gray.700' }}
            borderRadius="md"
            borderWidth="1px"
            transition="all 0.2s"
            _hover={{ transform: 'translateY(-2px)', shadow: 'md' }}
          >
            <Text fontSize="xs" color="gray.600" _dark={{ color: 'gray.400' }} mb={2} fontWeight="medium">
              PROFIT FACTOR
            </Text>
            <Text
              fontSize="2xl"
              fontWeight="bold"
              color={performance.profitFactor >= 1 ? 'green.500' : 'red.500'}
            >
              {performance.profitFactor.toFixed(2)}
            </Text>
          </Box>
        </GridItem>

        {/* Total Trades */}
        <GridItem>
          <Box
            p={4}
            bg="white"
            _dark={{ bg: 'gray.700' }}
            borderRadius="md"
            borderWidth="1px"
            transition="all 0.2s"
            _hover={{ transform: 'translateY(-2px)', shadow: 'md' }}
          >
            <Text fontSize="xs" color="gray.600" _dark={{ color: 'gray.400' }} mb={2} fontWeight="medium">
              TOTAL TRADES
            </Text>
            <Text fontSize="2xl" fontWeight="bold">
              {performance.totalTrades}
            </Text>
          </Box>
        </GridItem>

        {/* Average Win */}
        <GridItem>
          <Box
            p={4}
            bg="white"
            _dark={{ bg: 'gray.700' }}
            borderRadius="md"
            borderWidth="1px"
            transition="all 0.2s"
            _hover={{ transform: 'translateY(-2px)', shadow: 'md' }}
          >
            <Text fontSize="xs" color="gray.600" _dark={{ color: 'gray.400' }} mb={2} fontWeight="medium">
              AVG WIN
            </Text>
            <Text fontSize="2xl" fontWeight="bold" color="green.500">
              {formatCurrency(performance.avgWin)}
            </Text>
          </Box>
        </GridItem>

        {/* Average Loss */}
        <GridItem>
          <Box
            p={4}
            bg="white"
            _dark={{ bg: 'gray.700' }}
            borderRadius="md"
            borderWidth="1px"
            transition="all 0.2s"
            _hover={{ transform: 'translateY(-2px)', shadow: 'md' }}
          >
            <Text fontSize="xs" color="gray.600" _dark={{ color: 'gray.400' }} mb={2} fontWeight="medium">
              AVG LOSS
            </Text>
            <Text fontSize="2xl" fontWeight="bold" color="red.500">
              {formatCurrency(performance.avgLoss)}
            </Text>
          </Box>
        </GridItem>

        {/* Max Drawdown */}
        <GridItem>
          <Box
            p={4}
            bg="white"
            _dark={{ bg: 'gray.700' }}
            borderRadius="md"
            borderWidth="1px"
            transition="all 0.2s"
            _hover={{ transform: 'translateY(-2px)', shadow: 'md' }}
          >
            <Text fontSize="xs" color="gray.600" _dark={{ color: 'gray.400' }} mb={2} fontWeight="medium">
              MAX DRAWDOWN
            </Text>
            <Text fontSize="2xl" fontWeight="bold" color="red.500">
              -{performance.maxDrawdown.toFixed(2)}%
            </Text>
          </Box>
        </GridItem>

        {/* Largest Win */}
        <GridItem>
          <Box
            p={4}
            bg="white"
            _dark={{ bg: 'gray.700' }}
            borderRadius="md"
            borderWidth="1px"
            transition="all 0.2s"
            _hover={{ transform: 'translateY(-2px)', shadow: 'md' }}
          >
            <Text fontSize="xs" color="gray.600" _dark={{ color: 'gray.400' }} mb={2} fontWeight="medium">
              LARGEST WIN
            </Text>
            <Text fontSize="2xl" fontWeight="bold" color="green.500">
              {formatCurrency(performance.largestWin)}
            </Text>
          </Box>
        </GridItem>

        {/* Largest Loss */}
        <GridItem>
          <Box
            p={4}
            bg="white"
            _dark={{ bg: 'gray.700' }}
            borderRadius="md"
            borderWidth="1px"
            transition="all 0.2s"
            _hover={{ transform: 'translateY(-2px)', shadow: 'md' }}
          >
            <Text fontSize="xs" color="gray.600" _dark={{ color: 'gray.400' }} mb={2} fontWeight="medium">
              LARGEST LOSS
            </Text>
            <Text fontSize="2xl" fontWeight="bold" color="red.500">
              {formatCurrency(performance.largestLoss)}
            </Text>
          </Box>
        </GridItem>
      </Grid>
    </Stack>
  );
};
