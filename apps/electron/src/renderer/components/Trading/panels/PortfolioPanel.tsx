import { Box } from '@chakra-ui/react';
import { Portfolio } from '../Portfolio';

/**
 * v1.10 Track 4.2 — registered as the `portfolio` panel kind. Wraps the
 * existing `<Portfolio>` from the trading sidebar; the sidebar's
 * quickTradeHeader is dropped here since panels are headerless (the
 * Ticket lives in its own `ticket` panel).
 */
export const PortfolioPanel = () => (
  <Box h="100%" overflowY="auto">
    <Portfolio />
  </Box>
);

export default PortfolioPanel;
