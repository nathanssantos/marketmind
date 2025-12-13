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
import { useTranslation } from 'react-i18next';
import { useBackendAnalytics, type AnalyticsPeriod } from '../../hooks/useBackendAnalytics';

interface PerformancePanelProps {
  walletId: string;
}

export const PerformancePanel = ({ walletId }: PerformancePanelProps) => {
  const { t } = useTranslation();
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
          {t('trading.analytics.performance.noData')}
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

  const periods: { value: AnalyticsPeriod; labelKey: string }[] = [
    { value: 'day', labelKey: 'trading.analytics.periods.day' },
    { value: 'week', labelKey: 'trading.analytics.periods.week' },
    { value: 'month', labelKey: 'trading.analytics.periods.month' },
    { value: 'all', labelKey: 'trading.analytics.periods.all' },
  ];

  return (
    <Stack gap={4} p={6} bg="gray.50" _dark={{ bg: 'gray.800' }} borderRadius="md" borderWidth="1px">
      <Flex justify="space-between" align="center" pb={2} borderBottomWidth="1px">
        <Text fontSize="lg" fontWeight="bold">
          {t('trading.analytics.performance.title')}
        </Text>
        <ButtonGroup size="sm" variant="outline">
          {periods.map((p) => (
            <Button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              variant={period === p.value ? 'solid' : 'outline'}
            >
              {t(p.labelKey)}
            </Button>
          ))}
        </ButtonGroup>
      </Flex>

      <Grid
        templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' }}
        gap={4}
      >
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
              {t('trading.analytics.performance.totalReturn').toUpperCase()}
            </Text>
            <Text fontSize="2xl" fontWeight="bold" color={getValueColor(performance.totalReturn)}>
              {formatPercent(performance.totalReturn)}
            </Text>
          </Box>
        </GridItem>

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
              {t('trading.analytics.performance.netPnL').toUpperCase()}
            </Text>
            <Text fontSize="2xl" fontWeight="bold" color={getValueColor(performance.netPnL)}>
              {formatCurrency(performance.netPnL)}
            </Text>
            <Text fontSize="xs" color="gray.500" mt={1}>
              {t('trading.analytics.performance.grossPnL')}: {formatCurrency(performance.totalPnL)} - {t('trading.analytics.performance.fees')}: ${performance.totalFees.toFixed(2)}
            </Text>
          </Box>
        </GridItem>

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
              {t('trading.analytics.performance.winRate').toUpperCase()}
            </Text>
            <Text fontSize="2xl" fontWeight="bold">
              {performance.winRate.toFixed(1)}%
            </Text>
            <Text fontSize="xs" color="gray.500" mt={1}>
              {performance.winningTrades}W / {performance.losingTrades}L
            </Text>
          </Box>
        </GridItem>

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
              {t('trading.analytics.performance.profitFactor').toUpperCase()}
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
              {t('trading.analytics.performance.totalTrades').toUpperCase()}
            </Text>
            <Text fontSize="2xl" fontWeight="bold">
              {performance.totalTrades}
            </Text>
          </Box>
        </GridItem>

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
              {t('trading.analytics.performance.avgWin').toUpperCase()}
            </Text>
            <Text fontSize="2xl" fontWeight="bold" color="green.500">
              {formatCurrency(performance.avgWin)}
            </Text>
          </Box>
        </GridItem>

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
              {t('trading.analytics.performance.avgLoss').toUpperCase()}
            </Text>
            <Text fontSize="2xl" fontWeight="bold" color="red.500">
              {formatCurrency(performance.avgLoss)}
            </Text>
          </Box>
        </GridItem>

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
              {t('trading.analytics.performance.maxDrawdown').toUpperCase()}
            </Text>
            <Text fontSize="2xl" fontWeight="bold" color="red.500">
              -{performance.maxDrawdown.toFixed(2)}%
            </Text>
          </Box>
        </GridItem>

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
              {t('trading.analytics.performance.largestWin').toUpperCase()}
            </Text>
            <Text fontSize="2xl" fontWeight="bold" color="green.500">
              {formatCurrency(performance.largestWin)}
            </Text>
          </Box>
        </GridItem>

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
              {t('trading.analytics.performance.largestLoss').toUpperCase()}
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
