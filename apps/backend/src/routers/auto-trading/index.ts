import { router } from '../../trpc';
import { configRouter } from './config';
import { diagnosticsRouter } from './diagnostics';
import { executionsRouter } from './executions';
import { marketIntelligenceRouter } from './market-intelligence';
import { recoveryRouter } from './recovery';
import { rotationRouter } from './rotation';
import { symbolSelectionRouter } from './symbol-selection';
import { watchersRouter } from './watchers';

export const autoTradingRouter = router({
  ...configRouter._def.procedures,
  ...executionsRouter._def.procedures,
  ...watchersRouter._def.procedures,
  ...symbolSelectionRouter._def.procedures,
  ...rotationRouter._def.procedures,
  ...marketIntelligenceRouter._def.procedures,
  ...recoveryRouter._def.procedures,
  ...diagnosticsRouter._def.procedures,
});
