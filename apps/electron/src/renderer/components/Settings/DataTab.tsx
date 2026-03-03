import { Button } from '@/renderer/components/ui/button';
import { Slider } from '@/renderer/components/ui/slider';
import { useDebounceCallback } from '@/renderer/hooks/useDebounceCallback';
import { trpc } from '@/renderer/utils/trpc';
import { Badge, Box, HStack, Separator, Stack, Table, Text } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuRefreshCw, LuWrench } from 'react-icons/lu';

const MS_PER_HOUR = 3_600_000;
const DEFAULT_COOLDOWN_HOURS = 2;

const formatTimeAgo = (date: Date | string | null): string => {
  if (!date) return '—';
  const diffMs = Date.now() - new Date(date).getTime();
  const diffH = Math.floor(diffMs / MS_PER_HOUR);
  if (diffH < 1) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
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
            <Box overflowX="auto">
              <Table.Root size="sm" variant="outline">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>{t('settings.data.status.symbol')}</Table.ColumnHeader>
                    <Table.ColumnHeader>{t('settings.data.status.interval')}</Table.ColumnHeader>
                    <Table.ColumnHeader>{t('settings.data.status.market')}</Table.ColumnHeader>
                    <Table.ColumnHeader>{t('settings.data.status.lastCheck')}</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="right">{t('settings.data.status.gapsFound')}</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="right">{t('settings.data.status.corruptedFixed')}</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {statusEntries.map((entry) => (
                    <Table.Row key={`${entry.symbol}-${entry.interval}-${entry.marketType}`}>
                      <Table.Cell fontWeight="medium">{entry.symbol}</Table.Cell>
                      <Table.Cell>{entry.interval}</Table.Cell>
                      <Table.Cell>
                        <Badge size="sm" colorPalette={entry.marketType === 'FUTURES' ? 'orange' : 'blue'}>
                          {entry.marketType}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell color="fg.muted" fontSize="xs">{formatTimeAgo(entry.lastGapCheck)}</Table.Cell>
                      <Table.Cell textAlign="right">
                        <Badge size="sm" colorPalette={entry.gapsFound > 0 ? 'red' : 'green'}>{entry.gapsFound}</Badge>
                      </Table.Cell>
                      <Table.Cell textAlign="right">
                        <Badge size="sm" colorPalette={entry.corruptedFixed > 0 ? 'orange' : 'green'}>{entry.corruptedFixed}</Badge>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
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
    </Stack>
  );
};
