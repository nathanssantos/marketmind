import { router } from '../../trpc';
import { maintenanceProcedures } from './maintenance';
import { queryProcedures } from './queries';
import { subscriptionProcedures } from './subscriptions';

export const klineRouter = router({
  ...subscriptionProcedures,
  ...queryProcedures,
  ...maintenanceProcedures,
});
