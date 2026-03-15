import { VStack, HStack, Text, Box } from '@chakra-ui/react';
import { Button, Badge, CollapsibleSection } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';
import { useBackendScalping } from '@renderer/hooks/useBackendScalping';
import { useScalpingMetrics } from '@renderer/hooks/useScalpingMetrics';
import { useScalpingSignals } from '@renderer/hooks/useScalpingSignals';
import { useDepth } from '@renderer/hooks/useDepth';
import { DomLadder } from '@renderer/components/Chart/DomLadder';
import { useState } from 'react';

const DOM_LADDER_HEIGHT = 250;

interface ScalpingDashboardProps {
  walletId: string;
  symbol: string;
  onConfigClick: () => void;
}

export function ScalpingDashboard({ walletId, symbol, onConfigClick }: ScalpingDashboardProps) {
  const { t } = useTranslation();
  const { status, start, stop, resetCircuitBreaker } = useBackendScalping(walletId);
  const metrics = useScalpingMetrics(symbol);
  const { signals } = useScalpingSignals(walletId);
  const [showDom, setShowDom] = useState(false);
  const { bids, asks } = useDepth(showDom ? symbol : null, showDom);

  const statusData = status.data;
  const isRunning = statusData?.isRunning ?? false;

  const handleToggle = () => {
    if (isRunning) stop.mutate({ walletId });
    else start.mutate({ walletId });
  };

  return (
    <VStack gap={3} align="stretch" p={3}>
      <HStack justify="space-between">
        <Text fontWeight="bold" fontSize="sm">{t('scalping.dashboard.title', 'Scalping')}</Text>
        <Badge colorPalette={isRunning ? 'green' : 'gray'} px={2}>
          {isRunning ? t('scalping.status.running', 'Running') : t('scalping.status.stopped', 'Stopped')}
        </Badge>
      </HStack>

      <HStack>
        <Button size="xs" colorPalette={isRunning ? 'red' : 'green'} onClick={handleToggle} flex={1}>
          {isRunning ? t('common.stop', 'Stop') : t('common.start', 'Start')}
        </Button>
        <Button size="xs" variant="outline" onClick={onConfigClick}>
          {t('common.settings', 'Settings')}
        </Button>
      </HStack>

      {statusData?.circuitBreakerTripped && (
        <HStack>
          <Badge colorPalette="red">{t('scalping.circuitBreaker.tripped', 'CB Tripped')}</Badge>
          <Button size="xs" variant="ghost" onClick={() => resetCircuitBreaker.mutate({ walletId })}>
            {t('scalping.circuitBreaker.reset', 'Reset')}
          </Button>
        </HStack>
      )}

      <VStack gap={1} align="stretch" fontSize="xs">
        <MetricRow label={t('scalping.metric.sessionPnl', 'Session P&L')} value={formatPnl(statusData?.sessionPnl ?? 0)} color={pnlColor(statusData?.sessionPnl ?? 0)} />
        <MetricRow label={t('scalping.metric.trades', 'Trades')} value={String(statusData?.tradeCount ?? 0)} />
        <MetricRow label={t('scalping.metric.winRate', 'Win Rate')} value={`${((statusData?.winRate ?? 0) * 100).toFixed(1)}%`} />
      </VStack>

      <Box borderTop="1px solid" borderColor="border.muted" pt={2}>
        <Text fontSize="xs" fontWeight="semibold" mb={1}>{t('scalping.metric.orderFlow', 'Order Flow')}</Text>
        <VStack gap={1} align="stretch" fontSize="xs">
          <MetricRow label="CVD" value={metrics.cvd.toFixed(2)} />
          <MetricRow label={t('scalping.metric.imbalance', 'Imbalance')} value={metrics.imbalanceRatio.toFixed(3)} />
          <MetricRow label={t('scalping.metric.spread', 'Spread')} value={`${(metrics.spreadPercent).toFixed(4)}%`} />
          <MetricRow label={t('scalping.metric.absorption', 'Absorption')} value={metrics.absorptionScore.toFixed(2)} />
        </VStack>
      </Box>

      <CollapsibleSection
        title={t('scalping.metric.domLadder', 'DOM Ladder')}
        open={showDom}
        onToggle={(open) => setShowDom(open)}
        size="sm"
      >
        {showDom && bids.length > 0 && (
          <DomLadder
            bids={bids}
            asks={asks}
            currentPrice={metrics.microprice || 0}
            height={DOM_LADDER_HEIGHT}
          />
        )}
      </CollapsibleSection>

      {signals.length > 0 && (
        <Box borderTop="1px solid" borderColor="border.muted" pt={2}>
          <Text fontSize="xs" fontWeight="semibold" mb={1}>{t('scalping.signals.title', 'Signals')}</Text>
          <VStack gap={1} align="stretch" maxH="120px" overflowY="auto">
            {signals.slice(0, 5).map((signal) => (
              <HStack key={signal.id} fontSize="xs" justify="space-between">
                <Badge size="sm" colorPalette={signal.direction === 'LONG' ? 'green' : 'red'}>
                  {signal.direction}
                </Badge>
                <Text>{signal.strategy}</Text>
                <Text color="fg.muted">{signal.confidence}%</Text>
              </HStack>
            ))}
          </VStack>
        </Box>
      )}
    </VStack>
  );
}

function MetricRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <HStack justify="space-between">
      <Text color="fg.muted">{label}</Text>
      <Text fontWeight="medium" fontFamily="mono" color={color}>{value}</Text>
    </HStack>
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
