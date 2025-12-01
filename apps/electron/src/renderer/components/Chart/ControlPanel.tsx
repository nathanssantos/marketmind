import { Box, HStack, IconButton, Stack, Text } from '@chakra-ui/react';
import type { ReactElement, ReactNode } from 'react';
import { useState } from 'react';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';

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
      bg="bg.muted"
      borderRadius="md"
      boxShadow="lg"
      opacity={0.95}
      minWidth="200px"
      borderWidth={1}
      borderColor="border"
    >
      <HStack
        justify="space-between"
        px={3}
        py={2}
        borderBottom={isExpanded ? '1px solid' : 'none'}
        borderColor="border"
        cursor="pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        _hover={{ bg: 'bg.surface' }}
        borderTopRadius="md"
      >
        <Text fontSize="sm" fontWeight="semibold" color="fg">
          {title}
        </Text>
        <IconButton
          size="xs"
          aria-label={isExpanded ? 'Collapse panel' : 'Expand panel'}
          variant="ghost"
          colorPalette="gray"
          color="fg.muted"
        >
          {isExpanded ? <LuChevronUp size={14} /> : <LuChevronDown size={14} />}
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
