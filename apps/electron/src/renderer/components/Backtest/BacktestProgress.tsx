import { Box, HStack, Text, VStack } from '@chakra-ui/react';
import { Button, ProgressBar, ProgressRoot } from '@renderer/components/ui';
import type { BacktestProgressPayload } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface BacktestProgressProps {
  progress: BacktestProgressPayload | null;
  onCancel: () => void;
}

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;

const ETA_SMOOTHING_KEEP = 0.7;
const ETA_SMOOTHING_NEW = 0.3;

const formatDuration = (ms: number): { hours: number; minutes: number; seconds: number } => {
  const safe = Math.max(ms, 0);
  return {
    hours: Math.floor(safe / HOUR_MS),
    minutes: Math.floor((safe % HOUR_MS) / MINUTE_MS),
    seconds: Math.floor((safe % MINUTE_MS) / SECOND_MS),
  };
};

const formatEta = (ms: number, t: ReturnType<typeof useTranslation>['t']): string => {
  const { hours, minutes, seconds } = formatDuration(ms);
  if (hours > 0) return t('backtest.progress.etaHm', { h: hours, m: minutes });
  if (minutes > 0) return t('backtest.progress.etaMs', { m: minutes, s: seconds });
  return t('backtest.progress.etaS', { s: Math.max(seconds, 1) });
};

const formatElapsed = (ms: number, t: ReturnType<typeof useTranslation>['t']): string => {
  const { hours, minutes, seconds } = formatDuration(ms);
  if (hours > 0) return t('backtest.progress.elapsedHm', { h: hours, m: minutes });
  if (minutes > 0) return t('backtest.progress.elapsedMs', { m: minutes, s: seconds });
  return t('backtest.progress.elapsedS', { s: seconds });
};

export const BacktestProgress = ({ progress, onCancel }: BacktestProgressProps) => {
  const { t } = useTranslation();

  const lastProgressRef = useRef(0);
  const smoothedEtaRef = useRef<number | null>(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 1_000);
    return () => clearInterval(interval);
  }, []);

  const rawPct = progress
    ? Math.floor((progress.processed / Math.max(progress.total, 1)) * 100)
    : 0;
  const monotonicPct = Math.max(rawPct, lastProgressRef.current);
  lastProgressRef.current = monotonicPct;

  if (progress?.etaMs != null) {
    smoothedEtaRef.current = smoothedEtaRef.current == null
      ? progress.etaMs
      : ETA_SMOOTHING_KEEP * smoothedEtaRef.current + ETA_SMOOTHING_NEW * progress.etaMs;
  }

  const elapsedMs = progress ? Date.now() - progress.startedAt : 0;

  const phaseLabel = progress
    ? t(`backtest.progress.phase.${progress.phase}`)
    : t('backtest.progress.starting');

  const etaText = progress?.etaMs == null
    ? t('backtest.progress.etaCalculating')
    : formatEta(smoothedEtaRef.current ?? progress.etaMs, t);

  return (
    <VStack align="stretch" gap={4} py={4}>
      <VStack align="stretch" gap={2}>
        <HStack justify="space-between">
          <Text fontSize="sm" fontWeight="medium">{phaseLabel}</Text>
          <Text fontSize="xs" color="fg.muted">{monotonicPct}%</Text>
        </HStack>
        <ProgressRoot value={monotonicPct} max={100} size="md" colorPalette="blue">
          <ProgressBar />
        </ProgressRoot>
      </VStack>

      <HStack justify="space-between" fontSize="xs" color="fg.muted">
        <Box>{formatElapsed(elapsedMs, t)}</Box>
        <Box>{etaText}</Box>
      </HStack>

      <HStack justify="flex-end">
        <Button size="2xs" variant="ghost" onClick={onCancel} px={3}>
          {t('common.cancel')}
        </Button>
      </HStack>
    </VStack>
  );
};
