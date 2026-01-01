import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState } from 'react';
import { BACKEND_TRPC_URL } from '@shared/constants/api';
import { trpc } from '../utils/trpc';

export const TrpcProvider = ({ children }: { children: React.ReactNode }) => {
    const [queryClient] = useState(() => new QueryClient({
        queryCache: new QueryCache({
            onError: (error, query) => {
                console.error('[QueryCache] Query error:', {
                    queryKey: query.queryKey,
                    error: error instanceof Error ? error.message : String(error),
                });
            },
        }),
        defaultOptions: {
            queries: {
                staleTime: 30000,
                gcTime: 60000,
                retry: (failureCount, error) => {
                    if (error instanceof Error) {
                        if (error.message.includes('UNAUTHORIZED')) return false;
                        if (error.message.includes('NOT_FOUND')) return false;
                    }
                    return failureCount < 2;
                },
                retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
                refetchOnWindowFocus: false,
                refetchIntervalInBackground: false,
                throwOnError: false,
            },
            mutations: {
                retry: false,
                throwOnError: false,
            },
        },
    }));

    const [trpcClient] = useState(() =>
        trpc.createClient({
            links: [
                httpBatchLink({
                    url: BACKEND_TRPC_URL,
                    fetch(url, options) {
                        return fetch(url, {
                            ...options,
                            credentials: 'include',
                        });
                    },
                }),
            ],
        })
    );

    return (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </trpc.Provider>
    );
};
