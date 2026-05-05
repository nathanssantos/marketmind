import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import { Skeleton } from '@renderer/components/ui';
import type { ReactNode } from 'react';

interface MarketIndicatorPanelShellProps {
  title: string;
  badges?: ReactNode;
  isLoading: boolean;
  hasData: boolean;
  emptyMessage?: string;
  children: ReactNode;
}

/**
 * Shared layout shell for the individual market-indicator panels split
 * out of the aggregate MarketIndicators dashboard. Each instance fills
 * the GridPanel's full height: header at the top (fixed) + chart area
 * below filling all remaining space (`flex={1} minH={0}` so recharts'
 * ResponsiveContainer can size against a real bound).
 *
 * The aggregate dashboard's `<RecordRow density="card" tone="muted">`
 * stack and the fixed `h="60-80px"` chart heights are gone — the user
 * resizes the panel itself to control chart height.
 */
export const MarketIndicatorPanelShell = ({
  title,
  badges,
  isLoading,
  hasData,
  emptyMessage = '–',
  children,
}: MarketIndicatorPanelShellProps) => (
  // No tinted bg / borderRadius — the GridPanel container already
  // provides the dark surface and rounded edges. Adding our own
  // `bg.muted` produced the lighter card-on-card look the user
  // flagged; matching ChecklistPanel's transparent body keeps the
  // visual consistent with the rest of the bare-shell panels.
  <Stack h="100%" gap={2} p={1.5} overflow="hidden">
    <Flex align="center" justify="space-between" gap={2} flexShrink={0} flexWrap="wrap">
      <Text fontSize="sm" fontWeight="medium">{title}</Text>
      {badges}
    </Flex>
    <Box flex={1} minH={0}>
      {isLoading ? (
        <Skeleton height="100%" />
      ) : hasData ? (
        children
      ) : (
        <Text fontSize="xs" color="fg.muted">{emptyMessage}</Text>
      )}
    </Box>
  </Stack>
);
