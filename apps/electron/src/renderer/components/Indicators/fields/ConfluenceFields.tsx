import type { PositionSide } from '@marketmind/types';
import { Grid, HStack, VStack } from '@chakra-ui/react';
import type { ConditionOp, ConditionThreshold } from '@marketmind/trading-core';
import {
  CONFLUENCE_WEIGHT_MAX,
  CONFLUENCE_WEIGHT_MIN,
  CONFLUENCE_WEIGHT_STEP,
  getDefaultConfluenceWeight,
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

export interface ConfluenceFieldsValue {
  timeframe: string;
  op: ConditionOp;
  threshold?: ConditionThreshold;
  tier: 'required' | 'preferred';
  side: PositionSide | 'BOTH';
  weight: number;
}

export interface ConfluenceFieldsProps {
  value: ConfluenceFieldsValue;
  availableOps: ConditionOp[];
  onChange: (next: ConfluenceFieldsValue) => void;
}

export const ConfluenceFields = ({ value, availableOps, onChange }: ConfluenceFieldsProps) => {
  const { t } = useTranslation();

  const timeframeOptions = TIMEFRAMES.map((tf) => ({
    value: tf,
    label: t(`confluence.timeframes.${tf}`, { defaultValue: tf }),
  }));

  const opOptions = availableOps.map((op) => ({
    value: op,
    label: t(`confluence.ops.${op}`, { defaultValue: op }),
  }));

  const thresholdLabel = t('confluence.threshold');
  const lowLabel = t('confluence.thresholdLow');
  const highLabel = t('confluence.thresholdHigh');

  const thresholdPair: [number, number] = Array.isArray(value.threshold)
    ? value.threshold
    : [0, 0];
  const thresholdScalar: number = typeof value.threshold === 'number' ? value.threshold : 0;

  return (
    <VStack gap={3} align="stretch" w="100%">
      <Grid templateColumns="1fr 1fr" gap={3}>
        <SelectField
          label={t('confluence.timeframe')}
          value={value.timeframe}
          options={timeframeOptions}
          onChange={(tf) =>
            onChange({ ...value, timeframe: tf, weight: getDefaultConfluenceWeight(tf) })
          }
        />
        <SelectField
          label={t('confluence.operator')}
          value={value.op}
          options={opOptions}
          onChange={(op) => onChange({ ...value, op: op as ConditionOp })}
        />
      </Grid>

      <NumberField
        label={t('confluence.weight')}
        value={value.weight}
        min={CONFLUENCE_WEIGHT_MIN}
        max={CONFLUENCE_WEIGHT_MAX}
        step={CONFLUENCE_WEIGHT_STEP}
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
            <Radio value="required">{t('confluence.tier.required')}</Radio>
            <Radio value="preferred">{t('confluence.tier.preferred')}</Radio>
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
            <Radio value="LONG">{t('confluence.side.long')}</Radio>
            <Radio value="SHORT">{t('confluence.side.short')}</Radio>
            <Radio value="BOTH">{t('confluence.side.both')}</Radio>
          </HStack>
        </RadioGroup>
      </HStack>
    </VStack>
  );
};
