import { Box } from '@chakra-ui/react';
import { OrdersList } from '../OrdersList';

export const OrdersPanel = () => (
  <Box h="100%" overflowY="auto" p={1.5}>
    <OrdersList />
  </Box>
);

export default OrdersPanel;
