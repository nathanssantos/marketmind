import { router } from '../../trpc';
import { multiProcedures } from './multi';
import { simpleProcedures } from './simple';

export const backtestRouter = router({
  ...simpleProcedures,
  ...multiProcedures,
});
