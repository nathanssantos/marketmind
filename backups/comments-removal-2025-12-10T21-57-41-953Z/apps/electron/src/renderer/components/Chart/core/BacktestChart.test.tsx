import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import type { Kline, Trade } from '@marketmind/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChartProvider } from '../../../context/ChartContext';
import { ColorModeProvider } from '../../ui/color-mode';
import { PinnedControlsProvider } from '../PinnedControlsContext';
import { BacktestChart } from './BacktestChart';

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

const mockTrades: Trade[] = [
    {
        id: '1',
        symbol: 'BTCUSDT',
        direction: 'LONG',
        entryPrice: 40000,
        exitPrice: 40500,
        quantity: 1,
        entryTime: mockKlines[10].openTime,
        exitTime: mockKlines[20].closeTime,
        profit: 500,
        status: 'CLOSED',
    },
];

describe('BacktestChart', () => {
    it('should render without crashing', () => {
        renderWithProvider(<BacktestChart klines={mockKlines} trades={mockTrades} />);
    });

    it('should display playback controls', () => {
        renderWithProvider(<BacktestChart klines={mockKlines} trades={mockTrades} />);
        expect(screen.getByLabelText('Play')).toBeDefined();
        expect(screen.getByLabelText('Step forward')).toBeDefined();
        expect(screen.getByLabelText('Step backward')).toBeDefined();
    });

    it('should show kline progress', () => {
        renderWithProvider(<BacktestChart klines={mockKlines} trades={mockTrades} />);
        expect(screen.getByText(/Kline \d+ \/ 100/)).toBeDefined();
    });

    it('should show trade count', () => {
        renderWithProvider(<BacktestChart klines={mockKlines} trades={mockTrades} />);
        expect(screen.getByText(/Trades: \d+/)).toBeDefined();
    });

    it('should display equity curve when enabled', () => {
        renderWithProvider(
            <BacktestChart
                klines={mockKlines}
                trades={mockTrades}
                showEquityCurve={true}
            />
        );
        expect(screen.getByText(/Equity:/)).toBeDefined();
    });

    it('should hide equity curve when disabled', () => {
        renderWithProvider(
            <BacktestChart
                klines={mockKlines}
                trades={mockTrades}
                showEquityCurve={false}
            />
        );
        expect(screen.queryByText(/Equity:/)).toBeNull();
    });

    it('should call onProgress callback', () => {
        const onProgress = vi.fn();
        renderWithProvider(
            <BacktestChart
                klines={mockKlines}
                trades={mockTrades}
                onProgress={onProgress}
            />
        );
    });

    it('should display speed controls', () => {
        renderWithProvider(<BacktestChart klines={mockKlines} trades={mockTrades} />);
        expect(screen.getByText('0.5x')).toBeDefined();
        expect(screen.getByText('1x')).toBeDefined();
        expect(screen.getByText('2x')).toBeDefined();
        expect(screen.getByText('5x')).toBeDefined();
        expect(screen.getByText('10x')).toBeDefined();
    });
});
