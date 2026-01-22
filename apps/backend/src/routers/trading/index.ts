import { router } from '../../trpc';
import { ordersRouter } from './orders';
import { positionsRouter } from './positions';
import { executionsRouter } from './executions';
import { futuresRouter } from './futures';

export const nestedTradingRouter = router({
  orders: ordersRouter,
  positions: positionsRouter,
  executions: executionsRouter,
  futures: futuresRouter,
});

export { ordersRouter } from './orders';
export { positionsRouter } from './positions';
export { executionsRouter } from './executions';
export { futuresRouter } from './futures';
