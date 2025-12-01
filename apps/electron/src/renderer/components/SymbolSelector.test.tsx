import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarketDataService } from '../services/market/MarketDataService';
import { SymbolSelector } from './SymbolSelector';

const mockSearchFn = vi.fn();

vi.mock('../hooks/useSymbolSearch', () => ({
  useSymbolSearch: vi.fn(() => ({
    symbols: [
      { symbol: 'BTCUSDT', displayName: 'Bitcoin / USDT', baseAsset: 'BTC', quoteAsset: 'USDT' },
      { symbol: 'ETHUSDT', displayName: 'Ethereum / USDT', baseAsset: 'ETH', quoteAsset: 'USDT' },
    ],
    loading: false,
    search: mockSearchFn,
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
  let mockMarketService: MarketDataService;
  let mockOnChange: (symbol: string) => void;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    mockMarketService = {} as MarketDataService;
    mockOnChange = vi.fn();
    user = userEvent.setup();
    mockSearchFn.mockClear();
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
        marketService={mockMarketService}
        value="BTCUSDT"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('BTC')).toBeInTheDocument();
  });

  it('should display current symbol', () => {
    renderWithChakra(
      <SymbolSelector
        marketService={mockMarketService}
        value="ETHUSDT"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('ETH')).toBeInTheDocument();
  });

  it('should display symbol without USDT suffix when not in popular list', () => {
    renderWithChakra(
      <SymbolSelector
        marketService={mockMarketService}
        value="XYZUSDT"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('XYZ')).toBeInTheDocument();
  });

  it('should render IconButton with coins icon', () => {
    renderWithChakra(
      <SymbolSelector
        marketService={mockMarketService}
        value="BTCUSDT"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByRole('button', { name: 'symbolSelector.label' })).toBeInTheDocument();
  });

  it('should open popover when button is clicked', async () => {
    renderWithChakra(
      <SymbolSelector
        marketService={mockMarketService}
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
        marketService={mockMarketService}
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

  it('should call search when typing in search box', async () => {
    renderWithChakra(
      <SymbolSelector
        marketService={mockMarketService}
        value="BTCUSDT"
        onChange={mockOnChange}
      />
    );

    await user.click(screen.getByRole('button', { name: 'symbolSelector.label' }));

    const searchInput = await screen.findByPlaceholderText('symbolSelector.searchPlaceholder');
    await user.type(searchInput, 'BTC');

    expect(mockSearchFn).toHaveBeenCalledWith('B');
    expect(mockSearchFn).toHaveBeenCalledWith('BT');
    expect(mockSearchFn).toHaveBeenCalledWith('BTC');
  });

  it('should call onChange when selecting a symbol', async () => {
    renderWithChakra(
      <SymbolSelector
        marketService={mockMarketService}
        value="BTCUSDT"
        onChange={mockOnChange}
      />
    );

    await user.click(screen.getByRole('button', { name: 'symbolSelector.label' }));

    await waitFor(() => {
      expect(screen.getByText('Ethereum / USDT')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Ethereum / USDT'));

    expect(mockOnChange).toHaveBeenCalledWith('ETHUSDT');
  });

  it('should close popover after selecting a symbol', async () => {
    renderWithChakra(
      <SymbolSelector
        marketService={mockMarketService}
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
