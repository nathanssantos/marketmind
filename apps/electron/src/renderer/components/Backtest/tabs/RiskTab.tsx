import { Grid, GridItem, HStack, Text, VStack } from '@chakra-ui/react';
import { CollapsibleSection, Field, NumberInput, Select, Switch } from '@renderer/components/ui';
import type { SimpleBacktestInput } from '@marketmind/types';
import { useTranslation } from 'react-i18next';
import type { SetField } from '../BacktestForm';

interface RiskTabProps {
  state: SimpleBacktestInput;
  setField: SetField;
  fieldErrors: Record<string, string>;
}

const FIBONACCI_LEVEL_OPTIONS = [
  { value: 'auto', label: 'auto' },
  { value: '1', label: '1.0' },
  { value: '1.272', label: '1.272' },
  { value: '1.382', label: '1.382' },
  { value: '1.618', label: '1.618' },
  { value: '2', label: '2.0' },
  { value: '2.618', label: '2.618' },
  { value: '3', label: '3.0' },
  { value: '3.618', label: '3.618' },
  { value: '4.236', label: '4.236' },
];

const TP_MODE_OPTIONS = [
  { value: 'default', label: 'Default (R:R based)' },
  { value: 'fibonacci', label: 'Fibonacci projection' },
];

const SWING_RANGE_OPTIONS = [
  { value: 'nearest', label: 'Nearest swing' },
  { value: 'extended', label: 'Extended (full window)' },
];

const STOP_MODE_OPTIONS = [
  { value: 'fibo_target', label: 'Fibonacci-based' },
  { value: 'nearest_swing', label: 'Nearest swing' },
];

const DIRECTION_OPTIONS = [
  { value: '', label: 'Both directions' },
  { value: 'long_only', label: 'Long only' },
  { value: 'short_only', label: 'Short only' },
];

export const RiskTab = ({ state, setField, fieldErrors }: RiskTabProps) => {
  const { t } = useTranslation();

  return (
    <VStack align="stretch" gap={3} maxH="440px" overflowY="auto" pr={2}>
      <CollapsibleSection title={t('backtest.risk.sizing')} defaultOpen size="sm" variant="static">
        <Grid templateColumns="repeat(2, 1fr)" gap={3}>
          <Field label={t('backtest.risk.positionSizePercent')} invalid={!!fieldErrors['positionSizePercent']} errorText={fieldErrors['positionSizePercent']}>
            <NumberInput
              value={state.positionSizePercent ?? 10}
              onChange={(e) => setField('positionSizePercent', Number(e.target.value))}
              min={0.1} max={100} step={1} size="sm"
            />
          </Field>
          <Field label={t('backtest.risk.commission')} invalid={!!fieldErrors['commission']} errorText={fieldErrors['commission']}>
            <NumberInput
              value={state.commission ?? 0.0004}
              onChange={(e) => setField('commission', Number(e.target.value))}
              min={0} max={0.1} step={0.0001} size="sm"
            />
          </Field>
          <Field label={t('backtest.risk.slippagePercent')} invalid={!!fieldErrors['slippagePercent']} errorText={fieldErrors['slippagePercent']}>
            <NumberInput
              value={state.slippagePercent ?? 0.0005}
              onChange={(e) => setField('slippagePercent', Number(e.target.value))}
              min={0} max={0.1} step={0.0001} size="sm"
            />
          </Field>
          <Field label={t('backtest.risk.minRiskRewardRatioLong')} invalid={!!fieldErrors['minRiskRewardRatioLong']} errorText={fieldErrors['minRiskRewardRatioLong']}>
            <NumberInput
              value={state.minRiskRewardRatioLong ?? 1}
              onChange={(e) => setField('minRiskRewardRatioLong', Number(e.target.value))}
              min={0} step={0.1} size="sm"
            />
          </Field>
          <Field label={t('backtest.risk.minRiskRewardRatioShort')} invalid={!!fieldErrors['minRiskRewardRatioShort']} errorText={fieldErrors['minRiskRewardRatioShort']}>
            <NumberInput
              value={state.minRiskRewardRatioShort ?? 1}
              onChange={(e) => setField('minRiskRewardRatioShort', Number(e.target.value))}
              min={0} step={0.1} size="sm"
            />
          </Field>
          <Field
            label={t('backtest.risk.maxConcurrentPositions')}
            invalid={!!fieldErrors['maxConcurrentPositions']}
            errorText={fieldErrors['maxConcurrentPositions']}
            helperText={t('backtest.risk.maxConcurrentPositionsHelper')}
          >
            <NumberInput
              value={state.maxConcurrentPositions ?? 10}
              onChange={(e) => setField('maxConcurrentPositions', Number(e.target.value))}
              min={1} max={100} step={1} size="sm"
            />
          </Field>
          <Field label={t('backtest.risk.minProfitPercent')} invalid={!!fieldErrors['minProfitPercent']} errorText={fieldErrors['minProfitPercent']}>
            <NumberInput
              value={state.minProfitPercent ?? 0}
              onChange={(e) => setField('minProfitPercent', Number(e.target.value))}
              min={0} step={0.1} size="sm"
            />
          </Field>
        </Grid>
      </CollapsibleSection>

      <CollapsibleSection title={t('backtest.risk.stops')} size="sm" variant="static">
        <Grid templateColumns="repeat(2, 1fr)" gap={3}>
          <GridItem colSpan={2}>
            <HStack justify="space-between">
              <Text fontSize="xs">{t('backtest.risk.useAlgorithmicLevels')}</Text>
              <Switch
                checked={state.useAlgorithmicLevels === true}
                onCheckedChange={(v) => setField('useAlgorithmicLevels', v)}
              />
            </HStack>
          </GridItem>
          <Field label={t('backtest.risk.stopLossPercent')} invalid={!!fieldErrors['stopLossPercent']} errorText={fieldErrors['stopLossPercent']}>
            <NumberInput
              value={state.stopLossPercent ?? 0}
              onChange={(e) => setField('stopLossPercent', Number(e.target.value))}
              min={0} step={0.1} size="sm"
              disabled={state.useAlgorithmicLevels === true}
            />
          </Field>
          <Field label={t('backtest.risk.takeProfitPercent')} invalid={!!fieldErrors['takeProfitPercent']} errorText={fieldErrors['takeProfitPercent']}>
            <NumberInput
              value={state.takeProfitPercent ?? 0}
              onChange={(e) => setField('takeProfitPercent', Number(e.target.value))}
              min={0} step={0.1} size="sm"
              disabled={state.useAlgorithmicLevels === true}
            />
          </Field>
        </Grid>
      </CollapsibleSection>

      <CollapsibleSection title={t('backtest.risk.fibonacci')} size="sm" variant="static">
        <Grid templateColumns="repeat(2, 1fr)" gap={3}>
          <Field label={t('backtest.risk.tpCalculationMode')}>
            <Select
              value={state.tpCalculationMode ?? 'fibonacci'}
              options={TP_MODE_OPTIONS}
              onChange={(v) => setField('tpCalculationMode', v as 'default' | 'fibonacci')}
              usePortal={false} size="sm"
            />
          </Field>
          <Field label={t('backtest.risk.fibonacciSwingRange')}>
            <Select
              value={state.fibonacciSwingRange ?? 'nearest'}
              options={SWING_RANGE_OPTIONS}
              onChange={(v) => setField('fibonacciSwingRange', v as 'nearest' | 'extended')}
              usePortal={false} size="sm"
            />
          </Field>
          <Field label={t('backtest.risk.fibonacciTargetLevelLong')}>
            <Select
              value={state.fibonacciTargetLevelLong ?? '1.272'}
              options={FIBONACCI_LEVEL_OPTIONS}
              onChange={(v) => setField('fibonacciTargetLevelLong', v as never)}
              usePortal={false} size="sm"
            />
          </Field>
          <Field label={t('backtest.risk.fibonacciTargetLevelShort')}>
            <Select
              value={state.fibonacciTargetLevelShort ?? '1.272'}
              options={FIBONACCI_LEVEL_OPTIONS}
              onChange={(v) => setField('fibonacciTargetLevelShort', v as never)}
              usePortal={false} size="sm"
            />
          </Field>
          <Field label={t('backtest.risk.maxFibonacciEntryProgressPercentLong')}>
            <NumberInput
              value={state.maxFibonacciEntryProgressPercentLong ?? 127.2}
              onChange={(e) => setField('maxFibonacciEntryProgressPercentLong', Number(e.target.value))}
              min={0} max={400} step={1} size="sm"
            />
          </Field>
          <Field label={t('backtest.risk.maxFibonacciEntryProgressPercentShort')}>
            <NumberInput
              value={state.maxFibonacciEntryProgressPercentShort ?? 127.2}
              onChange={(e) => setField('maxFibonacciEntryProgressPercentShort', Number(e.target.value))}
              min={0} max={400} step={1} size="sm"
            />
          </Field>
          <Field label={t('backtest.risk.initialStopMode')}>
            <Select
              value={state.initialStopMode ?? 'fibo_target'}
              options={STOP_MODE_OPTIONS}
              onChange={(v) => setField('initialStopMode', v as 'fibo_target' | 'nearest_swing')}
              usePortal={false} size="sm"
            />
          </Field>
        </Grid>
      </CollapsibleSection>

      <CollapsibleSection title={t('backtest.risk.cooldown')} size="sm" variant="static">
        <Grid templateColumns="repeat(2, 1fr)" gap={3}>
          <GridItem colSpan={2}>
            <HStack justify="space-between">
              <Text fontSize="xs">{t('backtest.risk.useCooldown')}</Text>
              <Switch
                checked={state.useCooldown !== false}
                onCheckedChange={(v) => setField('useCooldown', v)}
              />
            </HStack>
          </GridItem>
          <Field label={t('backtest.risk.cooldownMinutes')}>
            <NumberInput
              value={state.cooldownMinutes ?? 15}
              onChange={(e) => setField('cooldownMinutes', Number(e.target.value))}
              min={0} step={1} size="sm"
              disabled={state.useCooldown === false}
            />
          </Field>
          <Field label={t('backtest.risk.directionMode')}>
            <Select
              value={state.directionMode ?? ''}
              options={DIRECTION_OPTIONS}
              onChange={(v) => {
                if (v === '') setField('directionMode', undefined);
                else setField('directionMode', v as 'long_only' | 'short_only');
              }}
              usePortal={false} size="sm"
            />
          </Field>
        </Grid>
      </CollapsibleSection>

      <CollapsibleSection title={t('backtest.risk.futures')} size="sm" variant="static">
        <Grid templateColumns="repeat(2, 1fr)" gap={3}>
          <GridItem colSpan={2}>
            <HStack justify="space-between">
              <Text fontSize="xs">{t('backtest.risk.simulateFundingRates')}</Text>
              <Switch
                checked={state.simulateFundingRates === true}
                onCheckedChange={(v) => setField('simulateFundingRates', v)}
              />
            </HStack>
          </GridItem>
          <GridItem colSpan={2}>
            <HStack justify="space-between">
              <Text fontSize="xs">{t('backtest.risk.simulateLiquidation')}</Text>
              <Switch
                checked={state.simulateLiquidation === true}
                onCheckedChange={(v) => setField('simulateLiquidation', v)}
              />
            </HStack>
          </GridItem>
          <GridItem colSpan={2}>
            <HStack justify="space-between">
              <Text fontSize="xs">{t('backtest.risk.useBnbDiscount')}</Text>
              <Switch
                checked={state.useBnbDiscount === true}
                onCheckedChange={(v) => setField('useBnbDiscount', v)}
              />
            </HStack>
          </GridItem>
        </Grid>
      </CollapsibleSection>
    </VStack>
  );
};
