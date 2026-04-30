import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { usePortfolioDataMock, useGlobalActionsOptionalMock } = vi.hoisted(() => ({
  usePortfolioDataMock: vi.fn(),
  useGlobalActionsOptionalMock: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('./usePortfolioData', () => ({
  usePortfolioData: usePortfolioDataMock,
}));

vi.mock('@renderer/context/GlobalActionsContext', () => ({
  useGlobalActionsOptional: useGlobalActionsOptionalMock,
}));

// Heavy children — neutralize them so we don't pull in their hooks/data.
vi.mock('./FuturesPositionsPanel', () => ({
  FuturesPositionsPanel: () => null,
}));

vi.mock('./OrphanOrders', () => ({
  OrphanOrderCard: () => null,
  OrphanOrdersTable: () => null,
}));

vi.mock('./PortfolioSummary', () => ({
  PortfolioSummary: () => null,
}));

vi.mock('./PortfolioTable', () => ({
  PortfolioTable: () => null,
}));

vi.mock('./PositionCard', () => ({
  PositionCard: () => null,
}));

vi.mock('@renderer/components/BrlValue', () => ({
  BrlValue: () => null,
}));

vi.mock('@renderer/utils/canvas/perfMonitor', () => ({
  perfMonitor: { isEnabled: () => false, recordComponentRender: () => {} },
}));

import { Portfolio } from './Portfolio';

const baseStats = {
  totalPnL: 0,
  totalPnLPercent: 0,
  profitableCount: 0,
  losingCount: 0,
};

const baseData = {
  isIB: false,
  activeWallet: undefined,
  activeWalletId: undefined,
  positions: [],
  filteredPositions: [],
  stats: baseStats,
  todayPnl: undefined,
  summaryExpanded: true,
  toggleSummary: vi.fn(),
  filterOption: 'all' as const,
  setFilterOption: vi.fn(),
  sortBy: 'pnl' as const,
  setSortBy: vi.fn(),
  viewMode: 'cards' as const,
  setViewMode: vi.fn(),
  effectiveCapital: 0,
  stopProtectedPnl: 0,
  tpProjectedProfit: 0,
  totalExposure: 0,
  totalMargin: 0,
  hasLeverage: false,
  orphanOrders: [],
  cancelFuturesOrder: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
};

describe('Portfolio', () => {
  it('renders the no-wallet warning when activeWallet is undefined', () => {
    usePortfolioDataMock.mockReturnValue({ ...baseData, activeWallet: undefined });
    useGlobalActionsOptionalMock.mockReturnValue(undefined);

    render(
      <ChakraProvider value={defaultSystem}>
        <Portfolio />
      </ChakraProvider>,
    );
    // Callout shows the no-wallet copy. The trading.portfolio.empty key only
    // renders when there IS a wallet but no positions/orphans.
    expect(screen.getByText('trading.portfolio.noWallet')).toBeDefined();
  });

  it('renders the empty-state when wallet exists but positions + orphan orders are both empty', () => {
    usePortfolioDataMock.mockReturnValue({
      ...baseData,
      activeWallet: {
        id: 'w1',
        walletBalance: '10000',
        currency: 'USDT' as const,
      },
      activeWalletId: 'w1',
    });
    useGlobalActionsOptionalMock.mockReturnValue(undefined);

    render(
      <ChakraProvider value={defaultSystem}>
        <Portfolio />
      </ChakraProvider>,
    );
    expect(screen.getByText('trading.portfolio.empty')).toBeDefined();
  });

  it('does not render the empty-state when there is at least one orphan order', () => {
    usePortfolioDataMock.mockReturnValue({
      ...baseData,
      activeWallet: {
        id: 'w1',
        walletBalance: '10000',
        currency: 'USDT' as const,
      },
      activeWalletId: 'w1',
      orphanOrders: [{
        id: 'orphan-1',
        symbol: 'BTCUSDT',
        side: 'BUY' as const,
        type: 'STOP_MARKET' as const,
        price: '50000',
        quantity: '0.1',
        exchangeOrderId: 'x1',
      }],
    });
    useGlobalActionsOptionalMock.mockReturnValue(undefined);

    render(
      <ChakraProvider value={defaultSystem}>
        <Portfolio />
      </ChakraProvider>,
    );
    expect(screen.queryByText('trading.portfolio.empty')).toBeNull();
  });
});
