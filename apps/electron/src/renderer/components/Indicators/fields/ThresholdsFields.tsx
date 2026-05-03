import { Stack, Text } from '@chakra-ui/react';
import type { IndicatorDefinition, IndicatorParamValue } from '@marketmind/trading-core';
import { THRESHOLD_PARAM_KEYS } from '@marketmind/trading-core';
import { useTranslation } from 'react-i18next';
import { NumberField } from './NumberField';

export interface ThresholdsFieldsProps {
  definition: IndicatorDefinition;
  values: Record<string, IndicatorParamValue>;
  onChange: (key: string, value: IndicatorParamValue) => void;
  disabled?: boolean;
}

const readNumber = (value: IndicatorParamValue | undefined, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
};

export const ThresholdsFields = ({ definition, values, onChange, disabled }: ThresholdsFieldsProps) => {
  const { t } = useTranslation();

  const oversoldDefault = definition.defaultThresholds?.oversold;
  const overboughtDefault = definition.defaultThresholds?.overbought;
  if (typeof oversoldDefault !== 'number' || typeof overboughtDefault !== 'number') return null;

  const oversold = readNumber(values[THRESHOLD_PARAM_KEYS.oversold], oversoldDefault);
  const overbought = readNumber(values[THRESHOLD_PARAM_KEYS.overbought], overboughtDefault);

  return (
    <Stack gap={2} align="stretch" w="100%">
      <Stack gap={0.5}>
        <Text fontSize="sm" fontWeight="semibold">{t('indicators.dialog.thresholds')}</Text>
        <Text fontSize="xs" color="fg.muted">{t('indicators.dialog.thresholdsHint')}</Text>
      </Stack>
      <NumberField
        label={t('indicators.dialog.oversold')}
        value={oversold}
        onChange={(v) => onChange(THRESHOLD_PARAM_KEYS.oversold, v)}
        disabled={disabled}
      />
      <NumberField
        label={t('indicators.dialog.overbought')}
        value={overbought}
        onChange={(v) => onChange(THRESHOLD_PARAM_KEYS.overbought, v)}
        disabled={disabled}
      />
    </Stack>
  );
};
