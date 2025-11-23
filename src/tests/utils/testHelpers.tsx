import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import type { Candle } from '../../shared/types';

interface AllTheProvidersProps {
    children: ReactNode;
}

export const AllTheProviders = ({ children }: AllTheProvidersProps) => (
    <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
);

export const renderWithChakra = (
    ui: ReactElement,
    options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export const createMockCandle = (overrides?: Partial<Candle>): Candle => ({
    timestamp: 1700000000000,
    open: 50000,
    high: 52000,
    low: 48000,
    close: 51000,
    volume: 1000000,
    ...overrides,
});

export const createMockCandles = (
    count: number,
    options?: {
        startTimestamp?: number;
        interval?: number;
        trend?: 'up' | 'down' | 'sideways';
    }
): Candle[] => {
    const {
        startTimestamp = 1700000000000,
        interval = 3600000,
        trend = 'sideways',
    } = options || {};

    const candles: Candle[] = [];
    let basePrice = 50000;

    for (let i = 0; i < count; i++) {
        const timestamp = startTimestamp + i * interval;

        if (trend === 'up') {
            basePrice += Math.random() * 500;
        } else if (trend === 'down') {
            basePrice -= Math.random() * 500;
        } else {
            basePrice += (Math.random() - 0.5) * 500;
        }

        const open = basePrice;
        const close = open + (Math.random() - 0.5) * 2000;
        const high = Math.max(open, close) + Math.random() * 1000;
        const low = Math.min(open, close) - Math.random() * 1000;
        const volume = Math.random() * 2000000;

        candles.push({
            timestamp,
            open,
            high,
            low,
            close,
            volume,
        });
    }

    return candles;
};

export const createBullishCandle = (
    timestamp = 1700000000000
): Candle => ({
    timestamp,
    open: 50000,
    high: 52000,
    low: 49500,
    close: 51500,
    volume: 1000000,
});

export const createBearishCandle = (
    timestamp = 1700000000000
): Candle => ({
    timestamp,
    open: 51000,
    high: 51500,
    low: 48000,
    close: 48500,
    volume: 1200000,
});

export const createDojiCandle = (timestamp = 1700000000000): Candle => ({
    timestamp,
    open: 50000,
    high: 51000,
    low: 49000,
    close: 50000,
    volume: 800000,
});

export const mockLocalStorage = () => {
    const store: Record<string, string> = {};

    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
            store[key] = value;
        },
        removeItem: (key: string) => {
            delete store[key];
        },
        clear: () => {
            Object.keys(store).forEach((key) => delete store[key]);
        },
        get length() {
            return Object.keys(store).length;
        },
        key: (index: number) => Object.keys(store)[index] || null,
    };
};

export const waitForAsync = () =>
    new Promise((resolve) => setTimeout(resolve, 0));

export const flushPromises = async () => {
    await new Promise((resolve) => setImmediate(resolve));
};

export * from '@testing-library/react';
