import { Box } from '@chakra-ui/react';
import { WatchersTab } from '@renderer/components/MarketSidebar/tabs/WatchersTab';

/**
 * v1.10 Track 4.5 — registered as the `watchers` panel kind. Wraps the
 * existing `<WatchersTab>` (suggestion cards + watchers table) for
 * standalone placement on the grid.
 */
export const WatchersPanel = () => (
  <Box h="100%" overflowY="auto">
    <WatchersTab />
  </Box>
);

export default WatchersPanel;
