import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import type { Kline } from '../../shared/types';

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

export const createMockKline = (overrides?: Partial<Kline>): Kline => ({
    openTime: 1700000000000,
    open: '50000',
    high: '52000',
    low: '48000',
    close: '51000',
    volume: '1000000',
    closeTime: 1700000000000 + 60000,
    quoteVolume: '50000000000',
    trades: 1000,
    takerBuyBaseVolume: '500000',
    takerBuyQuoteVolume: '25000000000',
    ...overrides,
});

export const createMockKlines = (
    count: number,
    options?: {
        startOpenTime?: number;
        interval?: number;
        trend?: 'up' | 'down' | 'sideways';
    }
): Kline[] => {
    const {
        startOpenTime = 1700000000000,
        interval = 3600000,
        trend = 'sideways',
    } = options || {};

    const klines: Kline[] = [];
    let basePrice = 50000;

    for (let i = 0; i < count; i++) {
        const openTime = startOpenTime + i * interval;
        const closeTime = openTime + interval;

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

        klines.push({
            openTime,
            open: open.toString(),
            high: high.toString(),
            low: low.toString(),
            close: close.toString(),
            volume: volume.toString(),
            closeTime,
            quoteVolume: (volume * close).toString(),
            trades: Math.floor(Math.random() * 1000),
            takerBuyBaseVolume: (volume * 0.5).toString(),
            takerBuyQuoteVolume: (volume * close * 0.5).toString(),
        });
    }

    return klines;
};

export const createBullishKline = (
    openTime = 1700000000000
): Kline => ({
    openTime,
    open: '50000',
    high: '52000',
    low: '49500',
    close: '51500',
    volume: '1000000',
    closeTime: openTime + 60000,
    quoteVolume: '51500000000',
    trades: 1000,
    takerBuyBaseVolume: '500000',
    takerBuyQuoteVolume: '25750000000',
});

export const createBearishKline = (
    openTime = 1700000000000
): Kline => ({
    openTime,
    open: '51000',
    high: '51500',
    low: '48000',
    close: '48500',
    volume: '1200000',
    closeTime: openTime + 60000,
    quoteVolume: '58200000000',
    trades: 1200,
    takerBuyBaseVolume: '600000',
    takerBuyQuoteVolume: '29100000000',
});

export const createDojiKline = (openTime = 1700000000000): Kline => ({
    openTime,
    open: '50000',
    high: '51000',
    low: '49000',
    close: '50000',
    volume: '800000',
    closeTime: openTime + 60000,
    quoteVolume: '40000000000',
    trades: 800,
    takerBuyBaseVolume: '400000',
    takerBuyQuoteVolume: '20000000000',
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
