import { Field, Select } from '@renderer/components/ui';
import type { SelectOption } from '@renderer/components/ui';

export interface SelectFieldProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const SelectField = ({ label, value, options, onChange }: SelectFieldProps) => {
  return (
    <Field label={label}>
      <Select value={value} options={options} onChange={onChange} size="sm" />
    </Field>
  );
};
