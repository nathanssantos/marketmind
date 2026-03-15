import { trpc } from '../utils/trpc';

export const useBackendScalping = (walletId: string | null) => {
  const utils = trpc.useUtils();

  const config = trpc.scalping.getConfig.useQuery(
    { walletId: walletId! },
    { enabled: !!walletId },
  );

  const status = trpc.scalping.getStatus.useQuery(
    { walletId: walletId! },
    { enabled: !!walletId, refetchInterval: 2000 },
  );

  const upsertConfig = trpc.scalping.upsertConfig.useMutation({
    onSuccess: () => {
      if (walletId) void utils.scalping.getConfig.invalidate({ walletId });
    },
  });

  const start = trpc.scalping.start.useMutation({
    onSuccess: () => {
      if (walletId) void utils.scalping.getStatus.invalidate({ walletId });
    },
  });

  const stop = trpc.scalping.stop.useMutation({
    onSuccess: () => {
      if (walletId) void utils.scalping.getStatus.invalidate({ walletId });
    },
  });

  const resetCircuitBreaker = trpc.scalping.resetCircuitBreaker.useMutation({
    onSuccess: () => {
      if (walletId) void utils.scalping.getStatus.invalidate({ walletId });
    },
  });

  return {
    config,
    status,
    upsertConfig,
    start,
    stop,
    resetCircuitBreaker,
  };
};
