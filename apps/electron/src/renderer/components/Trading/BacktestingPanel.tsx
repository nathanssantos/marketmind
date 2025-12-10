import { Box, Flex, Stack, Tabs, Text } from '@chakra-ui/react';
import { Button } from '@renderer/components/ui/button';
import { useBacktesting } from '@renderer/hooks/useBacktesting';
import { BinanceProvider } from '@renderer/services/market/providers/BinanceProvider';
import { MarketDataService } from '@renderer/services/market/MarketDataService';
import { useMemo, useState } from 'react';
import { BacktestConfig } from './BacktestConfig';
import { BacktestResults } from './BacktestResults';

const createDefaultMarketService = (): MarketDataService => {
  const binance = new BinanceProvider();
  return new MarketDataService({
    primaryProvider: binance,
    fallbackProviders: [],
    enableCache: true,
    cacheDuration: 60 * 1000,
  });
};

interface BacktestingPanelProps {
  marketService?: MarketDataService;
}

export const BacktestingPanel = ({ marketService: providedMarketService }: BacktestingPanelProps) => {
  const { backtests, isLoadingBacktests, deleteBacktest, isDeletingBacktest } = useBacktesting();
  const [selectedBacktestId, setSelectedBacktestId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'config' | 'results'>('config');

  const marketService = useMemo(
    () => providedMarketService ?? createDefaultMarketService(),
    [providedMarketService]
  );

  const handleBacktestComplete = (resultId: string) => {
    setSelectedBacktestId(resultId);
    setActiveView('results');
  };

  const handleViewBacktest = (id: string) => {
    setSelectedBacktestId(id);
    setActiveView('results');
  };

  const handleNewBacktest = () => {
    setSelectedBacktestId(null);
    setActiveView('config');
  };

  const handleDeleteBacktest = async (id: string) => {
    if (confirm('Are you sure you want to delete this backtest?')) {
      await deleteBacktest(id);
      if (selectedBacktestId === id) {
        setSelectedBacktestId(null);
        setActiveView('config');
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatNumber = (value: number, decimals = 2) => {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  return (
    <Stack gap={0} h="full">
      <Flex justify="space-between" align="center" p={4} borderBottom="1px solid" borderColor="border.default">
        <Text fontSize="sm" fontWeight="bold">
          Backtesting
        </Text>
        {activeView === 'results' && (
          <Button size="2xs" variant="ghost" onClick={handleNewBacktest}>
            New Backtest
          </Button>
        )}
      </Flex>

      <Box p={4} overflowY="auto" flex={1}>
        <Tabs.Root
          value={activeView}
          onValueChange={(e) => setActiveView(e.value as 'config' | 'results')}
          variant="enclosed"
        >
          <Tabs.List mx={4}>
            <Tabs.Trigger value="config" px={4}>Configure</Tabs.Trigger>
            <Tabs.Trigger value="results" px={4}>Results</Tabs.Trigger>
          </Tabs.List>

          <Box mt={4}>
            <Tabs.Content value="config">
              <BacktestConfig onBacktestComplete={handleBacktestComplete} marketService={marketService} />
            </Tabs.Content>

            <Tabs.Content value="results">
              {selectedBacktestId ? (
                <BacktestResults
                  backtestId={selectedBacktestId}
                  onClose={() => setSelectedBacktestId(null)}
                  marketService={marketService}
                />
              ) : (
                <Stack gap={3}>
                  <Text fontSize="xs" fontWeight="medium" mb={1}>
                    Backtest History
                  </Text>

                  {isLoadingBacktests ? (
                    <Text fontSize="xs" color="fg.muted">Loading...</Text>
                  ) : backtests.length === 0 ? (
                    <Box p={4} textAlign="center" bg="bg.muted" borderRadius="md">
                      <Text fontSize="sm" color="fg.muted" mb={2}>
                        No backtests yet
                      </Text>
                      <Text fontSize="xs" color="fg.muted">
                        Configure and run your first backtest
                      </Text>
                    </Box>
                  ) : (
                    <Stack gap={2} maxH="500px" overflowY="auto">
                      {backtests.map((backtest) => (
                        <Box
                          key={backtest.id}
                          p={3}
                          bg="bg.muted"
                          borderRadius="md"
                          borderLeft="4px solid"
                          borderColor={
                            backtest.status === 'COMPLETED'
                              ? backtest.totalPnl >= 0
                                ? 'green.500'
                                : 'red.500'
                              : backtest.status === 'RUNNING'
                                ? 'blue.500'
                                : 'orange.500'
                          }
                          cursor={backtest.status === 'COMPLETED' ? 'pointer' : 'default'}
                          _hover={
                            backtest.status === 'COMPLETED'
                              ? { bg: 'bg.subtle' }
                              : {}
                          }
                          onClick={() =>
                            backtest.status === 'COMPLETED' && handleViewBacktest(backtest.id)
                          }
                        >
                          <Flex justify="space-between" align="start" mb={2}>
                            <Box flex="1">
                              <Text fontSize="xs" fontWeight="medium" mb={1}>
                                {backtest.symbol} - {backtest.interval}
                              </Text>
                              <Text fontSize="2xs" color="fg.muted">
                                {formatDate(backtest.startDate)} - {formatDate(backtest.endDate)}
                              </Text>
                            </Box>
                            <Box textAlign="right">
                              {backtest.status === 'COMPLETED' && (
                                <>
                                  <Text
                                    fontSize="xs"
                                    fontWeight="bold"
                                    color={backtest.totalPnl >= 0 ? 'green.500' : 'red.500'}
                                  >
                                    {backtest.totalPnl >= 0 ? '+' : ''}
                                    {formatNumber(backtest.totalPnlPercent)}%
                                  </Text>
                                  <Text fontSize="2xs" color="fg.muted">
                                    ${formatNumber(backtest.totalPnl)}
                                  </Text>
                                </>
                              )}
                              {backtest.status === 'RUNNING' && (
                                <Text fontSize="xs" color="blue.500">
                                  Running...
                                </Text>
                              )}
                              {backtest.status === 'FAILED' && (
                                <Text fontSize="xs" color="red.500">
                                  Failed
                                </Text>
                              )}
                            </Box>
                          </Flex>

                          {backtest.status === 'COMPLETED' && (
                            <Flex justify="space-between" align="center" fontSize="2xs" color="fg.muted">
                              <Text>
                                {backtest.totalTrades} trades • {formatNumber(backtest.winRate)}% win rate
                              </Text>
                              <Button
                                size="2xs"
                                variant="ghost"
                                colorPalette="red"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteBacktest(backtest.id);
                                }}
                                loading={isDeletingBacktest}
                              >
                                Delete
                              </Button>
                            </Flex>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Stack>
              )}
            </Tabs.Content>
          </Box>
        </Tabs.Root>
      </Box>
    </Stack>
  );
};
