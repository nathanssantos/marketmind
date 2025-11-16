import { Box, HStack, IconButton, Stack, Text } from '@chakra-ui/react';
import { HiOutlineChevronDown, HiOutlineChevronUp } from 'react-icons/hi';
import type { ReactElement, ReactNode } from 'react';
import { useState } from 'react';

export interface ControlPanelProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
}

export const ControlPanel = ({
  title,
  children,
  defaultExpanded = true,
}: ControlPanelProps): ReactElement => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <Box
      bg="gray.800"
      borderRadius="md"
      boxShadow="lg"
      opacity={0.95}
      minWidth="200px"
    >
      <HStack
        justify="space-between"
        px={3}
        py={2}
        borderBottom={isExpanded ? '1px solid' : 'none'}
        borderColor="gray.700"
        cursor="pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        _hover={{ bg: 'gray.750' }}
        borderTopRadius="md"
      >
        <Text fontSize="sm" fontWeight="semibold" color="gray.200">
          {title}
        </Text>
        <IconButton
          size="xs"
          aria-label={isExpanded ? 'Collapse panel' : 'Expand panel'}
          variant="ghost"
          colorPalette="gray"
          color="gray.400"
        >
          {isExpanded ? <HiOutlineChevronUp size={14} /> : <HiOutlineChevronDown size={14} />}
        </IconButton>
      </HStack>

      {isExpanded && (
        <Box p={3}>
          <Stack gap={3}>
            {children}
          </Stack>
        </Box>
      )}
    </Box>
  );
};
