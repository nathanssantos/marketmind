import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BacktestResult } from '@marketmind/types';
import { ColorModeProvider } from '../ui/color-mode';
import { BacktestResults } from './BacktestResults';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>
    <ColorModeProvider>{children}</ColorModeProvider>
  </ChakraProvider>
);

const baseResult: BacktestResult = {
  backtestId: 'bt-test',
  config: {
    symbol: 'BTCUSDT',
    interval: '1h',
    startDate: '2025-11-15',
    endDate: '2026-05-15',
    initialCapital: 10000,
  } as never,
  metrics: {
    totalTrades: 57,
    winningTrades: 16,
    losingTrades: 41,
    winRate: 28.07,
    totalPnl: -170.09,
    totalPnlPercent: -1.7,
    grossProfit: 0,
    grossLoss: 0,
    profitFactor: 0.72,
    avgTradePnl: -2.98,
    avgTradePnlPercent: -0.03,
    avgWinningTrade: 0,
    avgLosingTrade: 0,
    largestWin: 0,
    largestLoss: 0,
    avgRiskReward: 0,
    sharpeRatio: -3.17,
    maxDrawdown: 0,
    maxDrawdownPercent: 1.8,
    sortinoRatio: 0,
    expectancy: 0,
    durationDays: 182,
  },
  trades: [],
  equityCurve: [],
} as never;

describe('BacktestResults', () => {
  it('renders top-level metrics from a typical run', () => {
    render(<Wrapper><BacktestResults result={baseResult} onRunAnother={vi.fn()} /></Wrapper>);
    // Header summary line
    expect(screen.getByText(/BTCUSDT/)).toBeInTheDocument();
    expect(screen.getByText(/1h/)).toBeInTheDocument();
    expect(screen.getByText(/2025-11-15/)).toBeInTheDocument();
    // Trade count card
    expect(screen.getByText('57')).toBeInTheDocument();
    // Win rate
    expect(screen.getByText('28.1%')).toBeInTheDocument();
  });

  it('handles a zero-trades result without crashing (sparse strategy case)', () => {
    const zeroResult = {
      ...baseResult,
      metrics: { ...baseResult.metrics, totalTrades: 0, winRate: 0, totalPnlPercent: 0 },
      trades: [],
    } as never;
    render(<Wrapper><BacktestResults result={zeroResult} onRunAnother={vi.fn()} /></Wrapper>);
    // Trade count card renders 0; winRate card renders 0.0%. There are
    // multiple "0" labels across cards (totalTrades, winningTrades, etc.)
    // so use a regex / multi-element query instead of exact text match.
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThan(0);
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('invokes onRunAnother when the action button is clicked', async () => {
    const onRunAnother = vi.fn();
    render(<Wrapper><BacktestResults result={baseResult} onRunAnother={onRunAnother} /></Wrapper>);
    const btn = screen.getByRole('button');
    btn.click();
    expect(onRunAnother).toHaveBeenCalledTimes(1);
  });
});
