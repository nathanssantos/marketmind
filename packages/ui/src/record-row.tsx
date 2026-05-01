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
}

/**
 * Single-record row / card primitive. Replaces the
 * `<Box borderWidth="1px" borderColor="border" borderRadius="md" p={2|3}>`
 * shape repeated across object-management surfaces (Wallets, Profiles,
 * Custom Symbols, Snapshots, Sessions, Indicators, etc.).
 *
 * Consumers compose the inside (`<Flex justify="space-between">`,
 * `<Stack>`, etc.) — this primitive only guarantees the framing.
 */
export const RecordRow = ({ children, density = 'compact' }: RecordRowProps) => {
  if (density === 'card') {
    return (
      <Box
        p={3}
        borderWidth="1px"
        borderColor="border"
        borderRadius="md"
      >
        {children}
      </Box>
    );
  }
  return (
    <Box
      px={2.5}
      py={2}
      borderWidth="1px"
      borderColor="border"
      borderRadius="md"
    >
      {children}
    </Box>
  );
};
