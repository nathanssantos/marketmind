import { Box, Collapsible, Flex, Icon, Text } from '@chakra-ui/react';
import { useState, type ReactNode } from 'react';
import { LuChevronDown, LuChevronRight } from 'react-icons/lu';

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  headerAction?: ReactNode;
  badge?: ReactNode;
  size?: 'sm' | 'md';
  onToggle?: (isOpen: boolean) => void;
}

const sizeConfig = {
  sm: { titleSize: 'xs', iconSize: 3.5, py: 2, gap: 2 },
  md: { titleSize: 'sm', iconSize: 4, py: 3, gap: 3 },
} as const;

export const CollapsibleSection = ({
  title,
  defaultOpen = false,
  children,
  headerAction,
  badge,
  size = 'md',
  onToggle,
}: CollapsibleSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const config = sizeConfig[size];

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onToggle?.(newState);
  };

  return (
    <Collapsible.Root open={isOpen}>
      <Box
        as="button"
        onClick={handleToggle}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        w="100%"
        py={config.py}
        cursor="pointer"
        _hover={{ bg: 'bg.subtle' }}
        borderRadius="md"
        px={2}
        ml={-2}
        textAlign="left"
        bg="transparent"
        border="none"
      >
        <Flex align="center" gap={2}>
          <Icon as={isOpen ? LuChevronDown : LuChevronRight} boxSize={config.iconSize} color="fg.muted" />
          <Text fontSize={config.titleSize} fontWeight="semibold">
            {title}
          </Text>
          {badge}
        </Flex>
        {headerAction && (
          <Box onClick={(e) => e.stopPropagation()}>
            {headerAction}
          </Box>
        )}
      </Box>
      <Collapsible.Content>
        <Box pt={config.gap} pb={2}>
          {children}
        </Box>
      </Collapsible.Content>
    </Collapsible.Root>
  );
};
