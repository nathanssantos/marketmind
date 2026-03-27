import { router } from '../../trpc';
import { statsProcedures } from './stats';
import { tradeProcedures } from './trades';

export const analyticsRouter = router({
  ...tradeProcedures,
  ...statsProcedures,
});
