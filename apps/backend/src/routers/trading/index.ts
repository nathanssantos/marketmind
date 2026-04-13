import { router } from '../../trpc';
import { orderMutationsRouter } from './order-mutations';
import { orderQueriesRouter } from './order-queries';
import { positionsRouter } from './positions';
import { executionsRouter } from './executions';
import { executionUpdatesRouter } from './execution-updates';
import { futuresConfigRouter } from './futures';
import { marketDataRouter } from './market-data';

export const tradingRouter = router({
  ...orderMutationsRouter._def.procedures,
  ...orderQueriesRouter._def.procedures,
  ...positionsRouter._def.procedures,
  ...executionsRouter._def.procedures,
  ...executionUpdatesRouter._def.procedures,
  ...futuresConfigRouter._def.procedures,
  ...marketDataRouter._def.procedures,
});
