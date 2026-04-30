import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const {
  useBackendTradingMock,
  useActiveWalletMock,
  useGlobalActionsOptionalMock,
  useToastMock,
  useUIStoreMock,
  trpcMock,
} = vi.hoisted(() => ({
  useBackendTradingMock: vi.fn(),
  useActiveWalletMock: vi.fn(),
  useGlobalActionsOptionalMock: vi.fn(),
  useToastMock: vi.fn(),
  useUIStoreMock: vi.fn(),
  trpcMock: { trading: { getOrdersStats: { useQuery: vi.fn() } } },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@renderer/hooks/useBackendTrading', () => ({
  useBackendTrading: useBackendTradingMock,
}));

vi.mock('@renderer/hooks/useActiveWallet', () => ({
  useActiveWallet: useActiveWalletMock,
}));

vi.mock('@renderer/context/GlobalActionsContext', () => ({
  useGlobalActionsOptional: useGlobalActionsOptionalMock,
}));

vi.mock('@renderer/hooks/useToast', () => ({
  useToast: useToastMock,
}));

vi.mock('@renderer/store/uiStore', () => ({
  useUIStore: useUIStoreMock,
}));

vi.mock('@renderer/utils/trpc', () => ({
  trpc: trpcMock,
}));

vi.mock('@renderer/utils/canvas/perfMonitor', () => ({
  perfMonitor: { isEnabled: () => false, recordComponentRender: () => {} },
}));

// Heavy children — neutralize so we don't pull in their hooks.
vi.mock('./OrderCard', () => ({
  OrderCard: () => null,
}));

vi.mock('./OrdersTableContent', () => ({
  OrdersTableContent: () => null,
}));

import { OrdersList } from './OrdersList';

const baseUIState = {
  filterStatus: 'all',
  setFilterStatus: vi.fn(),
  sortBy: 'createdAt',
  setSortBy: vi.fn(),
  viewMode: 'cards',
  setViewMode: vi.fn(),
  setOrdersDialogOpen: vi.fn(),
};

const baseBackendTrading = {
  orders: [],
  tradeExecutions: [],
  cancelOrder: vi.fn(),
  closeExecution: vi.fn(),
  cancelExecution: vi.fn(),
};

const renderOrdersList = () =>
  render(
    <ChakraProvider value={defaultSystem}>
      <OrdersList />
    </ChakraProvider>,
  );

describe('OrdersList', () => {
  beforeEach(() => {
    useToastMock.mockReturnValue({ success: vi.fn(), error: vi.fn() });
    useGlobalActionsOptionalMock.mockReturnValue(undefined);
    useUIStoreMock.mockImplementation((selector?: (s: typeof baseUIState) => unknown) =>
      selector ? selector(baseUIState) : baseUIState,
    );
    trpcMock.trading.getOrdersStats.useQuery.mockReturnValue({ data: { ordersCount: 0, executionsCount: 0 } });
  });

  it('renders the no-wallet warning when there is no active wallet', () => {
    useActiveWalletMock.mockReturnValue({ activeWallet: undefined, wallets: [] });
    useBackendTradingMock.mockReturnValue(baseBackendTrading);

    renderOrdersList();
    expect(screen.getByText('trading.orders.noWallet')).toBeDefined();
  });

  it('renders the empty-state when wallet exists and orders/executions are empty', () => {
    useActiveWalletMock.mockReturnValue({
      activeWallet: { id: 'w1', currency: 'USDT' },
      wallets: [{ id: 'w1', currency: 'USDT' }],
    });
    useBackendTradingMock.mockReturnValue(baseBackendTrading);

    renderOrdersList();
    expect(screen.getByText('trading.orders.empty')).toBeDefined();
  });
});
