import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { Switch } from '@renderer/components/ui';

/**
 * Shared building blocks for header-trigger popovers (Timeframe,
 * Indicators, Layers, Tools, Symbol). Centralizes the typography,
 * spacing, and hover affordances so each popover doesn't drift on
 * its own.
 *
 * Three components:
 *   - PopoverList — wraps the popover body. Pads the box, spaces the
 *     header from the items.
 *   - PopoverListHeader — sticky-style title row with optional action
 *     slot on the right (e.g. "Show all" / "+ New").
 *   - PopoverActionItem — clickable row (cursor pointer + hover bg)
 *     used by selectors that pick a value or open a modal.
 *   - PopoverToggleItem — row paired with a Switch, used by
 *     visibility-toggle popovers.
 */

interface PopoverListProps {
  children: ReactNode;
  /** Body padding override. Default 2 (8px). */
  p?: number;
  /** Max-height on the items container so long lists scroll. */
  maxH?: string;
}

export const PopoverList = ({ children, p = 2, maxH = '400px' }: PopoverListProps) => (
  <Box p={p}>
    <Stack gap={2} maxH={maxH} overflowY="auto">
      {children}
    </Stack>
  </Box>
);

interface PopoverListHeaderProps {
  title: ReactNode;
  /** Optional content on the right side of the header (e.g. button, count). */
  action?: ReactNode;
}

export const PopoverListHeader = ({ title, action }: PopoverListHeaderProps) => (
  <Flex justify="space-between" align="center" px={1} py={0.5}>
    <Text fontSize="sm" fontWeight="semibold">{title}</Text>
    {action !== undefined && <Box flexShrink={0}>{action}</Box>}
  </Flex>
);

interface PopoverSectionLabelProps {
  children: ReactNode;
}

/**
 * Small uppercase section heading used inside grouped lists
 * (e.g. Indicators by category).
 */
export const PopoverSectionLabel = ({ children }: PopoverSectionLabelProps) => (
  <Text
    fontSize="2xs"
    fontWeight="bold"
    color="fg.muted"
    textTransform="uppercase"
    letterSpacing="wide"
    px={1}
    pt={1}
  >
    {children}
  </Text>
);

interface PopoverActionItemProps {
  /** Optional left-side icon (Lucide or CryptoIcon). */
  icon?: ReactNode;
  /** Main label (string or node). */
  label: ReactNode;
  /** When true, the row renders the active background. */
  active?: boolean;
  /** When true, the icon area is dimmed and pointer events disabled. */
  disabled?: boolean;
  /** Optional right-side content (badge, indicator dot). */
  trailing?: ReactNode;
  onClick?: () => void;
  'data-testid'?: string;
}

export const PopoverActionItem = ({
  icon,
  label,
  active = false,
  disabled = false,
  trailing,
  onClick,
  'data-testid': testId,
}: PopoverActionItemProps) => (
  <Flex
    align="center"
    justify="space-between"
    gap={2}
    px={2}
    py={1.5}
    borderRadius="md"
    cursor={disabled ? 'not-allowed' : 'pointer'}
    bg={active ? 'bg.muted' : 'transparent'}
    opacity={disabled ? 0.5 : 1}
    _hover={disabled ? undefined : { bg: 'bg.muted' }}
    onClick={disabled ? undefined : onClick}
    data-testid={testId}
  >
    <Flex align="center" gap={2} flex={1} minW={0}>
      {icon !== undefined && <Box color="fg.muted" flexShrink={0}>{icon}</Box>}
      <Text fontSize="xs" fontWeight={active ? 'semibold' : 'medium'} truncate>
        {label}
      </Text>
    </Flex>
    {trailing !== undefined && <Box flexShrink={0}>{trailing}</Box>}
  </Flex>
);

interface PopoverToggleItemProps {
  /** Optional left-side icon. */
  icon?: ReactNode;
  /** Main label (string or node). */
  label: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Trailing content rendered between the label and the switch (e.g. count badge). */
  trailing?: ReactNode;
  'data-testid'?: string;
  /** aria-label override for the Switch (default: stringified label). */
  ariaLabel?: string;
}

export const PopoverToggleItem = ({
  icon,
  label,
  checked,
  onCheckedChange,
  disabled = false,
  trailing,
  'data-testid': testId,
  ariaLabel,
}: PopoverToggleItemProps) => (
  <Flex align="center" justify="space-between" gap={2} px={2} py={1}>
    <Flex align="center" gap={2} flex={1} minW={0}>
      {icon !== undefined && <Box color="fg.muted" flexShrink={0}>{icon}</Box>}
      <Text fontSize="xs" fontWeight="medium" truncate>{label}</Text>
    </Flex>
    {trailing !== undefined && <Box flexShrink={0}>{trailing}</Box>}
    <Switch
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel ?? (typeof label === 'string' ? label : '')}
      data-testid={testId}
    />
  </Flex>
);
