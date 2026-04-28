import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScreenerResultsTable } from './ScreenerResultsTable';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const renderTable = (results: Parameters<typeof ScreenerResultsTable>[0]['results']) =>
  render(
    <ChakraProvider value={defaultSystem}>
      <ScreenerResultsTable
        results={results}
        sortKey="compositeScore"
        sortDirection="desc"
        onSort={vi.fn()}
      />
    </ChakraProvider>,
  );

describe('ScreenerResultsTable', () => {
  it('renders the empty-state when results is empty', () => {
    renderTable([]);
    expect(screen.getByText('screener.results.empty')).toBeDefined();
  });

  it('does not render the empty-state when results is non-empty', () => {
    renderTable([
      {
        symbol: 'BTCUSDT',
        displayName: 'Bitcoin',
        price: 60000,
        priceChangePercent24h: 1.5,
        volume24h: 1_000_000,
        marketCapRank: 1,
        compositeScore: 80,
        indicators: { RSI: 55, ADX: 25, ATR_PERCENT: 2, VOLUME_RATIO: 1.5 },
      },
    ]);
    expect(screen.queryByText('screener.results.empty')).toBeNull();
  });
});
