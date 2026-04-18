import { HStack, Text } from '@chakra-ui/react';
import { ColorPicker, Field } from '@renderer/components/ui';

export interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
}

export const ColorField = ({ label, value, onChange, disabled }: ColorFieldProps) => {
  return (
    <Field label={label}>
      <HStack gap={2}>
        <ColorPicker value={value} onChange={onChange} disabled={disabled} ariaLabel={label} size="md" />
        <Text fontSize="xs" fontFamily="mono" color="fg.muted">
          {value}
        </Text>
      </HStack>
    </Field>
  );
};
