import { Box, HStack, Stack, Text } from '@chakra-ui/react';
import { IconButton } from '@renderer/components/ui';
import type { ReactElement, ReactNode } from 'react';
import { useState } from 'react';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';

export interface ControlPanelGroupProps {
  title: string;
  children: ReactNode;
  secondaryPanel?: ReactNode;
  defaultExpanded?: boolean;
  position?: {
    top?: number | string;
    right?: number | string;
    bottom?: number | string;
    left?: number | string;
  };
}

export const ControlPanelGroup = ({
  title,
  children,
  secondaryPanel,
  defaultExpanded = true,
  position = { top: 4, left: 4 },
}: ControlPanelGroupProps): ReactElement => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <Box
      position="absolute"
      {...position}
      zIndex={10}
    >
      <Stack gap={2}>
        <Box
          bg="bg.subtle"
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
            borderColor="border"
            cursor="pointer"
            onClick={() => setIsExpanded(!isExpanded)}
            _hover={{ bg: 'gray.750' }}
            borderTopRadius="md"
          >
            <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
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

        {isExpanded && secondaryPanel && secondaryPanel}
      </Stack>
    </Box>
  );
};
