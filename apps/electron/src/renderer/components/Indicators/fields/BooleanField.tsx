import { HStack, Text } from '@chakra-ui/react';
import { Switch } from '@renderer/components/ui';

export interface BooleanFieldProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export const BooleanField = ({ label, value, onChange, disabled }: BooleanFieldProps) => {
  return (
    <HStack justify="space-between" w="100%">
      <Text fontSize="sm">{label}</Text>
      <Switch checked={value} onCheckedChange={onChange} disabled={disabled} />
    </HStack>
  );
};
