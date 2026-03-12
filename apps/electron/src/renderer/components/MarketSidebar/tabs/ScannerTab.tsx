import { Badge, Box, Flex, Grid, IconButton, Spinner, Stack, Text } from '@chakra-ui/react';
import { Separator } from '@renderer/components/ui/separator';
import { Button } from '@renderer/components/ui/button';
import { CryptoIcon } from '@renderer/components/ui/CryptoIcon';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { useGlobalActionsOptional } from '@renderer/context/GlobalActionsContext';
import { trpc } from '@renderer/utils/trpc';
import { AUTO_TRADING_CONFIG } from '@marketmind/types';
import type { TimeInterval } from '@marketmind/types';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuDownload, LuX, LuZap } from 'react-icons/lu';
import { socketService } from '@renderer/services/socketService';
import { SCANNER_ICON_MAP, SCANNER_TIMEFRAME_OPTIONS, SCANNER_CATEGORY_ORDER } from '@renderer/components/Screener/constants';

const ScannerTabComponent = () => {
  const { t } = useTranslation();
  const { isIB, activeWalletId } = useActiveWallet();
  const globalActions = useGlobalActionsOptional();
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<TimeInterval>('30m');
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<{ completed: number; total: number } | null>(null);

  const assetClass = isIB ? 'STOCKS' : 'CRYPTO';
  const marketType = isIB ? 'SPOT' : 'FUTURES';

  const { data: presets } = trpc.screener.getPresets.useQuery(
    { assetClass },
    { staleTime: 300_000 }
  );

  const { data: results, isLoading: isLoadingResults, isFetching } = trpc.screener.runPreset.useQuery(
    { presetId: selectedPresetId!, assetClass, marketType, interval: timeframe },
    { enabled: !!selectedPresetId, staleTime: 120_000 }
  );

  const backfillMutation = trpc.kline.backfillTopSymbols.useMutation();

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket || !activeWalletId) return;

    socket.emit('subscribe:wallet', activeWalletId);

    const handler = (data: { completed: number; total: number; status: string }) => {
      setBackfillProgress({ completed: data.completed, total: data.total });
      if (data.status === 'completed' || data.status === 'error') {
        setIsBackfilling(false);
        setTimeout(() => setBackfillProgress(null), 3000);
      }
    };

    socket.on('backfill:progress', handler);
    return () => {
      socket.off('backfill:progress', handler);
      socket.emit('unsubscribe:wallet', activeWalletId);
    };
  }, [activeWalletId]);

  const handleBackfill = useCallback(() => {
    if (!activeWalletId || isBackfilling) return;
    setIsBackfilling(true);
    setBackfillProgress({ completed: 0, total: 0 });
    backfillMutation.mutate(
      { walletId: activeWalletId, interval: timeframe, marketType: marketType as 'SPOT' | 'FUTURES' },
      {
        onSuccess: (data) => {
          if (data.symbolCount === 0) {
            setIsBackfilling(false);
            setBackfillProgress(null);
          } else {
            setBackfillProgress({ completed: 0, total: data.symbolCount });
          }
        },
        onError: () => {
          setIsBackfilling(false);
          setBackfillProgress(null);
        },
      }
    );
  }, [activeWalletId, isBackfilling, backfillMutation, timeframe, marketType]);

  const selectedPreset = presets?.find((p) => p.id === selectedPresetId);

  const groupedPresets = (presets ?? []).reduce<Record<string, typeof presets>>((acc, preset) => {
    const cat = preset.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat]!.push(preset);
    return acc;
  }, {});

  const handlePresetClick = (presetId: string) => {
    setSelectedPresetId(presetId === selectedPresetId ? null : presetId);
  };

  const handleNavigate = (symbol: string) => {
    globalActions?.navigateToSymbol(symbol, marketType as 'SPOT' | 'FUTURES');
  };

  return (
    <Stack gap={3} p={4}>
      <Flex justify="space-between" align="center">
        <Text fontSize="sm" fontWeight="bold">{t('scanner.title')}</Text>
      </Flex>

      <Flex gap={1} align="center">
        {SCANNER_TIMEFRAME_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            size="2xs"
            variant={timeframe === opt.value ? 'solid' : 'outline'}
            colorPalette={timeframe === opt.value ? 'blue' : 'gray'}
            onClick={() => setTimeframe(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </Flex>

      <Separator />

      {!selectedPresetId ? (
        <Stack gap={3}>
          {SCANNER_CATEGORY_ORDER.map((category) => {
            const categoryPresets = groupedPresets[category];
            if (!categoryPresets || categoryPresets.length === 0) return null;
            return (
              <Box key={category}>
                <Text fontSize="2xs" fontWeight="bold" color="fg.muted" textTransform="uppercase" mb={2}>
                  {t(`scanner.categories.${category}`)}
                </Text>
                <Grid templateColumns="1fr 1fr" gap={2}>
                  {categoryPresets.map((preset) => (
                    <Button
                      key={preset.id}
                      size="xs"
                      variant="outline"
                      onClick={() => handlePresetClick(preset.id)}
                      justifyContent="flex-start"
                      gap={2}
                      py={4}
                    >
                      <Box fontSize="sm">{SCANNER_ICON_MAP[preset.icon] ?? <LuZap />}</Box>
                      <Text fontSize="2xs" truncate>{preset.name}</Text>
                    </Button>
                  ))}
                </Grid>
              </Box>
            );
          })}
          <Separator />
          <Button
            size="xs"
            variant="outline"
            onClick={handleBackfill}
            disabled={isBackfilling || !activeWalletId}
            gap={2}
            w="full"
          >
            {isBackfilling ? <Spinner size="xs" /> : <LuDownload />}
            {backfillProgress
              ? t('scanner.backfillProgress', { completed: backfillProgress.completed, total: backfillProgress.total })
              : t('scanner.backfillTopSymbols', { max: AUTO_TRADING_CONFIG.TARGET_COUNT.MAX })}
          </Button>
        </Stack>
      ) : (
        <Stack gap={3}>
          <Flex justify="space-between" align="center">
            <Flex align="center" gap={2}>
              <Box fontSize="sm">{SCANNER_ICON_MAP[selectedPreset?.icon ?? ''] ?? <LuZap />}</Box>
              <Text fontSize="sm" fontWeight="bold">{selectedPreset?.name}</Text>
            </Flex>
            <IconButton
              size="2xs"
              variant="ghost"
              aria-label={t('common.close')}
              onClick={() => setSelectedPresetId(null)}
            >
              <LuX />
            </IconButton>
          </Flex>

          {selectedPreset?.description && (
            <Text fontSize="2xs" color="fg.muted">{selectedPreset.description}</Text>
          )}

          {isLoadingResults || isFetching ? (
            <Box p={4} textAlign="center">
              <Text fontSize="sm" color="fg.muted">{t('common.loading')}</Text>
            </Box>
          ) : !results?.results || results.results.length === 0 ? (
            <Box p={4} textAlign="center" bg="bg.muted" borderRadius="md">
              <Text fontSize="sm" color="fg.muted">{t('common.noResults')}</Text>
            </Box>
          ) : (
            <>
              <Text fontSize="2xs" color="fg.muted">
                {t('scanner.resultsCount', { count: results.results.length, total: results.totalSymbolsScanned })}
              </Text>
              <Stack gap={1}>
                {results.results.map((row) => (
                  <Flex
                    key={row.symbol}
                    align="center"
                    justify="space-between"
                    px={2}
                    py={1.5}
                    borderRadius="md"
                    _hover={{ bg: 'bg.muted' }}
                    cursor="pointer"
                    onClick={() => handleNavigate(row.symbol)}
                  >
                    <Flex align="center" gap={2} flex={1}>
                      <CryptoIcon symbol={row.symbol} size={14} />
                      <Text fontSize="xs" fontWeight="medium">{row.symbol}</Text>
                    </Flex>
                    <Flex align="center" gap={2}>
                      <Text fontSize="xs" fontWeight="medium">
                        {typeof row.price === 'number' ? (row.price >= 1 ? row.price.toFixed(2) : row.price.toPrecision(4)) : row.price}
                      </Text>
                      {row.indicators?.['PRICE_CHANGE_PERCENT_24H'] != null && (
                        <Badge
                          colorPalette={row.indicators['PRICE_CHANGE_PERCENT_24H'] >= 0 ? 'green' : 'red'}
                          size="xs"
                        >
                          {row.indicators['PRICE_CHANGE_PERCENT_24H'] >= 0 ? '+' : ''}
                          {row.indicators['PRICE_CHANGE_PERCENT_24H'].toFixed(1)}%
                        </Badge>
                      )}
                    </Flex>
                  </Flex>
                ))}
              </Stack>
            </>
          )}
        </Stack>
      )}
    </Stack>
  );
};

export const ScannerTab = memo(ScannerTabComponent);
