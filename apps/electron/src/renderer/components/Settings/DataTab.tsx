import { Badge, Button, ConfirmationDialog, Input, Separator, Slider } from '@renderer/components/ui';
import { useDebounceCallback } from '@/renderer/hooks/useDebounceCallback';
import { trpc } from '@/renderer/utils/trpc';
import { TradingTable, TradingTableCell, TradingTableRow, type TradingTableColumn } from '@/renderer/components/Trading/TradingTable';
import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuPlus, LuRefreshCw, LuTrash2, LuWrench, LuX } from 'react-icons/lu';

const MS_PER_HOUR = 3_600_000;
const DEFAULT_COOLDOWN_HOURS = 2;

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatTimeAgo = (date: Date | string | null): string => {
  if (!date) return '—';
  const diffMs = Date.now() - new Date(date).getTime();
  const diffH = Math.floor(diffMs / MS_PER_HOUR);
  if (diffH < 1) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
};

const statusColumns = (t: (key: string) => string): TradingTableColumn[] => [
  { key: 'symbol', header: t('settings.data.status.symbol'), sticky: true, minW: '100px' },
  { key: 'interval', header: t('settings.data.status.interval'), minW: '70px' },
  { key: 'market', header: t('settings.data.status.market'), minW: '90px' },
  { key: 'lastCheck', header: t('settings.data.status.lastCheck'), minW: '100px' },
  { key: 'gaps', header: t('settings.data.status.gapsFound'), textAlign: 'right', minW: '70px' },
  { key: 'corrupted', header: t('settings.data.status.corruptedFixed'), textAlign: 'right', minW: '90px' },
];

const HeatmapAlwaysCollectSection = () => {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: symbols = [] } = trpc.heatmap.getAlwaysCollectSymbols.useQuery();
  const [newSymbol, setNewSymbol] = useState('');

  const addMutation = trpc.heatmap.addAlwaysCollectSymbol.useMutation({
    onSuccess: () => { setNewSymbol(''); void utils.heatmap.getAlwaysCollectSymbols.invalidate(); },
  });

  const removeMutation = trpc.heatmap.removeAlwaysCollectSymbol.useMutation({
    onSuccess: () => void utils.heatmap.getAlwaysCollectSymbols.invalidate(),
  });

  const handleAdd = () => {
    const s = newSymbol.trim().toUpperCase();
    if (s && !symbols.includes(s)) addMutation.mutate({ symbol: s });
  };

  return (
    <Box>
      <Text fontSize="md" fontWeight="medium" mb={1}>{t('settings.data.heatmap.title', 'Liquidity Heatmap')}</Text>
      <Text fontSize="sm" color="fg.muted" mb={4}>{t('settings.data.heatmap.description', 'Symbols that always collect order book depth for the heatmap, even without a chart open. Requires backend restart to take effect.')}</Text>

      <HStack gap={2} mb={3}>
        <Input
          size="sm"
          placeholder={t('settings.data.heatmap.placeholder', 'ETHUSDT')}
          value={newSymbol}
          onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          maxW="200px"
        />
        <Button size="sm" variant="outline" onClick={handleAdd} loading={addMutation.isPending}>
          <LuPlus />
          {t('settings.data.heatmap.add', 'Add')}
        </Button>
      </HStack>

      {symbols.length > 0 && (
        <Flex gap={2} flexWrap="wrap">
          {symbols.map((s) => (
            <Badge key={s} size="lg" px={3} py={1} colorPalette="blue">
              {s}
              <Box as="button" ml={1} cursor="pointer" opacity={0.7} _hover={{ opacity: 1 }} onClick={() => removeMutation.mutate({ symbol: s })}>
                <LuX size={12} />
              </Box>
            </Badge>
          ))}
        </Flex>
      )}

      {symbols.length === 0 && (
        <Text fontSize="sm" color="fg.muted">{t('settings.data.heatmap.empty', 'No symbols configured. BTCUSDT is used as default.')}</Text>
      )}
    </Box>
  );
};

export const DataTab = () => {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const { data: cooldowns } = trpc.kline.getCooldowns.useQuery();
  const { data: statusEntries, refetch: refetchStatus } = trpc.kline.getMaintenanceStatus.useQuery();

  const [gapCheckHours, setGapCheckHours] = useState(DEFAULT_COOLDOWN_HOURS);
  const [corruptionCheckHours, setCorruptionCheckHours] = useState(DEFAULT_COOLDOWN_HOURS);
  const [repairResult, setRepairResult] = useState<{ pairsChecked: number; gapsFilled: number; corruptedFixed: number } | null>(null);

  useEffect(() => {
    if (cooldowns) {
      setGapCheckHours(cooldowns.gapCheckMs / MS_PER_HOUR);
      setCorruptionCheckHours(cooldowns.corruptionCheckMs / MS_PER_HOUR);
    }
  }, [cooldowns]);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { data: dbSizeData, refetch: refetchDbSize } = trpc.kline.getDbSize.useQuery();
  const dbSize = dbSizeData?.bytes;

  const clearKlinesMutation = trpc.kline.clearKlines.useMutation({
    onSuccess: () => {
      setShowClearConfirm(false);
      void refetchDbSize();
      void refetchStatus();
    },
  });

  const handleClearKlines = () => clearKlinesMutation.mutate();

  const repairAllMutation = trpc.kline.repairAll.useMutation({
    onSuccess: (result) => {
      setRepairResult(result);
      void refetchStatus();
      void utils.kline.list.invalidate();
    },
  });

  const setCooldownsMutation = trpc.kline.setCooldowns.useMutation({
    onSuccess: () => utils.kline.getCooldowns.invalidate(),
  });

  const debouncedSetCooldowns = useDebounceCallback(
    (gapMs: number, corruptionMs: number) => setCooldownsMutation.mutate({ gapCheckMs: gapMs, corruptionCheckMs: corruptionMs }),
    500
  );

  const handleGapCheckChange = (value: number[]) => {
    const hours = value[0] ?? DEFAULT_COOLDOWN_HOURS;
    setGapCheckHours(hours);
    debouncedSetCooldowns(hours * MS_PER_HOUR, corruptionCheckHours * MS_PER_HOUR);
  };

  const handleCorruptionCheckChange = (value: number[]) => {
    const hours = value[0] ?? DEFAULT_COOLDOWN_HOURS;
    setCorruptionCheckHours(hours);
    debouncedSetCooldowns(gapCheckHours * MS_PER_HOUR, hours * MS_PER_HOUR);
  };

  const handleResetCooldowns = () => {
    setGapCheckHours(DEFAULT_COOLDOWN_HOURS);
    setCorruptionCheckHours(DEFAULT_COOLDOWN_HOURS);
    setCooldownsMutation.mutate({ gapCheckMs: DEFAULT_COOLDOWN_HOURS * MS_PER_HOUR, corruptionCheckMs: DEFAULT_COOLDOWN_HOURS * MS_PER_HOUR });
  };

  return (
    <Stack gap={6}>
      <Box>
        <Text fontSize="md" fontWeight="medium" mb={1}>{t('settings.data.maintenance.title')}</Text>
        <Text fontSize="sm" color="fg.muted" mb={4}>{t('settings.data.maintenance.description')}</Text>

        <Button
          variant="outline"
          onClick={() => { setRepairResult(null); repairAllMutation.mutate(); }}
          loading={repairAllMutation.isPending}
          loadingText={t('settings.data.maintenance.repairing')}
        >
          <LuWrench />
          {t('settings.data.maintenance.repairAll')}
        </Button>

        {repairResult && (
          <HStack mt={3} gap={4} flexWrap="wrap">
            <Text fontSize="sm">{t('settings.data.maintenance.pairsChecked', { count: repairResult.pairsChecked })}</Text>
            <Text fontSize="sm" color={repairResult.gapsFilled > 0 ? 'green.500' : 'fg.muted'}>
              {t('settings.data.maintenance.gapsFilled', { count: repairResult.gapsFilled })}
            </Text>
            <Text fontSize="sm" color={repairResult.corruptedFixed > 0 ? 'orange.500' : 'fg.muted'}>
              {t('settings.data.maintenance.corruptedFixed', { count: repairResult.corruptedFixed })}
            </Text>
          </HStack>
        )}
      </Box>

      {statusEntries && statusEntries.length > 0 && (
        <>
          <Separator />
          <Box>
            <Text fontSize="md" fontWeight="medium" mb={3}>{t('settings.data.status.title')}</Text>
            <TradingTable
              columns={statusColumns(t)}
              minW="600px"
            >
              {statusEntries.map((entry) => (
                <TradingTableRow key={`${entry.symbol}-${entry.interval}-${entry.marketType}`}>
                  <TradingTableCell sticky>{entry.symbol}</TradingTableCell>
                  <TradingTableCell>{entry.interval}</TradingTableCell>
                  <TradingTableCell>
                    <Badge size="sm" px={2} colorPalette={entry.marketType === 'FUTURES' ? 'orange' : 'blue'}>
                      {entry.marketType}
                    </Badge>
                  </TradingTableCell>
                  <TradingTableCell>{formatTimeAgo(entry.lastGapCheck)}</TradingTableCell>
                  <TradingTableCell textAlign="right">
                    <Badge size="sm" px={2} colorPalette={entry.gapsFound > 0 ? 'red' : 'green'}>{entry.gapsFound}</Badge>
                  </TradingTableCell>
                  <TradingTableCell textAlign="right">
                    <Badge size="sm" px={2} colorPalette={entry.corruptedFixed > 0 ? 'orange' : 'green'}>{entry.corruptedFixed}</Badge>
                  </TradingTableCell>
                </TradingTableRow>
              ))}
            </TradingTable>
          </Box>
        </>
      )}

      <Separator />

      <Box>
        <Text fontSize="md" fontWeight="medium" mb={1}>{t('settings.data.cooldowns.title')}</Text>
        <Text fontSize="sm" color="fg.muted" mb={4}>{t('settings.data.cooldowns.description')}</Text>

        <Stack gap={5}>
          <Box>
            <Text fontSize="sm" mb={2}>{t('settings.data.cooldowns.gapCheck', { hours: gapCheckHours })}</Text>
            <Slider
              value={[gapCheckHours]}
              onValueChange={handleGapCheckChange}
              min={0.5}
              max={24}
              step={0.5}
            />
          </Box>

          <Box>
            <Text fontSize="sm" mb={2}>{t('settings.data.cooldowns.corruptionCheck', { hours: corruptionCheckHours })}</Text>
            <Slider
              value={[corruptionCheckHours]}
              onValueChange={handleCorruptionCheckChange}
              min={0.5}
              max={24}
              step={0.5}
            />
          </Box>

          <Box>
            <Button variant="outline" size="sm" onClick={handleResetCooldowns}>
              <LuRefreshCw />
              {t('settings.resetToDefaults')}
            </Button>
          </Box>
        </Stack>
      </Box>

      <Separator />

      <Box>
        <Text fontSize="md" fontWeight="medium" mb={1}>{t('settings.data.storage.title')}</Text>
        <Text fontSize="sm" color="fg.muted" mb={4}>{t('settings.data.storage.description')}</Text>

        <HStack gap={4} flexWrap="wrap" align="center">
          {dbSize !== undefined && (
            <Text fontSize="sm">
              {t('settings.data.storage.size', { size: formatBytes(dbSize) })}
            </Text>
          )}
          <Button
            variant="outline"
            size="sm"
            colorPalette="red"
            onClick={() => setShowClearConfirm(true)}
          >
            <LuTrash2 />
            {t('settings.data.storage.clearAll')}
          </Button>
        </HStack>
      </Box>

      <ConfirmationDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearKlines}
        title={t('settings.data.storage.confirmTitle')}
        description={t('settings.data.storage.confirmDescription')}
        confirmLabel={t('settings.data.storage.confirmButton')}
        colorPalette="red"
        isDestructive
        isLoading={clearKlinesMutation.isPending}
      />

      <Separator />

      <HeatmapAlwaysCollectSection />
    </Stack>
  );
};
