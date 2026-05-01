import { Box } from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface RecordRowProps {
  children: ReactNode;
  /**
   * Padding density. `compact` is for tight list rows (sessions, snapshots,
   * indicators); `card` is for stand-alone cards (custom symbols, wallets,
   * profiles). Defaults to `compact`.
   */
  density?: 'compact' | 'card';
  /**
   * Background tone. `default` (transparent) for inline list rows in a
   * panel; `muted` (`bg.muted`) for highlighted stat / chart cards (e.g.
   * MarketIndicators dashboard cards); `panel` (`bg.panel`) for
   * panel-on-panel content (chart legends, secondary info blocks).
   * Defaults to `default`.
   */
  tone?: 'default' | 'muted' | 'panel';
  /**
   * Click handler. When provided, the row gets `cursor="pointer"` and a
   * `_hover={{ bg: 'bg.subtle' }}` affordance — turns the primitive into
   * a clickable list-item (RecentRunsPanel etc.).
   */
  onClick?: () => void;
  'data-testid'?: string;
}

/**
 * Single-record row / card primitive. Replaces the
 * `<Box borderWidth="1px" borderColor="border" borderRadius="md" p={2|3}>`
 * shape repeated across object-management surfaces (Wallets, Profiles,
 * Custom Symbols, Snapshots, Sessions, Indicators, etc.) and stat-card
 * dashboards (MarketIndicators).
 *
 * Consumers compose the inside (`<Flex justify="space-between">`,
 * `<Stack>`, etc.) — this primitive only guarantees the framing.
 */
export const RecordRow = ({
  children,
  density = 'compact',
  tone = 'default',
  onClick,
  'data-testid': dataTestId,
}: RecordRowProps) => {
  const bg = tone === 'muted' ? 'bg.muted' : tone === 'panel' ? 'bg.panel' : undefined;
  const interactive = onClick != null;
  const padding = density === 'card' ? { p: 3 } : { px: 2.5, py: 2 };
  return (
    <Box
      {...padding}
      borderWidth="1px"
      borderColor="border"
      borderRadius="md"
      bg={bg}
      cursor={interactive ? 'pointer' : undefined}
      _hover={interactive ? { bg: 'bg.subtle' } : undefined}
      onClick={onClick}
      data-testid={dataTestId}
    >
      {children}
    </Box>
  );
};
