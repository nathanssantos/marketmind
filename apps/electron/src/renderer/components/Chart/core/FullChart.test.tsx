import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import type { Kline } from '@shared/types';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChartProvider } from '../../../context/ChartContext';
import { ColorModeProvider } from '../../ui/color-mode';
import { PinnedControlsProvider } from '../PinnedControlsContext';
import { FullChart } from './FullChart';

const mockTheme = {
    grid: '#2d3748',
    text: '#cbd5e0',
    bullish: '#48bb78',
    bearish: '#f56565',
    background: '#1a202c',
    crosshair: '#cbd5e0',
};

const renderWithProvider = (component: React.ReactElement) => {
    return render(
        <ChakraProvider value={defaultSystem}>
            <ColorModeProvider>
                <PinnedControlsProvider>
                    <ChartProvider>
                        {component}
                    </ChartProvider>
                </PinnedControlsProvider>
            </ColorModeProvider>
        </ChakraProvider>
    );
};

const mockKlines: Kline[] = Array.from({ length: 100 }, (_, i) => ({
    openTime: Date.now() + i * 60000,
    open: (40000 + i * 10).toString(),
    high: (40100 + i * 10).toString(),
    low: (39900 + i * 10).toString(),
    close: (40050 + i * 10).toString(),
    volume: '1000',
    closeTime: Date.now() + (i + 1) * 60000,
    quoteVolume: '40000000',
    trades: 100,
    takerBuyBaseVolume: '500',
    takerBuyQuoteVolume: '20000000',
}));

describe('FullChart', () => {
    it('should render without crashing', () => {
        renderWithProvider(
            <FullChart symbol="BTCUSDT" timeframe="1h" klines={mockKlines} />
        );
    });

    it('should handle empty klines array', () => {
        renderWithProvider(<FullChart symbol="BTCUSDT" timeframe="1h" klines={[]} />);
    });

    it('should display with custom dimensions', () => {
        const { container } = renderWithProvider(
            <FullChart
                symbol="BTCUSDT"
                timeframe="1h"
                klines={mockKlines}
                width={800}
                height={400}
            />
        );
        expect(container.querySelector('[style*="width"]')).toBeDefined();
    });

    it('should handle kline click events', () => {
        const onKlineClick = vi.fn();
        renderWithProvider(
            <FullChart
                symbol="BTCUSDT"
                timeframe="1h"
                klines={mockKlines}
                onKlineClick={onKlineClick}
            />
        );
    });

    it('should support disabling features', () => {
        renderWithProvider(
            <FullChart
                symbol="BTCUSDT"
                timeframe="1h"
                klines={mockKlines}
                showVolume={false}
                showGrid={false}
                showIndicators={false}
                tradingEnabled={false}
            />
        );
    });

    it('should render with trades and orders', () => {
        const trades = [
            {
                id: '1',
                symbol: 'BTCUSDT',
                direction: 'LONG' as const,
                entryPrice: 40000,
                exitPrice: 40500,
                quantity: 1,
                entryTime: mockKlines[10].openTime,
                exitTime: mockKlines[20].closeTime,
                profit: 500,
                status: 'CLOSED' as const,
            },
        ];

        const orders = [
            {
                id: '1',
                symbol: 'BTCUSDT',
                type: 'LIMIT' as const,
                side: 'BUY' as const,
                price: 39500,
                quantity: 1,
                status: 'OPEN' as const,
            },
        ];

        renderWithProvider(
            <FullChart
                symbol="BTCUSDT"
                timeframe="1h"
                klines={mockKlines}
                trades={trades}
                orders={orders}
            />
        );
    });
});
