import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BacktestModal } from './BacktestModal';
import { useBacktestModalStore } from '../../store/backtestModalStore';

vi.mock('../../utils/trpc', () => ({
  trpc: {
    setupDetection: {
      listStrategies: {
        useQuery: () => ({ data: [], isLoading: false, isError: false }),
      },
    },
  },
}));

vi.mock('../SymbolSelector', () => ({
  SymbolSelector: ({ value }: { value: string }) => <div data-testid="symbol-selector-stub">{value}</div>,
}));

const queryClient = new QueryClient();

const renderModal = () =>
  render(
    <ChakraProvider value={defaultSystem}>
      <QueryClientProvider client={queryClient}>
        <BacktestModal />
      </QueryClientProvider>
    </ChakraProvider>,
  );

afterEach(() => {
  act(() => {
    useBacktestModalStore.getState().closeBacktest();
  });
});

describe('BacktestModal', () => {
  it('does not render the dialog when store flag is false', () => {
    renderModal();
    expect(screen.queryByText('backtest.title')).not.toBeInTheDocument();
  });

  it('renders title and tab triggers when openBacktest() is called before render', () => {
    act(() => {
      useBacktestModalStore.getState().openBacktest();
    });
    renderModal();
    expect(screen.getByText('backtest.title')).toBeInTheDocument();
    expect(screen.getByText('backtest.tabs.basic')).toBeInTheDocument();
    expect(screen.getByText('backtest.tabs.strategies')).toBeInTheDocument();
    expect(screen.getByText('backtest.tabs.filters')).toBeInTheDocument();
    expect(screen.getByText('backtest.tabs.risk')).toBeInTheDocument();
  });

  it('exposes toggle behaviour through the store', () => {
    expect(useBacktestModalStore.getState().isBacktestOpen).toBe(false);
    act(() => {
      useBacktestModalStore.getState().toggleBacktest();
    });
    expect(useBacktestModalStore.getState().isBacktestOpen).toBe(true);
    act(() => {
      useBacktestModalStore.getState().toggleBacktest();
    });
    expect(useBacktestModalStore.getState().isBacktestOpen).toBe(false);
  });
});
