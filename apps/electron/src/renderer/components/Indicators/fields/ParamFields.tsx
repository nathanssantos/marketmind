import { VStack } from '@chakra-ui/react';
import type { IndicatorParamValue, ParamSchema } from '@marketmind/trading-core';
import type { SelectOption } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';
import { BooleanField } from './BooleanField';
import { ColorField } from './ColorField';
import { NumberField } from './NumberField';
import { SelectField } from './SelectField';

export interface ParamFieldsProps {
  params: ParamSchema[];
  values: Record<string, IndicatorParamValue>;
  onChange: (key: string, value: IndicatorParamValue) => void;
  disabled?: boolean;
}

export const ParamFields = ({ params, values, onChange, disabled }: ParamFieldsProps) => {
  const { t } = useTranslation();

  return (
    <VStack gap={3} align="stretch" w="100%">
      {params.map((p) => {
        const label = t(p.labelKey, { defaultValue: p.key });
        const current = values[p.key] ?? p.default;

        if (p.type === 'number' || p.type === 'integer') {
          return (
            <NumberField
              key={p.key}
              label={label}
              value={Number(current)}
              onChange={(v) => onChange(p.key, v)}
              min={p.min}
              max={p.max}
              step={p.step}
              integer={p.type === 'integer'}
              disabled={disabled}
            />
          );
        }

        if (p.type === 'color') {
          return (
            <ColorField
              key={p.key}
              label={label}
              value={String(current)}
              onChange={(v) => onChange(p.key, v)}
              disabled={disabled}
            />
          );
        }

        if (p.type === 'boolean') {
          return (
            <BooleanField
              key={p.key}
              label={label}
              value={Boolean(current)}
              onChange={(v) => onChange(p.key, v)}
              disabled={disabled}
            />
          );
        }

        const options: SelectOption[] =
          p.options?.map((o) => ({
            value: String(o.value),
            label: t(o.labelKey, { defaultValue: String(o.value) }),
          })) ?? [];

        return (
          <SelectField
            key={p.key}
            label={label}
            value={String(current)}
            options={options}
            onChange={(v) => onChange(p.key, v)}
            disabled={disabled}
          />
        );
      })}
    </VStack>
  );
};
