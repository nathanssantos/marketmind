import { Box } from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface TradingSideCardProps {
  children: ReactNode;
  /** 'LONG' renders the green left accent (`trading.long`); 'SHORT' renders red (`trading.short`). */
  side: 'LONG' | 'SHORT';
}

/**
 * Position / order card shell with a side-coded 4px colored left border.
 * Used by `PositionCard`, `OrderCard`, and the futures position card inside
 * `FuturesPositionsPanel` — all three rendered the same `<Box p={3}
 * bg="bg.muted" borderRadius="md" borderLeft="4px solid" borderColor={...}>`
 * shape with the only variable being LONG vs SHORT color tokens.
 *
 * Not absorbed into `<RecordRow>` because the 4px colored accent is a
 * trading-specific UX cue (long=green / short=red) and `<RecordRow>` is
 * theme-agnostic in `@marketmind/ui`.
 */
export const TradingSideCard = ({ children, side }: TradingSideCardProps) => {
  return (
    <Box
      p={3}
      bg="bg.muted"
      borderRadius="md"
      borderLeft="4px solid"
      borderColor={side === 'LONG' ? 'trading.long' : 'trading.short'}
    >
      {children}
    </Box>
  );
};
