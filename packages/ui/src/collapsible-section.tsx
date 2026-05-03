import { Box, Collapsible, Flex, Text } from '@chakra-ui/react';
import { useState, type ReactNode } from 'react';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';

const SIZE_CONFIG = {
  sm: { titleSize: 'xs' as const, titleWeight: 'semibold' as const, descSize: 'xs' as const, iconSize: 14, py: 2, gap: 2 },
  md: { titleSize: 'sm' as const, titleWeight: 'semibold' as const, descSize: 'xs' as const, iconSize: 16, py: 2, gap: 2 },
  lg: { titleSize: 'sm' as const, titleWeight: 'semibold' as const, descSize: 'xs' as const, iconSize: 16, py: 2, gap: 3 },
} as const;

export interface CollapsibleSectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  children: ReactNode;
  headerAction?: ReactNode;
  badge?: ReactNode;
  size?: keyof typeof SIZE_CONFIG;
  onToggle?: (isOpen: boolean) => void;
  variant?: 'collapsible' | 'static';
}

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
  variant = 'collapsible',
}: CollapsibleSectionProps) => {
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = variant === 'static' ? true : isControlled ? open : internalOpen;
  const config = SIZE_CONFIG[size];

  const handleToggle = () => {
    if (variant === 'static') return;
    const next = !isOpen;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
    onToggle?.(next);
  };

  const ChevronIcon = isOpen ? LuChevronUp : LuChevronDown;

  if (variant === 'static') {
    return (
      <Box>
        <Flex align="flex-start" justify="space-between" gap={2} mb={config.gap}>
          <Box flex={1} minW={0}>
            <Flex align="center" gap={2}>
              <Text fontSize={config.titleSize} fontWeight={config.titleWeight} lineHeight="1.2">
                {title}
              </Text>
              {badge}
            </Flex>
            {description && (
              <Text fontSize={config.descSize} color="fg.muted" mt={0.5} lineHeight="1.4">
                {description}
              </Text>
            )}
          </Box>
          {headerAction && <Box flexShrink={0}>{headerAction}</Box>}
        </Flex>
        <Box>{children}</Box>
      </Box>
    );
  }

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
