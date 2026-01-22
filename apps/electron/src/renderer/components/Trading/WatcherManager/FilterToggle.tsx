import { Box, Flex, Text } from '@chakra-ui/react';
import { Switch } from '@renderer/components/ui/switch';

export interface FilterToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export const FilterToggle = ({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: FilterToggleProps) => (
  <Box
    p={3}
    bg="bg.muted"
    borderRadius="md"
    borderWidth="1px"
    borderColor={checked ? 'green.500' : 'border'}
    opacity={disabled ? 0.6 : 1}
  >
    <Flex justify="space-between" align="flex-start" gap={3}>
      <Box flex={1}>
        <Text fontSize="sm" fontWeight="medium">
          {label}
        </Text>
        <Text fontSize="xs" color="fg.muted" mt={1}>
          {description}
        </Text>
      </Box>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        size="sm"
      />
    </Flex>
  </Box>
);
