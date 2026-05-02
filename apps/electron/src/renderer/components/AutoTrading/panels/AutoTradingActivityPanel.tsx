import { Box } from '@chakra-ui/react';
import { LogsTab } from '@renderer/components/MarketSidebar/tabs/LogsTab';

/**
 * v1.10 Track 4.5 — registered as the `autoTradingActivity` panel kind.
 * Wraps the existing `<LogsTab>` (auto-trading activity / logs) for
 * standalone placement on the grid.
 */
export const AutoTradingActivityPanel = () => (
  <Box h="100%" display="flex" flexDirection="column" minH={0}>
    <LogsTab />
  </Box>
);

export default AutoTradingActivityPanel;
