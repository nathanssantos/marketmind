import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState, useEffect } from 'react';
import { BACKEND_TRPC_URL } from '@shared/constants/api';
import { trpc } from '../utils/trpc';
import { QUERY_CONFIGS } from '../services/queryConfig';

const clearStaleCache = (client: QueryClient) => {
    client.invalidateQueries({ queryKey: ['kline'] });
    client.removeQueries({ queryKey: ['kline'], predicate: () => true });
};

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
                staleTime: QUERY_CONFIGS.default.staleTime,
                gcTime: QUERY_CONFIGS.default.gcTime,
                retry: (failureCount, error) => {
                    if (error instanceof Error) {
                        if (error.message.includes('UNAUTHORIZED')) return false;
                        if (error.message.includes('NOT_FOUND')) return false;
                        if (error.message.includes('TOO_MANY_REQUESTS')) return false;
                    }
                    const errStr = String(error);
                    if (errStr.includes('TOO_MANY_REQUESTS')) return false;
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

    useEffect(() => {
        const version = (import.meta.env['VITE_APP_VERSION'] as string | undefined) ?? 'dev';
        if (sessionStorage.getItem('mm-cache-version') !== version) {
            clearStaleCache(queryClient);
            sessionStorage.setItem('mm-cache-version', version);
        }
    }, [queryClient]);

    return (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </trpc.Provider>
    );
};
