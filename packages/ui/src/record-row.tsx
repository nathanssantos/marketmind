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
   * Background tone. `surface` (`bg.surface`, the **default**) is the
   * shared elevated card surface used by stat / chart cards across
   * Analytics, MarketIndicators, BestWorstTrade etc. — slightly
   * lighter than the parent panel, with `border.muted`. `muted`
   * (`bg.muted`) is the legacy lighter surface (kept for callers
   * that still want the higher-contrast tone). `panel` (`bg.panel`)
   * matches the parent panel — used for chart-overlay legends so the
   * legend blends with the panel beneath. `transparent` opts out of
   * the bg entirely (rows nested inside another tinted card).
   */
  tone?: 'surface' | 'muted' | 'panel' | 'transparent';
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
  tone = 'surface',
  onClick,
  'data-testid': dataTestId,
}: RecordRowProps) => {
  const bg = tone === 'muted'
    ? 'bg.muted'
    : tone === 'panel'
      ? 'bg.panel'
      : tone === 'transparent'
        ? undefined
        : 'bg.surface';
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
