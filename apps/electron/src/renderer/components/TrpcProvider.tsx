import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState, useEffect, useRef } from 'react';
import { BACKEND_TRPC_URL } from '@shared/constants/api';
import { useApiBanStore } from '../store/apiBanStore';
import { trpc } from '../utils/trpc';
import { QUERY_CONFIGS } from '../services/queryConfig';

const DEFAULT_BAN_DURATION_MS = 5 * 60 * 1000;

const parseBanDuration = (message: string): number => {
    const match = message.match(/(\d+)\s*s/i);
    if (match?.[1]) return parseInt(match[1], 10) * 1000;
    return DEFAULT_BAN_DURATION_MS;
};

const clearStaleCache = (client: QueryClient) => {
    client.invalidateQueries({ queryKey: ['kline'] });
    client.removeQueries({ queryKey: ['kline'], predicate: () => true });
};

export const TrpcProvider = ({ children }: { children: React.ReactNode }) => {
    const [queryClient] = useState(() => new QueryClient({
        queryCache: new QueryCache({
            onError: (error, query) => {
                const msg = error instanceof Error ? error.message : String(error);
                if (msg.includes('TOO_MANY_REQUESTS') || msg.includes('IP banned') || msg.includes('418') || msg.includes('429')) {
                    const duration = parseBanDuration(msg);
                    useApiBanStore.getState().setBan(Date.now() + duration);
                }
                console.error('[QueryCache] Query error:', {
                    queryKey: query.queryKey,
                    error: msg,
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

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const banExpiresAt = useApiBanStore((s) => s.banExpiresAt);

    useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        const remaining = banExpiresAt - Date.now();
        if (remaining <= 0) return;
        timerRef.current = setTimeout(() => {
            useApiBanStore.getState().clearBan();
        }, remaining);
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [banExpiresAt]);

    return (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </trpc.Provider>
    );
};
