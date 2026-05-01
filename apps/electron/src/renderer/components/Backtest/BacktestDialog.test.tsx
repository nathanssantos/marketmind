import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BacktestDialog } from './BacktestDialog';
import { useBacktestDialogStore } from '../../store/backtestDialogStore';

vi.mock('../../utils/trpc', () => ({
  trpc: {
    setupDetection: {
      listStrategies: {
        useQuery: () => ({ data: [], isLoading: false, isError: false }),
      },
    },
    backtest: {
      run: {
        useMutation: () => ({ mutateAsync: vi.fn().mockResolvedValue({ backtestId: 'bt-test' }) }),
      },
      getResult: {
        useQuery: () => ({ data: undefined, isLoading: false }),
      },
      list: {
        useQuery: () => ({ data: [], isLoading: false }),
      },
    },
  },
}));

vi.mock('../SymbolSelector', () => ({
  SymbolSelector: ({ value }: { value: string }) => <div data-testid="symbol-selector-stub">{value}</div>,
}));

vi.mock('../../services/socketBus', () => ({
  socketBus: {
    on: () => () => {},
    emit: vi.fn(),
  },
}));

const queryClient = new QueryClient();

const renderDialog = () =>
  render(
    <ChakraProvider value={defaultSystem}>
      <QueryClientProvider client={queryClient}>
        <BacktestDialog />
      </QueryClientProvider>
    </ChakraProvider>,
  );

afterEach(() => {
  act(() => {
    useBacktestDialogStore.getState().closeBacktest();
  });
});

describe('BacktestDialog', () => {
  it('does not render the dialog when store flag is false', () => {
    renderDialog();
    expect(screen.queryByText('backtest.title')).not.toBeInTheDocument();
  });

  it('renders title and tab triggers when openBacktest() is called before render', () => {
    act(() => {
      useBacktestDialogStore.getState().openBacktest();
    });
    renderDialog();
    expect(screen.getByText('backtest.title')).toBeInTheDocument();
    expect(screen.getByText('backtest.tabs.basic')).toBeInTheDocument();
    expect(screen.getByText('backtest.tabs.strategies')).toBeInTheDocument();
    expect(screen.getByText('backtest.tabs.filters')).toBeInTheDocument();
    expect(screen.getByText('backtest.tabs.risk')).toBeInTheDocument();
  });

  it('exposes toggle behaviour through the store', () => {
    expect(useBacktestDialogStore.getState().isBacktestOpen).toBe(false);
    act(() => {
      useBacktestDialogStore.getState().toggleBacktest();
    });
    expect(useBacktestDialogStore.getState().isBacktestOpen).toBe(true);
    act(() => {
      useBacktestDialogStore.getState().toggleBacktest();
    });
    expect(useBacktestDialogStore.getState().isBacktestOpen).toBe(false);
  });
});
