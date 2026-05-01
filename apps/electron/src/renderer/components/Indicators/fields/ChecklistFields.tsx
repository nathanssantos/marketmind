import type { PositionSide } from '@marketmind/types';
import { Grid, HStack, VStack } from '@chakra-ui/react';
import type { ConditionOp, ConditionThreshold } from '@marketmind/trading-core';
import {
  CHECKLIST_WEIGHT_MAX,
  CHECKLIST_WEIGHT_MIN,
  CHECKLIST_WEIGHT_STEP,
  getDefaultChecklistWeight,
} from '@marketmind/types';
import { Radio, RadioGroup } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';
import { NumberField } from './NumberField';
import { SelectField } from './SelectField';

const TIMEFRAMES = ['current', '1m', '5m', '15m', '1h', '4h', '1d'] as const;

const requiresRange = (op: ConditionOp): boolean => op === 'between' || op === 'outside';
const requiresThreshold = (op: ConditionOp): boolean =>
  op === 'gt' ||
  op === 'lt' ||
  op === 'between' ||
  op === 'outside' ||
  op === 'oversold' ||
  op === 'overbought';

export interface ChecklistFieldsValue {
  timeframe: string;
  op: ConditionOp;
  threshold?: ConditionThreshold;
  tier: 'required' | 'preferred';
  side: PositionSide | 'BOTH';
  weight: number;
}

export interface ChecklistFieldsProps {
  value: ChecklistFieldsValue;
  availableOps: ConditionOp[];
  onChange: (next: ChecklistFieldsValue) => void;
}

export const ChecklistFields = ({ value, availableOps, onChange }: ChecklistFieldsProps) => {
  const { t } = useTranslation();

  const timeframeOptions = TIMEFRAMES.map((tf) => ({
    value: tf,
    label: t(`checklist.timeframes.${tf}`, { defaultValue: tf }),
  }));

  const opOptions = availableOps.map((op) => ({
    value: op,
    label: t(`checklist.ops.${op}`, { defaultValue: op }),
  }));

  const thresholdLabel = t('checklist.threshold');
  const lowLabel = t('checklist.thresholdLow');
  const highLabel = t('checklist.thresholdHigh');

  const thresholdPair: [number, number] = Array.isArray(value.threshold)
    ? value.threshold
    : [0, 0];
  const thresholdScalar: number = typeof value.threshold === 'number' ? value.threshold : 0;

  return (
    <VStack gap={3} align="stretch" w="100%">
      <Grid templateColumns="1fr 1fr" gap={3}>
        <SelectField
          label={t('checklist.timeframe')}
          value={value.timeframe}
          options={timeframeOptions}
          onChange={(tf) =>
            onChange({ ...value, timeframe: tf, weight: getDefaultChecklistWeight(tf) })
          }
        />
        <SelectField
          label={t('checklist.operator')}
          value={value.op}
          options={opOptions}
          onChange={(op) => onChange({ ...value, op: op as ConditionOp })}
        />
      </Grid>

      <NumberField
        label={t('checklist.weight')}
        value={value.weight}
        min={CHECKLIST_WEIGHT_MIN}
        max={CHECKLIST_WEIGHT_MAX}
        step={CHECKLIST_WEIGHT_STEP}
        onChange={(v) => onChange({ ...value, weight: v })}
      />

      {requiresThreshold(value.op) && !requiresRange(value.op) && (
        <NumberField
          label={thresholdLabel}
          value={thresholdScalar}
          onChange={(v) => onChange({ ...value, threshold: v })}
        />
      )}

      {requiresRange(value.op) && (
        <Grid templateColumns="1fr 1fr" gap={3}>
          <NumberField
            label={lowLabel}
            value={thresholdPair[0]}
            onChange={(v) => onChange({ ...value, threshold: [v, thresholdPair[1]] })}
          />
          <NumberField
            label={highLabel}
            value={thresholdPair[1]}
            onChange={(v) => onChange({ ...value, threshold: [thresholdPair[0], v] })}
          />
        </Grid>
      )}

      <HStack gap={6}>
        <RadioGroup
          value={value.tier}
          onValueChange={({ value: tier }) =>
            onChange({ ...value, tier: tier as 'required' | 'preferred' })
          }
        >
          <HStack gap={4}>
            <Radio value="required">{t('checklist.tier.required')}</Radio>
            <Radio value="preferred">{t('checklist.tier.preferred')}</Radio>
          </HStack>
        </RadioGroup>
      </HStack>

      <HStack gap={6}>
        <RadioGroup
          value={value.side}
          onValueChange={({ value: side }) =>
            onChange({ ...value, side: side as PositionSide | 'BOTH' })
          }
        >
          <HStack gap={4}>
            <Radio value="LONG">{t('checklist.side.long')}</Radio>
            <Radio value="SHORT">{t('checklist.side.short')}</Radio>
            <Radio value="BOTH">{t('checklist.side.both')}</Radio>
          </HStack>
        </RadioGroup>
      </HStack>
    </VStack>
  );
};
