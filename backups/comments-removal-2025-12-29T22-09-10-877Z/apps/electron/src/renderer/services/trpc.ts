import type { AppRouter } from '@marketmind/backend';
import { createTRPCClient, httpBatchLink } from '@trpc/client';

const BACKEND_URL = import.meta.env['VITE_BACKEND_URL'] || 'http://localhost:3001';

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${BACKEND_URL}/trpc`,
      fetch: (url: RequestInfo | URL, options?: RequestInit) => {
        return fetch(url, {
          ...options,
          credentials: 'include',
        });
      },
    }),
  ],
});
