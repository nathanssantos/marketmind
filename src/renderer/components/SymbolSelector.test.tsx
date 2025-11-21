import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarketDataService } from '../services/market/MarketDataService';
import { SymbolSelector } from './SymbolSelector';

vi.mock('../hooks/useSymbolSearch', () => ({
  useSymbolSearch: vi.fn(() => ({
    symbols: [
      { symbol: 'BTCUSDT', displayName: 'Bitcoin / USDT', baseAsset: 'BTC', quoteAsset: 'USDT' },
      { symbol: 'ETHUSDT', displayName: 'Ethereum / USDT', baseAsset: 'ETH', quoteAsset: 'USDT' },
    ],
    loading: false,
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

  beforeEach(() => {
    mockMarketService = {} as MarketDataService;
    mockOnChange = vi.fn();
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

    expect(screen.getByText('Bitcoin / USDT')).toBeInTheDocument();
  });

  it('should display current symbol', () => {
    renderWithChakra(
      <SymbolSelector
        marketService={mockMarketService}
        value="ETHUSDT"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Ethereum / USDT')).toBeInTheDocument();
  });

  it('should display symbol code when not in popular list', () => {
    renderWithChakra(
      <SymbolSelector
        marketService={mockMarketService}
        value="UNKNOWN"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('UNKNOWN')).toBeInTheDocument();
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
});
