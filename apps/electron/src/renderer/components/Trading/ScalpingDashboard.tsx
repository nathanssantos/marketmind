import { HStack, Flex, Stack, Text, Box } from '@chakra-ui/react';
import { Button, Badge, IconButton, DirectionModeSelector, type DirectionMode } from '@renderer/components/ui';
import { LuSettings } from 'react-icons/lu';
import { useTranslation } from 'react-i18next';
import { useBackendScalping } from '@renderer/hooks/useBackendScalping';
import { useScalpingSignals } from '@renderer/hooks/useScalpingSignals';
import { OrderFlowMetrics } from '../OrderFlow/OrderFlowMetrics';

interface ScalpingDashboardProps {
  walletId: string;
  symbol: string;
  onConfigClick: () => void;
}

export function ScalpingDashboard({ walletId, symbol, onConfigClick }: ScalpingDashboardProps) {
  const { t } = useTranslation();
  const { config, status, start, stop, resetCircuitBreaker, upsertConfig } = useBackendScalping(walletId);
  const { signals } = useScalpingSignals(walletId);
  const statusData = status.data;
  const isRunning = statusData?.isRunning ?? false;
  const directionMode = (config.data?.directionMode as DirectionMode) ?? 'auto';

  const handleToggle = () => {
    if (isRunning) stop.mutate({ walletId });
    else start.mutate({ walletId });
  };

  const handleDirectionChange = (mode: DirectionMode) => {
    upsertConfig.mutate({ walletId, directionMode: mode });
  };

  return (
    <Stack gap={3} align="stretch" p={4}>
      <Flex p={3} bg="bg.muted" borderRadius="md" justify="space-between" align="center" fontSize="xs">
        <Stack gap={0}>
          <Text color="fg.muted" fontWeight="medium">{t('scalping.metric.sessionPnl', 'Session P&L')}</Text>
          <Text color="fg.muted" fontSize="2xs">
            {statusData?.tradeCount ?? 0} {t('trading.portfolio.trades', 'trades')} · {t('scalping.metric.winRate', 'Win Rate')} {((statusData?.winRate ?? 0) * 100).toFixed(1)}%
          </Text>
        </Stack>
        <Flex align="center" gap={2}>
          <Text fontWeight="medium" fontSize="sm" color={pnlColor(statusData?.sessionPnl ?? 0)}>
            {formatPnl(statusData?.sessionPnl ?? 0)}
          </Text>
          <Badge colorPalette={isRunning ? 'green' : 'gray'} px={2}>
            {isRunning ? t('scalping.status.running', 'Running') : t('scalping.status.stopped', 'Stopped')}
          </Badge>
        </Flex>
      </Flex>

      <DirectionModeSelector
        value={directionMode}
        onChange={handleDirectionChange}
        disabled={upsertConfig.isPending}
        size="2xs"
      />

      <HStack>
        <Button size="xs" colorPalette={isRunning ? 'red' : 'green'} onClick={handleToggle} flex={1}>
          {isRunning ? t('common.stop', 'Stop') : t('common.start', 'Start')}
        </Button>
        <IconButton aria-label={t('common.settings', 'Settings')} size="xs" variant="outline" onClick={onConfigClick}>
          <LuSettings />
        </IconButton>
      </HStack>

      {statusData?.circuitBreakerTripped && (
        <HStack>
          <Badge colorPalette="red">{t('scalping.circuitBreaker.tripped', 'CB Tripped')}</Badge>
          <Button size="xs" variant="ghost" onClick={() => resetCircuitBreaker.mutate({ walletId })}>
            {t('scalping.circuitBreaker.reset', 'Reset')}
          </Button>
        </HStack>
      )}

      {!statusData?.circuitBreakerTripped && (statusData?.cooldownUntil ?? 0) > Date.now() && (
        <HStack>
          <Badge colorPalette="orange">{t('scalping.cooldown.active', 'Cooldown')}</Badge>
          <Text fontSize="2xs" color="fg.muted">
            {Math.ceil(((statusData?.cooldownUntil ?? 0) - Date.now()) / 60_000)}m
          </Text>
          <Button size="xs" variant="ghost" onClick={() => resetCircuitBreaker.mutate({ walletId })}>
            {t('scalping.circuitBreaker.reset', 'Reset')}
          </Button>
        </HStack>
      )}

      {isRunning && (
        <Box bg="bg.muted" borderRadius="md">
          <OrderFlowMetrics symbol={symbol} />
        </Box>
      )}

      {isRunning && signals.length > 0 && (
        <Box p={3} bg="bg.muted" borderRadius="md">
          <Stack gap={2.5} fontSize="xs">
            <Flex justify="space-between" align="center">
              <Text color="fg.muted" fontWeight="medium">{t('scalping.signals.title', 'Signals')}</Text>
            </Flex>

            <Stack gap={1} maxH="120px" overflowY="auto">
              {signals.slice(0, 5).map((signal) => (
                <Flex key={signal.id} justify="space-between" align="center">
                  <Badge size="sm" px={2} colorPalette={signal.direction === 'LONG' ? 'green' : 'red'}>
                    {signal.direction === 'LONG' ? 'L' : 'S'}
                  </Badge>
                  <Text>{signal.strategy}</Text>
                  <Text color="fg.muted">{Number(signal.confidence).toFixed(0)}%</Text>
                </Flex>
              ))}
            </Stack>
          </Stack>
        </Box>
      )}

    </Stack>
  );
}

const formatPnl = (pnl: number): string => {
  const sign = pnl >= 0 ? '+' : '';
  return `${sign}$${pnl.toFixed(2)}`;
};

const pnlColor = (pnl: number): string => {
  if (pnl > 0) return 'fg.success';
  if (pnl < 0) return 'fg.error';
  return 'fg.default';
};
