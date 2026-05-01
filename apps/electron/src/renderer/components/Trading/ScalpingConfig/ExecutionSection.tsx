import { VStack, Text } from '@chakra-ui/react';
import { Select, Slider, Field } from '@renderer/components/ui';
import type { ScalpingExecutionMode } from '@marketmind/types';
import { useTranslation } from 'react-i18next';

interface ExecutionSectionProps {
  executionMode: ScalpingExecutionMode;
  microTrailingTicks: number;
  maxSpreadPercent: number;
  signalInterval: string;
  onModeChange: (mode: ScalpingExecutionMode) => void;
  onParamChange: (key: string, value: number | string) => void;
}

const EXECUTION_MODE_OPTIONS = [
  { value: 'POST_ONLY', label: 'Post Only (GTX)' },
  { value: 'IOC', label: 'Immediate or Cancel' },
  { value: 'MARKET', label: 'Market' },
];

const SIGNAL_INTERVAL_OPTIONS = [
  { value: '1m', label: '1m' },
  { value: '3m', label: '3m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
];

export function ExecutionSection({
  executionMode,
  microTrailingTicks,
  maxSpreadPercent,
  signalInterval,
  onModeChange,
  onParamChange,
}: ExecutionSectionProps) {
  const { t } = useTranslation();

  return (
    <VStack gap={4} align="stretch">
      <Text fontWeight="semibold">{t('scalping.config.execution')}</Text>

      <Field label={t('scalping.config.executionMode')}>
        <Select
          value={executionMode}
          options={EXECUTION_MODE_OPTIONS}
          onChange={(value) => onModeChange(value as ScalpingExecutionMode)}
        />
      </Field>

      <Field label={t('scalping.config.microTrailingTicks')}>
        <Slider
          min={1}
          max={20}
          step={1}
          value={[microTrailingTicks]}
          onValueChange={(values) => onParamChange('microTrailingTicks', values[0] ?? 0)}
        />
        <Text fontSize="xs" color="fg.muted">{microTrailingTicks}</Text>
      </Field>

      <Field label={t('scalping.config.maxSpreadPercent')}>
        <Slider
          min={0.001}
          max={0.5}
          step={0.001}
          value={[maxSpreadPercent]}
          onValueChange={(values) => onParamChange('maxSpreadPercent', values[0] ?? 0)}
        />
        <Text fontSize="xs" color="fg.muted">{(maxSpreadPercent * 100).toFixed(2)}%</Text>
      </Field>

      <Field label={t('scalping.config.signalInterval')}>
        <Select
          value={signalInterval}
          options={SIGNAL_INTERVAL_OPTIONS}
          onChange={(value) => onParamChange('signalInterval', value)}
        />
      </Field>
    </VStack>
  );
}
