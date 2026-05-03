import { Box } from '@chakra-ui/react';
import type { ReactNode } from 'react';

export interface TradingSideCardProps {
  children: ReactNode;
  /**
   * `'LONG'` renders a 4px green left accent (`trading.long`); `'SHORT'`
   * renders red (`trading.short`). Tokens come from @marketmind/tokens
   * so this primitive has no theme assumptions of its own.
   */
  side: 'LONG' | 'SHORT';
}

export const TradingSideCard = ({ children, side }: TradingSideCardProps) => {
  return (
    <Box
      p={3}
      bg="bg.surface"
      borderRadius="md"
      borderLeft="4px solid"
      borderColor={side === 'LONG' ? 'trading.long' : 'trading.short'}
    >
      {children}
    </Box>
  );
};
