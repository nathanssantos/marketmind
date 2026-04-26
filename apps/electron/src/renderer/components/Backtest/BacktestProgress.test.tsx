import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BacktestProgress } from './BacktestProgress';
import type { BacktestProgressPayload } from '@marketmind/types';

const renderWithChakra = (ui: ReactElement) =>
  render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);

const sampleProgress = (overrides: Partial<BacktestProgressPayload> = {}): BacktestProgressPayload => ({
  backtestId: 'bt-1',
  phase: 'simulating',
  processed: 50,
  total: 100,
  etaMs: 30_000,
  startedAt: Date.now() - 30_000,
  ...overrides,
});

describe('BacktestProgress', () => {
  it('renders the phase label translation key', () => {
    renderWithChakra(<BacktestProgress progress={sampleProgress()} onCancel={vi.fn()} />);
    expect(screen.getByText('backtest.progress.phase.simulating')).toBeInTheDocument();
  });

  it('renders the percent computed from processed/total', () => {
    renderWithChakra(
      <BacktestProgress progress={sampleProgress({ processed: 33, total: 100 })} onCancel={vi.fn()} />,
    );
    expect(screen.getByText('33%')).toBeInTheDocument();
  });

  it('renders calculating-eta key when payload has etaMs=null', () => {
    renderWithChakra(
      <BacktestProgress progress={sampleProgress({ etaMs: null })} onCancel={vi.fn()} />,
    );
    expect(screen.getByText('backtest.progress.etaCalculating')).toBeInTheDocument();
  });

  it('renders the cancel button calling onCancel on click', async () => {
    const onCancel = vi.fn();
    renderWithChakra(<BacktestProgress progress={sampleProgress()} onCancel={onCancel} />);
    const cancelBtn = screen.getByRole('button', { name: 'common.cancel' });
    cancelBtn.click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows the starting placeholder when progress is null', () => {
    renderWithChakra(<BacktestProgress progress={null} onCancel={vi.fn()} />);
    expect(screen.getByText('backtest.progress.starting')).toBeInTheDocument();
  });
});
