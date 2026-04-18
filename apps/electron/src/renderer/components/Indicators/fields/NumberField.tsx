import { Field, NumberInput } from '@renderer/components/ui';

export interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}

export const NumberField = ({
  label,
  value,
  onChange,
  min,
  max,
  step,
  integer = false,
  disabled,
  ariaLabel,
}: NumberFieldProps) => {
  const handleChange = (raw: string) => {
    if (raw === '') {
      onChange(Number.NaN);
      return;
    }
    const parsed = integer ? parseInt(raw, 10) : parseFloat(raw);
    if (Number.isFinite(parsed)) onChange(parsed);
  };

  return (
    <Field label={label}>
      <NumberInput
        aria-label={ariaLabel ?? label}
        value={Number.isFinite(value) ? String(value) : ''}
        onChange={(e) => handleChange(e.target.value)}
        min={min}
        max={max}
        step={step ?? (integer ? 1 : 0.1)}
        disabled={disabled}
        size="sm"
      />
    </Field>
  );
};
