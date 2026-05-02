import { Box } from '@chakra-ui/react';
import { FuturesPositionsPanel } from '../FuturesPositionsPanel';

/**
 * v1.10 Track 4.2 — registered as the `positions` panel kind. Wraps the
 * existing `<FuturesPositionsPanel>` so users can pop just the futures
 * positions list onto the grid without the rest of the Portfolio body.
 */
export const PositionsPanel = () => (
  <Box h="100%" overflowY="auto" p={3}>
    <FuturesPositionsPanel />
  </Box>
);

export default PositionsPanel;
