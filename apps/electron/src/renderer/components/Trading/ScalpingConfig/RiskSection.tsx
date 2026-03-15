import { VStack, Text } from '@chakra-ui/react';
import { Switch, Slider, Field } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';

interface RiskSectionProps {
  positionSizePercent: number;
  maxConcurrentPositions: number;
  maxDailyTrades: number;
  maxDailyLossPercent: number;
  leverage: number;
  circuitBreakerEnabled: boolean;
  circuitBreakerLossPercent: number;
  circuitBreakerMaxTrades: number;
  onParamChange: (key: string, value: number | boolean) => void;
}

export function RiskSection({
  positionSizePercent,
  maxConcurrentPositions,
  maxDailyTrades,
  maxDailyLossPercent,
  leverage,
  circuitBreakerEnabled,
  circuitBreakerLossPercent,
  circuitBreakerMaxTrades,
  onParamChange,
}: RiskSectionProps) {
  const { t } = useTranslation();

  return (
    <VStack gap={4} align="stretch">
      <Text fontWeight="semibold">{t('scalping.config.risk', 'Risk Management')}</Text>

      <Field label={t('scalping.config.positionSize', 'Position Size %')}>
        <Slider
          min={0.1}
          max={25}
          step={0.1}
          value={[positionSizePercent]}
          onValueChange={(values) => onParamChange('positionSizePercent', values[0] ?? 0)}
        />
        <Text fontSize="xs" color="fg.muted">{positionSizePercent.toFixed(1)}%</Text>
      </Field>

      <Field label={t('scalping.config.maxConcurrent', 'Max Concurrent Positions')}>
        <Slider
          min={1}
          max={10}
          step={1}
          value={[maxConcurrentPositions]}
          onValueChange={(values) => onParamChange('maxConcurrentPositions', values[0] ?? 0)}
        />
        <Text fontSize="xs" color="fg.muted">{maxConcurrentPositions}</Text>
      </Field>

      <Field label={t('scalping.config.maxDailyTrades', 'Max Daily Trades')}>
        <Slider
          min={5}
          max={500}
          step={5}
          value={[maxDailyTrades]}
          onValueChange={(values) => onParamChange('maxDailyTrades', values[0] ?? 0)}
        />
        <Text fontSize="xs" color="fg.muted">{maxDailyTrades}</Text>
      </Field>

      <Field label={t('scalping.config.maxDailyLoss', 'Max Daily Loss %')}>
        <Slider
          min={0.5}
          max={20}
          step={0.5}
          value={[maxDailyLossPercent]}
          onValueChange={(values) => onParamChange('maxDailyLossPercent', values[0] ?? 0)}
        />
        <Text fontSize="xs" color="fg.muted">{maxDailyLossPercent.toFixed(1)}%</Text>
      </Field>

      <Field label={t('scalping.config.leverage', 'Leverage')}>
        <Slider
          min={1}
          max={50}
          step={1}
          value={[leverage]}
          onValueChange={(values) => onParamChange('leverage', values[0] ?? 0)}
        />
        <Text fontSize="xs" color="fg.muted">{leverage}x</Text>
      </Field>

      <Switch
        checked={circuitBreakerEnabled}
        onCheckedChange={(checked) => onParamChange('circuitBreakerEnabled', checked)}
      >
        {t('scalping.config.circuitBreaker', 'Circuit Breaker')}
      </Switch>

      {circuitBreakerEnabled && (
        <>
          <Field label={t('scalping.config.cbLossPercent', 'CB Loss %')}>
            <Slider
              min={0.5}
              max={10}
              step={0.5}
              value={[circuitBreakerLossPercent]}
              onValueChange={(values) => onParamChange('circuitBreakerLossPercent', values[0] ?? 0)}
            />
            <Text fontSize="xs" color="fg.muted">{circuitBreakerLossPercent.toFixed(1)}%</Text>
          </Field>

          <Field label={t('scalping.config.cbMaxTrades', 'CB Max Trades')}>
            <Slider
              min={10}
              max={200}
              step={5}
              value={[circuitBreakerMaxTrades]}
              onValueChange={(values) => onParamChange('circuitBreakerMaxTrades', values[0] ?? 0)}
            />
            <Text fontSize="xs" color="fg.muted">{circuitBreakerMaxTrades}</Text>
          </Field>
        </>
      )}
    </VStack>
  );
}
