import type { Kline } from '@marketmind/types';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ColorModeProvider } from '@renderer/components/ui';
import { MiniChart } from './MiniChart';

const mockKlines: Kline[] = Array.from({ length: 100 }, (_, i) => ({
    openTime: Date.now() + i * 60000,
    open: 100 + Math.random() * 10,
    high: 105 + Math.random() * 10,
    low: 95 + Math.random() * 10,
    close: 100 + Math.random() * 10,
    volume: 1000 + Math.random() * 500,
    closeTime: Date.now() + (i + 1) * 60000,
    quoteAssetVolume: 100000,
    numberOfTrades: 100,
    takerBuyBaseAssetVolume: 500,
    takerBuyQuoteAssetVolume: 50000,
}));

const renderWithProvider = (component: React.ReactElement) => {
    return render(
        <ColorModeProvider>
            {component}
        </ColorModeProvider>
    );
};

describe('MiniChart', () => {
    it('should render without crashing', () => {
        renderWithProvider(<MiniChart klines={mockKlines} />);
    });

    it('should render with custom dimensions', () => {
        const { container } = renderWithProvider(
            <MiniChart klines={mockKlines} width={800} height={600} />
        );

        const chartContainer = container.querySelector('div > div');
        expect(chartContainer).toBeTruthy();
    });

    it('should render with trades', () => {
        const trades = [
            {
                entryIndex: 10,
                entryPrice: 100,
                exitIndex: 20,
                exitPrice: 110,
                direction: 'LONG' as const,
                stopLoss: 95,
                takeProfit: 115,
            },
        ];

        renderWithProvider(<MiniChart klines={mockKlines} trades={trades} />);
    });

    it('should handle empty klines array', () => {
        renderWithProvider(<MiniChart klines={[]} />);
    });

    it('should render with moving averages', () => {
        const movingAverages = [
            { period: 20, color: '#3b82f6', type: 'SMA' as const },
            { period: 50, color: '#ef4444', type: 'SMA' as const },
        ];

        renderWithProvider(
            <MiniChart
                klines={mockKlines}
                movingAverages={movingAverages}
                showIndicators={true}
            />
        );
    });

    it('should render interactive chart with crosshair', () => {
        renderWithProvider(<MiniChart klines={mockKlines} interactive={true} />);
    });

    it('should render non-interactive chart', () => {
        const { container } = renderWithProvider(
            <MiniChart klines={mockKlines} interactive={false} />
        );

        const chartDiv = container.querySelector('div');
        expect(chartDiv?.style.cursor).toBe('default');
    });

    it('should hide grid when showGrid is false', () => {
        renderWithProvider(<MiniChart klines={mockKlines} showGrid={false} />);
    });
});
