import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BacktestModal } from './BacktestModal';
import { useBacktestModalStore } from '../../store/backtestModalStore';

const renderModal = () =>
  render(
    <ChakraProvider value={defaultSystem}>
      <BacktestModal />
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

  it('renders title and placeholder content when openBacktest() is called before render', () => {
    act(() => {
      useBacktestModalStore.getState().openBacktest();
    });
    renderModal();
    expect(screen.getByText('backtest.title')).toBeInTheDocument();
    expect(screen.getByText('backtest.comingSoon')).toBeInTheDocument();
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
