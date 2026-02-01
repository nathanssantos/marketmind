import { Dialog } from '@/renderer/components/ui/dialog';
import { Box, CloseButton, Flex, Group, Stack, Text } from '@chakra-ui/react';
import type { MarketType, TimeInterval } from '@marketmind/types';
import { AUTO_TRADING_CONFIG } from '@marketmind/types';
import { Button } from '@renderer/components/ui/button';
import { NumberInput } from '@renderer/components/ui/number-input';
import { TimeframeSelector } from '@renderer/components/Chart/TimeframeSelector';
import { useBackendAutoTrading, useCapitalLimits, useFilteredSymbolsForQuickStart } from '@renderer/hooks/useBackendAutoTrading';
import { useBackendWallet } from '@renderer/hooks/useBackendWallet';
import { useDebounce } from '@renderer/hooks/useDebounce';
import { trpc } from '@renderer/utils/trpc';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuPlay, LuSettings } from 'react-icons/lu';
import { useGlobalActionsOptional } from '@renderer/context/GlobalActionsContext';

interface StartWatchersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StartWatchersModal = memo(({ isOpen, onClose }: StartWatchersModalProps) => {
  const { t } = useTranslation();
  const globalActions = useGlobalActionsOptional();

  const { wallets } = useBackendWallet();
  const walletId = wallets[0]?.id ?? '';

  const [marketType, setMarketType] = useState<MarketType>('FUTURES');
  const [timeframe, setTimeframe] = useState<TimeInterval>('12h');
  const [count, setCount] = useState(20);

  const { startWatchersBulk, isStartingWatchersBulk } = useBackendAutoTrading(walletId);

  const { data: config } = trpc.autoTrading.getConfig.useQuery(
    { walletId },
    { enabled: !!walletId }
  );

  const useTrendFilter = config?.useTrendFilter ?? true;
  const debouncedCount = useDebounce(count, 500);

  const {
    filteredSymbols,
    maxAffordableWatchers: filteredMaxAffordable,
    isLoadingFiltered,
    skippedTrend,
  } = useFilteredSymbolsForQuickStart(walletId, marketType, timeframe, debouncedCount, useTrendFilter);

  const maxAffordableWatchers = filteredMaxAffordable ?? AUTO_TRADING_CONFIG.TARGET_COUNT.MAX;
  const effectiveMax = Math.min(maxAffordableWatchers, AUTO_TRADING_CONFIG.TARGET_COUNT.MAX);

  const { formatCapitalTooltip } = useCapitalLimits(walletId, marketType);

  const { data: btcTrendStatus } = trpc.autoTrading.getBtcTrendStatus.useQuery(
    { interval: timeframe },
    {
      enabled: config?.useBtcCorrelationFilter === true,
      staleTime: 60000,
    }
  );

  const { data: fundingRates } = trpc.autoTrading.getBatchFundingRates.useQuery(
    { symbols: filteredSymbols },
    {
      enabled: marketType === 'FUTURES' && config?.useFundingFilter === true && filteredSymbols.length > 0,
      staleTime: 60000,
    }
  );

  const finalFilteredSymbols = useMemo(() => {
    const extremeSymbols = new Set(
      marketType === 'FUTURES' && config?.useFundingFilter && fundingRates
        ? fundingRates.filter((f) => f.isExtreme).map((f) => f.symbol)
        : []
    );
    return filteredSymbols.filter(symbol => !extremeSymbols.has(symbol));
  }, [filteredSymbols, fundingRates, config?.useFundingFilter, marketType]);

  const showBtcTrend = useTrendFilter || config?.useBtcCorrelationFilter === true;

  const handleQuickStart = async (): Promise<void> => {
    if (!walletId || finalFilteredSymbols.length === 0) return;
    await startWatchersBulk(finalFilteredSymbols, timeframe, undefined, marketType, count);
    onClose();
  };

  const handleOpenSettings = (): void => {
    globalActions?.openSettings?.();
    onClose();
  };

  if (!walletId) {
    return (
      <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="md">
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <CloseButton position="absolute" top={4} right={4} onClick={onClose} size="sm" />
            <Dialog.Header borderBottom="1px solid" borderColor="border">
              <Dialog.Title>{t('marketSidebar.watchers.startWatchers')}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Box p={4} textAlign="center" bg="orange.50" borderRadius="md" _dark={{ bg: 'orange.900' }}>
                <Text fontSize="sm" color="orange.600" _dark={{ color: 'orange.300' }}>
                  {t('trading.portfolio.noWallet')}
                </Text>
              </Box>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    );
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="lg">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <CloseButton position="absolute" top={4} right={4} onClick={onClose} size="sm" />
          <Dialog.Header borderBottom="1px solid" borderColor="border">
            <Dialog.Title>{t('marketSidebar.watchers.startWatchers')}</Dialog.Title>
          </Dialog.Header>

          <Dialog.Body py={6}>
            <Stack gap={4}>
              <Box p={4} bg="green.50" borderRadius="md" borderWidth="1px" borderColor="green.200" _dark={{ bg: 'green.900/20', borderColor: 'green.800' }}>
                <Flex justify="space-between" align="center" mb={3}>
                  <Text fontSize="sm" fontWeight="medium">
                    {t('tradingProfiles.dynamicSelection.quickStartTitle')}
                  </Text>
                  {showBtcTrend && btcTrendStatus && (
                    <Flex gap={2} align="center">
                      <Box
                        px={2}
                        py={0.5}
                        bg={
                          btcTrendStatus.trend === 'BULLISH'
                            ? 'green.100'
                            : btcTrendStatus.trend === 'BEARISH'
                              ? 'red.100'
                              : 'gray.100'
                        }
                        borderRadius="md"
                        fontSize="xs"
                        _dark={{
                          bg:
                            btcTrendStatus.trend === 'BULLISH'
                              ? 'green.900'
                              : btcTrendStatus.trend === 'BEARISH'
                                ? 'red.900'
                                : 'gray.700',
                        }}
                      >
                        <Text
                          fontWeight="medium"
                          color={
                            btcTrendStatus.trend === 'BULLISH'
                              ? 'green.700'
                              : btcTrendStatus.trend === 'BEARISH'
                                ? 'red.700'
                                : 'gray.600'
                          }
                          _dark={{
                            color:
                              btcTrendStatus.trend === 'BULLISH'
                                ? 'green.200'
                                : btcTrendStatus.trend === 'BEARISH'
                                  ? 'red.200'
                                  : 'gray.300',
                          }}
                        >
                          BTC: {btcTrendStatus.trend}
                          {!btcTrendStatus.canLong && ' (LONG blocked)'}
                          {!btcTrendStatus.canShort && ' (SHORT blocked)'}
                        </Text>
                      </Box>
                      {skippedTrend.length > 0 && (
                        <Box px={2} py={0.5} bg="orange.100" borderRadius="md" fontSize="xs" _dark={{ bg: 'orange.900' }}>
                          <Text fontWeight="medium" color="orange.700" _dark={{ color: 'orange.200' }}>
                            {skippedTrend.length} filtered
                          </Text>
                        </Box>
                      )}
                    </Flex>
                  )}
                </Flex>

                <Stack gap={3}>
                  <Flex gap={3} align="center" wrap="wrap">
                    <Group attached flex="0 0 180px">
                      <Button
                        size="sm"
                        variant={marketType === 'SPOT' ? 'solid' : 'outline'}
                        onClick={() => setMarketType('SPOT')}
                        flex={1}
                      >
                        Spot
                      </Button>
                      <Button
                        size="sm"
                        variant={marketType === 'FUTURES' ? 'solid' : 'outline'}
                        onClick={() => setMarketType('FUTURES')}
                        flex={1}
                      >
                        Futures
                      </Button>
                    </Group>
                    <Box>
                      <TimeframeSelector
                        selectedTimeframe={timeframe}
                        onTimeframeChange={setTimeframe}
                      />
                    </Box>
                    <Flex align="center" gap={2}>
                      <Box flex="0 0 70px">
                        <NumberInput
                          min={AUTO_TRADING_CONFIG.TARGET_COUNT.MIN}
                          max={effectiveMax}
                          value={count}
                          onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
                          size="sm"
                          px={3}
                        />
                      </Box>
                      <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap" title={formatCapitalTooltip()}>
                        / {isLoadingFiltered ? '...' : effectiveMax} max
                      </Text>
                    </Flex>
                  </Flex>

                  <Text fontSize="sm" color="fg.muted">
                    {effectiveMax === 0
                      ? t('tradingProfiles.dynamicSelection.insufficientCapital')
                      : t('tradingProfiles.dynamicSelection.quickStartDescription')}
                  </Text>
                </Stack>
              </Box>

              <Box p={3} bg="blue.50" borderRadius="md" _dark={{ bg: 'blue.900/20' }}>
                <Text fontSize="xs" color="fg.muted">
                  {t('tradingProfiles.dynamicSelection.infoText')}
                </Text>
              </Box>
            </Stack>
          </Dialog.Body>

          <Dialog.Footer borderTop="1px solid" borderColor="border" gap={2}>
            <Button variant="ghost" onClick={handleOpenSettings} size="sm">
              <LuSettings />
              {t('header.settings')}
            </Button>
            <Box flex={1} />
            <Button variant="outline" onClick={onClose} size="sm">
              {t('common.cancel')}
            </Button>
            <Button
              colorPalette="green"
              onClick={() => void handleQuickStart()}
              loading={isStartingWatchersBulk}
              disabled={isLoadingFiltered || finalFilteredSymbols.length === 0 || effectiveMax === 0}
              size="sm"
            >
              <LuPlay />
              {t('tradingProfiles.dynamicSelection.quickStartButton', { count: Math.min(count, effectiveMax) })}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
});

StartWatchersModal.displayName = 'StartWatchersModal';
