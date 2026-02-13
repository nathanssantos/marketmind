import { Box, Collapsible, Flex, Text } from '@chakra-ui/react';
import { useState, type ReactNode } from 'react';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';

interface CollapsibleSectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  children: ReactNode;
  headerAction?: ReactNode;
  badge?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  onToggle?: (isOpen: boolean) => void;
}

const sizeConfig = {
  sm: { titleSize: 'xs' as const, titleWeight: 'semibold' as const, descSize: 'xs' as const, iconSize: 14, py: 2, gap: 2 },
  md: { titleSize: 'sm' as const, titleWeight: 'semibold' as const, descSize: 'xs' as const, iconSize: 16, py: 3, gap: 3 },
  lg: { titleSize: 'lg' as const, titleWeight: 'bold' as const, descSize: 'sm' as const, iconSize: 20, py: 2, gap: 4 },
} as const;

export const CollapsibleSection = ({
  title,
  description,
  defaultOpen = false,
  open,
  onOpenChange,
  children,
  headerAction,
  badge,
  size = 'md',
  onToggle,
}: CollapsibleSectionProps) => {
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = isControlled ? open : internalOpen;
  const config = sizeConfig[size];

  const handleToggle = () => {
    const next = !isOpen;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
    onToggle?.(next);
  };

  const ChevronIcon = isOpen ? LuChevronUp : LuChevronDown;

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
        <Box>
          <Flex align="center" gap={2}>
            <Text fontSize={config.titleSize} fontWeight={config.titleWeight}>
              {title}
            </Text>
            {badge}
          </Flex>
          {description && (
            <Text fontSize={config.descSize} color="fg.muted">
              {description}
            </Text>
          )}
        </Box>
        <Flex align="center" gap={2}>
          {headerAction && (
            <Box onClick={(e) => e.stopPropagation()}>
              {headerAction}
            </Box>
          )}
          <ChevronIcon size={config.iconSize} />
        </Flex>
      </Box>
      <Collapsible.Content>
        <Box pt={config.gap} pb={2}>
          {children}
        </Box>
      </Collapsible.Content>
    </Collapsible.Root>
  );
};
