import { router } from '../../trpc';
import { walletConnectionRouter } from './connection';
import { walletCrudRouter } from './crud';
import { walletSyncRouter } from './sync';

export const walletRouter = router({
  ...walletCrudRouter._def.procedures,
  ...walletSyncRouter._def.procedures,
  ...walletConnectionRouter._def.procedures,
});
