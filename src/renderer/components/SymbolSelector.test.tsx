import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SymbolSelector } from './SymbolSelector';
import type { MarketDataService } from '../services/market/MarketDataService';

vi.mock('../hooks/useSymbolSearch', () => ({
  useSymbolSearch: vi.fn(() => ({
    symbols: [
      { symbol: 'BTCUSDT', displayName: 'Bitcoin / USDT', baseAsset: 'BTC', quoteAsset: 'USDT' },
      { symbol: 'ETHUSDT', displayName: 'Ethereum / USDT', baseAsset: 'ETH', quoteAsset: 'USDT' },
    ],
    loading: false,
  })),
}));

vi.mock('@/renderer/components/ui/select', () => ({
  Select: ({ placeholder, label }: { placeholder: string; label: string }) => (
    <div data-testid="select">
      <div data-testid="select-label">{label}</div>
      <div data-testid="select-placeholder">{placeholder}</div>
    </div>
  ),
}));

describe('SymbolSelector', () => {
  let mockMarketService: MarketDataService;
  let mockOnChange: (symbol: string) => void;

  beforeEach(() => {
    mockMarketService = {} as MarketDataService;
    mockOnChange = vi.fn();
  });

  it('should render with Binance label', () => {
    render(
      <SymbolSelector
        marketService={mockMarketService}
        value="BTCUSDT"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByTestId('select-label')).toHaveTextContent('symbolSelector.label');
  });

  it('should display symbol display name as placeholder', () => {
    render(
      <SymbolSelector
        marketService={mockMarketService}
        value="BTCUSDT"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByTestId('select-placeholder')).toHaveTextContent('Bitcoin / USDT');
  });

  it('should display symbol code when not in popular list', () => {
    render(
      <SymbolSelector
        marketService={mockMarketService}
        value="UNKNOWN"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByTestId('select-placeholder')).toHaveTextContent('UNKNOWN');
  });

  it('should render Select component', () => {
    render(
      <SymbolSelector
        marketService={mockMarketService}
        value="ETHUSDT"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByTestId('select')).toBeInTheDocument();
  });
});
