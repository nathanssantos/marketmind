import { Box } from '@chakra-ui/react';
import { OrdersList } from '../OrdersList';

/**
 * v1.10 Track 4.2 — registered as the `orders` panel kind. Body of the
 * `<GridPanel mode="bare">` shell; reads symbol + market context from the
 * layout store same as it does in the sidebar today.
 */
export const OrdersPanel = () => (
  <Box h="100%" overflowY="auto">
    <OrdersList />
  </Box>
);

export default OrdersPanel;
