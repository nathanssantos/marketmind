import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TradingSimulatorTab } from './TradingSimulatorTab';

const mockClearAllData = vi.fn();
const mockUseTradingStore = vi.fn();

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('@/renderer/store/tradingStore', () => ({
    useTradingStore: () => mockUseTradingStore(),
}));

const renderWithChakra = (component: React.ReactElement) => {
    return render(
        <ChakraProvider value={defaultSystem}>
            {component}
        </ChakraProvider>
    );
};

describe('TradingSimulatorTab', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.confirm = vi.fn(() => true);

        mockUseTradingStore.mockReturnValue({
            wallets: [{ id: '1', name: 'Wallet 1', balance: 10000 }],
            orders: [
                { id: '1', status: 'FILLED', symbol: 'BTCUSDT' },
                { id: '2', status: 'NEW', symbol: 'ETHUSDT' },
                { id: '3', status: 'FILLED', symbol: 'BNBUSDT', closedAt: new Date() },
            ],
            clearAllData: mockClearAllData,
        });
    });

    it('renders title and description', () => {
        renderWithChakra(<TradingSimulatorTab />);

        expect(screen.getByText('settings.tradingSimulator.title')).toBeDefined();
        expect(screen.getByText('settings.tradingSimulator.description')).toBeDefined();
    });

    it('displays statistics section', () => {
        renderWithChakra(<TradingSimulatorTab />);

        expect(screen.getByText('settings.tradingSimulator.statistics.title')).toBeDefined();
    });

    it('displays correct wallet count', () => {
        renderWithChakra(<TradingSimulatorTab />);

        const walletsRow = screen.getByText('settings.tradingSimulator.statistics.wallets').closest('div');
        expect(walletsRow?.textContent).toContain('1');
    });

    it('displays correct total orders count', () => {
        renderWithChakra(<TradingSimulatorTab />);

        const ordersRow = screen.getByText('settings.tradingSimulator.statistics.orders').closest('div');
        expect(ordersRow?.textContent).toContain('3');
    });

    it('displays correct active orders count', () => {
        renderWithChakra(<TradingSimulatorTab />);

        const activeRow = screen.getByText('settings.tradingSimulator.statistics.activeOrders').closest('div');
        expect(activeRow?.textContent).toContain('1');
    });

    it('displays correct pending orders count', () => {
        renderWithChakra(<TradingSimulatorTab />);

        expect(screen.getByText('settings.tradingSimulator.statistics.pendingOrders')).toBeDefined();
        const allTexts = screen.getAllByText(/[0-9]+/);
        expect(allTexts.length).toBeGreaterThan(0);
    });

    it('renders danger zone section', () => {
        renderWithChakra(<TradingSimulatorTab />);

        expect(screen.getByText('settings.tradingSimulator.dangerZone.title')).toBeDefined();
        expect(screen.getByText('settings.tradingSimulator.dangerZone.description')).toBeDefined();
    });

    it('renders clear all button', () => {
        renderWithChakra(<TradingSimulatorTab />);

        expect(screen.getByText('settings.tradingSimulator.dangerZone.clearAll')).toBeDefined();
    });

    it('clears all data when confirmed', () => {
        renderWithChakra(<TradingSimulatorTab />);

        const clearButton = screen.getByText('settings.tradingSimulator.dangerZone.clearAll');
        fireEvent.click(clearButton);

        expect(global.confirm).toHaveBeenCalledWith('settings.tradingSimulator.confirmClearAll');
        expect(mockClearAllData).toHaveBeenCalled();
    });

    it('does not clear data when confirmation cancelled', () => {
        global.confirm = vi.fn(() => false);

        renderWithChakra(<TradingSimulatorTab />);

        const clearButton = screen.getByText('settings.tradingSimulator.dangerZone.clearAll');
        fireEvent.click(clearButton);

        expect(global.confirm).toHaveBeenCalled();
        expect(mockClearAllData).not.toHaveBeenCalled();
    });

    it('disables clear button when no wallets and no orders', () => {
        mockUseTradingStore.mockReturnValue({
            wallets: [],
            orders: [],
            clearAllData: mockClearAllData,
        });

        renderWithChakra(<TradingSimulatorTab />);

        const clearButton = screen.getByText('settings.tradingSimulator.dangerZone.clearAll').closest('button');
        expect(clearButton?.disabled).toBe(true);
    });

    it('enables clear button when wallets exist', () => {
        mockUseTradingStore.mockReturnValue({
            wallets: [{ id: '1', name: 'Wallet 1', balance: 10000 }],
            orders: [],
            clearAllData: mockClearAllData,
        });

        renderWithChakra(<TradingSimulatorTab />);

        const clearButton = screen.getByText('settings.tradingSimulator.dangerZone.clearAll').closest('button');
        expect(clearButton?.disabled).toBe(false);
    });

    it('enables clear button when orders exist', () => {
        mockUseTradingStore.mockReturnValue({
            wallets: [],
            orders: [{ id: '1', status: 'FILLED', symbol: 'BTCUSDT' }],
            clearAllData: mockClearAllData,
        });

        renderWithChakra(<TradingSimulatorTab />);

        const clearButton = screen.getByText('settings.tradingSimulator.dangerZone.clearAll').closest('button');
        expect(clearButton?.disabled).toBe(false);
    });

    it('displays zero counts when no data', () => {
        mockUseTradingStore.mockReturnValue({
            wallets: [],
            orders: [],
            clearAllData: mockClearAllData,
        });

        renderWithChakra(<TradingSimulatorTab />);

        const zeroTexts = screen.getAllByText('0');
        expect(zeroTexts.length).toBeGreaterThan(0);
    });

    it('filters active orders correctly', () => {
        mockUseTradingStore.mockReturnValue({
            wallets: [],
            orders: [
                { id: '1', status: 'FILLED', symbol: 'BTCUSDT' },
                { id: '2', status: 'FILLED', symbol: 'ETHUSDT' },
                { id: '3', status: 'FILLED', closedAt: new Date(), symbol: 'BNBUSDT' },
            ],
            clearAllData: mockClearAllData,
        });

        renderWithChakra(<TradingSimulatorTab />);

        expect(screen.getByText('2')).toBeDefined();
    });

    it('filters pending orders correctly', () => {
        mockUseTradingStore.mockReturnValue({
            wallets: [],
            orders: [
                { id: '1', status: 'NEW', symbol: 'BTCUSDT' },
                { id: '2', status: 'NEW', symbol: 'ETHUSDT' },
                { id: '3', status: 'NEW', symbol: 'BNBUSDT' },
            ],
            clearAllData: mockClearAllData,
        });

        renderWithChakra(<TradingSimulatorTab />);

        expect(screen.getByText('settings.tradingSimulator.statistics.pendingOrders')).toBeDefined();
    });
});
