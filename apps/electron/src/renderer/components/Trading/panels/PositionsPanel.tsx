import { Box } from '@chakra-ui/react';
import { PortfolioPositionsList } from '../PortfolioPositionsList';

export const PositionsPanel = () => (
  <Box h="100%" overflowY="auto" p={1.5}>
    <PortfolioPositionsList />
  </Box>
);

export default PositionsPanel;
