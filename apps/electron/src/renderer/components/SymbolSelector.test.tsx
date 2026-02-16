import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SymbolSelector } from './SymbolSelector';

vi.mock('../hooks/useActiveWallet', () => ({
  useActiveWallet: vi.fn(() => ({
    activeWalletId: 'test-wallet-id',
    activeWallet: null,
    wallets: [],
    isLoading: false,
    setActiveWalletId: vi.fn(),
    isIB: false,
    assetClass: 'CRYPTO',
    exchangeId: 'BINANCE',
  })),
}));

vi.mock('../utils/trpc', () => ({
  trpc: {
    trading: {
      getTradeExecutions: {
        useQuery: vi.fn(() => ({ data: undefined })),
      },
    },
    autoTrading: {
      getActiveExecutions: {
        useQuery: vi.fn(() => ({ data: undefined })),
      },
    },
  },
}));

vi.mock('../hooks/useBackendKlines', () => ({
  useBackendKlines: vi.fn(() => ({
    useSearchSymbols: vi.fn(() => ({
      data: [
        { symbol: 'BTCUSDT', displayName: 'Bitcoin / USDT', baseAsset: 'BTC', quoteAsset: 'USDT' },
        { symbol: 'ETHUSDT', displayName: 'Ethereum / USDT', baseAsset: 'ETH', quoteAsset: 'USDT' },
      ],
      isLoading: false,
    })),
    subscribe: { mutate: vi.fn() },
    unsubscribe: { mutate: vi.fn() },
    subscribeStream: { mutate: vi.fn(), isPending: false },
    unsubscribeStream: { mutate: vi.fn() },
    backfill: { mutate: vi.fn() },
    useKlineList: vi.fn(),
    useLatestKline: vi.fn(),
    useKlineCount: vi.fn(),
  })),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/renderer/components/ui/Tooltip', () => ({
  TooltipWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('SymbolSelector', () => {
  let mockOnChange: ReturnType<typeof vi.fn>;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    mockOnChange = vi.fn();
    user = userEvent.setup();
  });

  const renderWithChakra = (component: React.ReactElement) => {
    return render(
      <ChakraProvider value={defaultSystem}>
        {component}
      </ChakraProvider>
    );
  };

  it('should render symbol selector button', () => {
    renderWithChakra(
      <SymbolSelector
        value="BTCUSDT"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('BTC')).toBeInTheDocument();
  });

  it('should display current symbol', () => {
    renderWithChakra(
      <SymbolSelector
        value="ETHUSDT"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('ETH')).toBeInTheDocument();
  });

  it('should display symbol without USDT suffix when not in popular list', () => {
    renderWithChakra(
      <SymbolSelector
        value="XYZUSDT"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('XYZ')).toBeInTheDocument();
  });

  it('should render IconButton with coins icon', () => {
    renderWithChakra(
      <SymbolSelector
        value="BTCUSDT"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByRole('button', { name: 'symbolSelector.label' })).toBeInTheDocument();
  });

  it('should open popover when button is clicked', async () => {
    renderWithChakra(
      <SymbolSelector
        value="BTCUSDT"
        onChange={mockOnChange}
      />
    );

    const button = screen.getByRole('button', { name: 'symbolSelector.label' });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('symbolSelector.searchPlaceholder')).toBeInTheDocument();
    });
  });

  it('should show popular symbols initially', async () => {
    renderWithChakra(
      <SymbolSelector
        value="BTCUSDT"
        onChange={mockOnChange}
      />
    );

    await user.click(screen.getByRole('button', { name: 'symbolSelector.label' }));

    await waitFor(() => {
      expect(screen.getByText('Bitcoin / USDT')).toBeInTheDocument();
      expect(screen.getByText('Ethereum / USDT')).toBeInTheDocument();
    });
  });

  it('should call onChange when selecting a symbol', async () => {
    renderWithChakra(
      <SymbolSelector
        value="BTCUSDT"
        onChange={mockOnChange}
      />
    );

    await user.click(screen.getByRole('button', { name: 'symbolSelector.label' }));

    await waitFor(() => {
      expect(screen.getByText('Ethereum / USDT')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Ethereum / USDT'));

    expect(mockOnChange).toHaveBeenCalledWith('ETHUSDT', 'FUTURES', 'CRYPTO');
  });

  it('should close popover after selecting a symbol', async () => {
    renderWithChakra(
      <SymbolSelector
        value="BTCUSDT"
        onChange={mockOnChange}
      />
    );

    await user.click(screen.getByRole('button', { name: 'symbolSelector.label' }));

    const ethOption = await screen.findByText('Ethereum / USDT');
    await user.click(ethOption);

    await waitFor(() => {
      const trigger = screen.getByRole('button', { name: 'symbolSelector.label' });
      expect(trigger.closest('[data-part="trigger"]')).toHaveAttribute('data-state', 'closed');
    });
  });
});
