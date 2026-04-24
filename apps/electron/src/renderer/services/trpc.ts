import type { AppRouter } from '@marketmind/backend';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { BACKEND_TRPC_URL } from '@shared/constants/api';

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: BACKEND_TRPC_URL,
      fetch: (url: RequestInfo | URL, options?: RequestInit) => {
        return fetch(url, {
          ...options,
          credentials: 'include',
        });
      },
    }),
  ],
});

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
