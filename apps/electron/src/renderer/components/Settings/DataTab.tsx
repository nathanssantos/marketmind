import {
  Badge, Button, Callout, ConfirmationDialog, EmptyState, FormRow, FormSection, Input, LoadingSpinner, Slider, Switch,
} from '@renderer/components/ui';
import { useDebounceCallback } from '@/renderer/hooks/useDebounceCallback';
import { useToast } from '@/renderer/hooks/useToast';
import { hydrateLayoutStore } from '@/renderer/store/layoutStore';
import { trpc } from '@/renderer/utils/trpc';
import {
  TradingTable, TradingTableCell, TradingTableRow, type TradingTableColumn,
} from '@/renderer/components/Trading/TradingTable';
import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuHistory, LuPlus, LuRefreshCw, LuTrash2, LuWrench, LuX } from 'react-icons/lu';

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

const formatSnapshotAt = (date: Date | string, locale: string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
};

const LayoutSnapshotsSection = () => {
  const { t, i18n } = useTranslation();
  const { success: toastSuccess, error: toastError } = useToast();
  const utils = trpc.useUtils();

  // `data: snapshots = []` destructure only defaults `undefined`, not `null`.
  // Visual-regression fixtures return `data: null` for unmocked paths, which
  // crashed `snapshots.length` and broke every gallery run from this tab onward
  // (the ErrorBoundary left React in a state where later dialogs wouldn't mount).
  const { data: snapshotsRaw, isLoading } = trpc.layout.listSnapshots.useQuery();
  const snapshots = snapshotsRaw ?? [];
  const [pendingId, setPendingId] = useState<number | null>(null);

  const restoreMutation = trpc.layout.restoreSnapshot.useMutation({
    onSuccess: async () => {
      await hydrateLayoutStore();
      void utils.layout.listSnapshots.invalidate();
      setPendingId(null);
      toastSuccess(t('settings.data.layouts.restored'));
    },
    onError: (err) => {
      setPendingId(null);
      toastError(t('settings.data.layouts.restoreFailed'), err.message);
    },
  });

  return (
    <FormSection
      title={t('settings.data.layouts.title')}
      description={t('settings.data.layouts.description')}
    >
      {isLoading ? (
        <LoadingSpinner />
      ) : snapshots.length === 0 ? (
        <EmptyState icon={LuHistory} title={t('settings.data.layouts.empty')} />
      ) : (
        <Stack gap={1.5}>
          {snapshots.map((snap) => (
            <HStack
              key={snap.id}
              justify="space-between"
              p={2}
              borderWidth="1px"
              borderColor="border"
              borderRadius="md"
              bg="bg.muted"
            >
              <HStack gap={2}>
                <Box color="fg.muted"><LuHistory size={14} /></Box>
                <Text fontSize="xs">{formatSnapshotAt(snap.snapshotAt, i18n.language)}</Text>
              </HStack>
              <Button
                size="2xs"
                variant="outline"
                onClick={() => setPendingId(snap.id)}
                loading={restoreMutation.isPending && restoreMutation.variables?.snapshotId === snap.id}
                data-testid={`layout-snapshot-restore-${snap.id}`}
              >
                {t('settings.data.layouts.restore')}
              </Button>
            </HStack>
          ))}
        </Stack>
      )}

      <ConfirmationDialog
        isOpen={pendingId !== null}
        onClose={() => setPendingId(null)}
        onConfirm={() => { if (pendingId !== null) restoreMutation.mutate({ snapshotId: pendingId }); }}
        title={t('settings.data.layouts.restoreConfirmTitle')}
        description={t('settings.data.layouts.restoreConfirmBody')}
        confirmLabel={t('settings.data.layouts.restore')}
        isLoading={restoreMutation.isPending}
      />
    </FormSection>
  );
};

const HeatmapAlwaysCollectSection = () => {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  // Destructure default only catches `undefined`, not `null` (which the
  // visual-regression tRPC fixture returns for unmocked paths). See the
  // analogous note in LayoutSnapshotsSection above.
  const { data: symbolsRaw } = trpc.heatmap.getAlwaysCollectSymbols.useQuery();
  const symbols = symbolsRaw ?? [];
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
    <FormSection
      title={t('settings.data.heatmap.title')}
      description={t('settings.data.heatmap.description')}
    >
      <HStack gap={2}>
        <Input
          size="sm"
          placeholder={t('settings.data.heatmap.placeholder')}
          value={newSymbol}
          onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          maxW="200px"
        />
        <Button size="sm" variant="outline" onClick={handleAdd} loading={addMutation.isPending}>
          <LuPlus />
          {t('settings.data.heatmap.add')}
        </Button>
      </HStack>

      {symbols.length > 0 ? (
        <Flex gap={2} flexWrap="wrap">
          {symbols.map((s) => (
            <Badge key={s} size="md" px={2} py={0.5} colorPalette="blue">
              {s}
              <Box as="button" ml={1} cursor="pointer" opacity={0.7} _hover={{ opacity: 1 }} onClick={() => removeMutation.mutate({ symbol: s })}>
                <LuX size={12} />
              </Box>
            </Badge>
          ))}
        </Flex>
      ) : (
        <EmptyState title={t('settings.data.heatmap.empty')} />
      )}
    </FormSection>
  );
};

export const DataTab = () => {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const { data: cooldowns } = trpc.kline.getCooldowns.useQuery();
  const { data: statusEntries, refetch: refetchStatus } = trpc.kline.getMaintenanceStatus.useQuery();
  const { data: periodicData, refetch: refetchPeriodic } = trpc.kline.isPeriodicEnabled.useQuery();
  const periodicEnabled = periodicData?.enabled ?? false;
  const setPeriodicMutation = trpc.kline.setPeriodicEnabled.useMutation({
    onSuccess: () => { void refetchPeriodic(); },
  });

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
    <Stack gap={5}>
      <FormSection
        title={t('settings.data.maintenance.title')}
        description={t('settings.data.maintenance.description')}
      >
        <FormRow
          label={t('settings.data.maintenance.periodicEnabled')}
          helper={t('settings.data.maintenance.periodicEnabledHelper')}
        >
          <Switch
            checked={periodicEnabled}
            onCheckedChange={(enabled) => setPeriodicMutation.mutate({ enabled })}
            size="sm"
            aria-label={t('settings.data.maintenance.periodicEnabled')}
            data-testid="data-maintenance-periodic"
          />
        </FormRow>
        <Box>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setRepairResult(null); repairAllMutation.mutate(); }}
            loading={repairAllMutation.isPending}
            loadingText={t('settings.data.maintenance.repairing')}
            data-testid="data-repair-all"
          >
            <LuWrench />
            {t('settings.data.maintenance.repairAll')}
          </Button>
        </Box>

        {repairResult && (
          <Callout tone={repairResult.gapsFilled > 0 || repairResult.corruptedFixed > 0 ? 'warning' : 'success'} compact>
            {t('settings.data.maintenance.pairsChecked', { count: repairResult.pairsChecked })}
            {' · '}
            {t('settings.data.maintenance.gapsFilled', { count: repairResult.gapsFilled })}
            {' · '}
            {t('settings.data.maintenance.corruptedFixed', { count: repairResult.corruptedFixed })}
          </Callout>
        )}
      </FormSection>

      {statusEntries && statusEntries.length > 0 && (
        <FormSection title={t('settings.data.status.title')}>
          <TradingTable columns={statusColumns(t)} minW="600px">
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
        </FormSection>
      )}

      <FormSection
        title={t('settings.data.cooldowns.title')}
        description={t('settings.data.cooldowns.description')}
        action={
          <Button variant="outline" size="2xs" onClick={handleResetCooldowns}>
            <LuRefreshCw />
            {t('settings.resetToDefaults')}
          </Button>
        }
      >
        <Box>
          <Text fontSize="xs" mb={1.5}>{t('settings.data.cooldowns.gapCheck', { hours: gapCheckHours })}</Text>
          <Slider value={[gapCheckHours]} onValueChange={handleGapCheckChange} min={0.5} max={24} step={0.5} />
        </Box>
        <Box>
          <Text fontSize="xs" mb={1.5}>{t('settings.data.cooldowns.corruptionCheck', { hours: corruptionCheckHours })}</Text>
          <Slider value={[corruptionCheckHours]} onValueChange={handleCorruptionCheckChange} min={0.5} max={24} step={0.5} />
        </Box>
      </FormSection>

      <FormSection
        title={t('settings.data.storage.title')}
        description={t('settings.data.storage.description')}
      >
        <HStack gap={3} flexWrap="wrap" align="center">
          {dbSize !== undefined && (
            <Text fontSize="xs">{t('settings.data.storage.size', { size: formatBytes(dbSize) })}</Text>
          )}
          <Button variant="outline" size="sm" colorPalette="red" onClick={() => setShowClearConfirm(true)} data-testid="data-clear-storage">
            <LuTrash2 />
            {t('settings.data.storage.clearAll')}
          </Button>
        </HStack>
      </FormSection>

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

      <LayoutSnapshotsSection />

      <HeatmapAlwaysCollectSection />
    </Stack>
  );
};
