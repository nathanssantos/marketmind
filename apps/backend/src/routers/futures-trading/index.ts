import { router } from '../../trpc';
import { accountConfigRouter } from './account-config';
import { marketDataRouter } from './market-data';
import { orderMutationsRouter } from './order-mutations';
import { orderQueriesRouter } from './order-queries';
import { positionMutationsRouter } from './position-mutations';
import { positionQueriesRouter } from './position-queries';

export const futuresTradingRouter = router({
  ...accountConfigRouter._def.procedures,
  ...orderMutationsRouter._def.procedures,
  ...orderQueriesRouter._def.procedures,
  ...positionQueriesRouter._def.procedures,
  ...positionMutationsRouter._def.procedures,
  ...marketDataRouter._def.procedures,
});
