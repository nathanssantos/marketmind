import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RecentRunsPanel } from './RecentRunsPanel';

const listMock = vi.fn();

vi.mock('../../utils/trpc', () => ({
  trpc: {
    backtest: {
      list: {
        useQuery: () => listMock(),
      },
    },
  },
}));

const Wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <ChakraProvider value={defaultSystem}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ChakraProvider>
  );
};

describe('RecentRunsPanel', () => {
  it('renders nothing when the list is empty (no recent runs)', () => {
    listMock.mockReturnValue({ data: [], isLoading: false });
    const { container } = render(<Wrapper><RecentRunsPanel onSelect={vi.fn()} /></Wrapper>);
    // null return → empty container
    expect(container.firstChild).toBeNull();
  });

  it('renders a loading spinner while the query is in flight', () => {
    listMock.mockReturnValue({ data: undefined, isLoading: true });
    render(<Wrapper><RecentRunsPanel onSelect={vi.fn()} /></Wrapper>);
    // LoadingSpinner is the only renderable when loading; presence is
    // enough — we don't pin to specific copy because that depends on
    // i18n state in the test env.
    expect(document.querySelector('[role="status"], [class*="spinner" i]')).toBeTruthy();
  });

  it('renders up to 5 recent runs and emits the id on click', () => {
    const runs = Array.from({ length: 7 }, (_, i) => ({
      id: `bt-${i}`,
      symbol: 'BTCUSDT',
      interval: '1h',
      status: 'COMPLETED' as const,
      startDate: '2025-11-15',
      endDate: '2026-05-15',
      totalPnlPercent: 1.5 + i,
      totalTrades: 50 + i,
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
    }));
    listMock.mockReturnValue({ data: runs, isLoading: false });

    const onSelect = vi.fn();
    render(<Wrapper><RecentRunsPanel onSelect={onSelect} /></Wrapper>);

    // Slice to 5 — the panel caps the list. 5 expected, not 7.
    const items = screen.getAllByTestId('recent-run-item');
    expect(items).toHaveLength(5);

    items[0]!.click();
    expect(onSelect).toHaveBeenCalledWith('bt-0');
  });
});
