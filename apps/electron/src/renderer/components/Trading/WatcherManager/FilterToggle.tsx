import { Badge, Box, Flex, Text } from '@chakra-ui/react';
import { Switch } from '@renderer/components/ui/switch';

export interface FilterToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  tag?: string;
  tagColorPalette?: string;
  forceDisabled?: boolean;
}

export const FilterToggle = ({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  tag,
  tagColorPalette = 'gray',
  forceDisabled = false,
}: FilterToggleProps) => {
  const isDisabled = disabled || forceDisabled;

  return (
    <Box
      p={3}
      bg="bg.muted"
      borderRadius="md"
      borderWidth="1px"
      borderColor={!forceDisabled && checked ? 'green.500' : 'border'}
      opacity={forceDisabled ? 0.45 : isDisabled ? 0.6 : 1}
    >
      <Flex justify="space-between" align="flex-start" gap={3}>
        <Box flex={1}>
          <Flex align="center" gap={2}>
            <Text fontSize="sm" fontWeight="medium">
              {label}
            </Text>
            {tag && (
              <Badge size="sm" colorPalette={forceDisabled ? 'gray' : tagColorPalette} variant="subtle">
                {tag}
              </Badge>
            )}
          </Flex>
          <Text fontSize="xs" color="fg.muted" mt={1}>
            {description}
          </Text>
        </Box>
        <Switch
          checked={forceDisabled ? false : checked}
          onCheckedChange={onChange}
          disabled={isDisabled}
          size="sm"
        />
      </Flex>
    </Box>
  );
};
