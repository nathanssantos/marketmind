import { Box } from '@chakra-ui/react';
import { MarketIndicatorsTab } from '../tabs/MarketIndicatorsTab';

/**
 * v1.10 Track 4.4 — registered as the `marketIndicators` panel kind.
 * Wraps the existing `<MarketIndicatorsTab>` (FearGreed / BTC.D / MVRV /
 * ETF / Funding / Open Interest / Altcoin Season / ADX / Order Book /
 * Funding Rates) so the user can pop the entire market dashboard onto
 * the grid.
 */
export const MarketIndicatorsPanel = () => (
  <Box h="100%" overflowY="auto" p={1.5}>
    <MarketIndicatorsTab />
  </Box>
);

export default MarketIndicatorsPanel;
