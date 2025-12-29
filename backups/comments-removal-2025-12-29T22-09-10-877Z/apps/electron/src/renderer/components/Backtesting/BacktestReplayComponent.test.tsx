import type { Kline } from '@marketmind/types';
import type { BacktestResult, BacktestTrade } from '@marketmind/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '../../../tests/test-utils';
import { BacktestReplayComponent } from './BacktestReplayComponent';

const createKline = (timestamp: number, close: number): Kline => ({
  symbol: 'BTCUSDT',
  interval: '1h',
  openTime: timestamp,
  open: String(close),
  high: String(close * 1.01),
  low: String(close * 0.99),
  close: String(close),
  volume: String(1000),
  closeTime: timestamp + 60000,
  quoteVolume: String(close * 1000),
  trades: 100,
  baseAssetVolume: String(500),
  quoteAssetVolume: String(close * 500),
});

const createTrade = (entryTime: number, exitTime: number, pnl: number): BacktestTrade => ({
  id: `trade-${entryTime}`,
  setupType: 'Test Setup',
  entryTime: new Date(entryTime).toISOString(),
  entryPrice: 50000,
  exitTime: new Date(exitTime).toISOString(),
  exitPrice: 50000 + pnl,
  quantity: 1,
  side: 'LONG',
  pnl,
  exitReason: 'TAKE_PROFIT',
  commission: 10,
  status: 'CLOSED',
});

const createMockResult = (trades: BacktestTrade[]): BacktestResult => ({
  id: 'test-result',
  config: {
    symbol: 'BTCUSDT',
    interval: '1h',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    initialCapital: 10000,
    commission: 0.001,
    setupTypes: ['Test Setup'],
  },
  trades,
  metrics: {
    totalTrades: trades.length,
    winningTrades: trades.filter((t) => (t.pnl ?? 0) > 0).length,
    losingTrades: trades.filter((t) => (t.pnl ?? 0) <= 0).length,
    winRate: trades.filter((t) => (t.pnl ?? 0) > 0).length / trades.length,
    totalReturn: 0.25,
    totalReturnPercent: 25,
    sharpeRatio: 1.5,
    profitFactor: 2.0,
    maxDrawdown: 0.15,
    maxDrawdownPercent: 15,
    avgWin: 150,
    avgLoss: -80,
    expectancy: 50,
    consecutiveWins: 3,
    consecutiveLosses: 2,
    totalPnl: 2500,
    totalCommission: 100,
    netPnl: 2400,
  },
  equityCurve: [],
  startTime: '2024-01-01T00:00:00Z',
  endTime: '2024-12-31T23:59:59Z',
  duration: 0,
  status: 'COMPLETED',
});

describe('BacktestReplayComponent', () => {
  let klines: Kline[];
  let result: BacktestResult;

  beforeEach(() => {
    vi.useFakeTimers();

    const startTime = new Date('2024-01-01').getTime();
    klines = Array.from({ length: 100 }, (_, i) => createKline(startTime + i * 60000, 50000 + i * 10));

    const trades = [
      createTrade(klines[10].openTime, klines[20].openTime, 500),
      createTrade(klines[30].openTime, klines[40].openTime, -200),
      createTrade(klines[50].openTime, klines[60].openTime, 300),
    ];

    result = createMockResult(trades);
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('should render replay component', () => {
      render(<BacktestReplayComponent result={result} klines={klines} />);

      expect(screen.getByText('Backtest Replay')).toBeInTheDocument();
      expect(screen.getByLabelText('Play')).toBeInTheDocument();
      expect(screen.getByLabelText('Reset')).toBeInTheDocument();
    });

    it('should display current candle information', () => {
      render(<BacktestReplayComponent result={result} klines={klines} />);

      expect(screen.getByText(/Candle 1 of 100/i)).toBeInTheDocument();
    });

    it('should display speed controls', () => {
      render(<BacktestReplayComponent result={result} klines={klines} />);

      expect(screen.getByText('1x')).toBeInTheDocument();
      expect(screen.getByText('2x')).toBeInTheDocument();
      expect(screen.getByText('5x')).toBeInTheDocument();
      expect(screen.getByText('10x')).toBeInTheDocument();
    });

    it('should display current metrics', () => {
      render(<BacktestReplayComponent result={result} klines={klines} />);

      expect(screen.getByText('Current Metrics')).toBeInTheDocument();
      expect(screen.getByText('Equity:')).toBeInTheDocument();
      expect(screen.getByText('Total P&L:')).toBeInTheDocument();
    });
  });

  describe('playback controls', () => {
    it('should play on play button click', () => {
      render(<BacktestReplayComponent result={result} klines={klines} />);

      const playButton = screen.getByLabelText('Play');
      fireEvent.click(playButton);

      expect(screen.getByLabelText('Pause')).toBeInTheDocument();
    });

    it('should pause on pause button click', () => {
      render(<BacktestReplayComponent result={result} klines={klines} />);

      const playButton = screen.getByLabelText('Play');
      fireEvent.click(playButton);

      const pauseButton = screen.getByLabelText('Pause');
      fireEvent.click(pauseButton);

      expect(screen.getByLabelText('Play')).toBeInTheDocument();
    });

    it('should step forward on step button click', () => {
      render(<BacktestReplayComponent result={result} klines={klines} />);

      const stepButton = screen.getByLabelText('Step forward');
      fireEvent.click(stepButton);

      expect(screen.getByText(/Candle 2 of 100/i)).toBeInTheDocument();
    });

    it('should step backward on step back button click', () => {
      render(<BacktestReplayComponent result={result} klines={klines} />);

      const stepButton = screen.getByLabelText('Step forward');
      fireEvent.click(stepButton);
      fireEvent.click(stepButton);

      const stepBackButton = screen.getByLabelText('Step back');
      fireEvent.click(stepBackButton);

      expect(screen.getByText(/Candle 2 of 100/i)).toBeInTheDocument();
    });

    it('should reset to start on reset button click', () => {
      render(<BacktestReplayComponent result={result} klines={klines} />);

      const stepButton = screen.getByLabelText('Step forward');
      fireEvent.click(stepButton);
      fireEvent.click(stepButton);

      const resetButton = screen.getByLabelText('Reset');
      fireEvent.click(resetButton);

      expect(screen.getByText(/Candle 1 of 100/i)).toBeInTheDocument();
    });
  });

  describe('metrics calculation', () => {
    it('should show initial metrics at start', () => {
      render(<BacktestReplayComponent result={result} klines={klines} />);

      expect(screen.getByText('$10,000.00')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should update metrics as replay progresses', () => {
      render(<BacktestReplayComponent result={result} klines={klines} />);

      const stepButton = screen.getByLabelText('Step forward');

      for (let i = 0; i < 25; i++) {
        fireEvent.click(stepButton);
      }

      expect(screen.getByText('Total Trades:')).toBeInTheDocument();
    });

    it('should show active trade when inside trade window', () => {
      render(<BacktestReplayComponent result={result} klines={klines} />);

      const stepButton = screen.getByLabelText('Step forward');

      for (let i = 0; i < 15; i++) {
        fireEvent.click(stepButton);
      }

      expect(screen.getByText('Active Trade Details')).toBeInTheDocument();
      expect(screen.getByText('Test Setup')).toBeInTheDocument();
    });

    it('should not show active trade outside trade window', () => {
      render(<BacktestReplayComponent result={result} klines={klines} />);

      expect(screen.queryByText('Active Trade Details')).not.toBeInTheDocument();
    });
  });

  describe('callbacks', () => {
    it('should call onCurrentIndexChange when index changes', () => {
      const onCurrentIndexChange = vi.fn();
      render(
        <BacktestReplayComponent
          result={result}
          klines={klines}
          onCurrentIndexChange={onCurrentIndexChange}
        />
      );

      const stepButton = screen.getByLabelText('Step forward');
      fireEvent.click(stepButton);

      expect(onCurrentIndexChange).toHaveBeenCalledWith(1);
    });

    it('should call onTradeHighlight with active trade', () => {
      const onTradeHighlight = vi.fn();
      render(
        <BacktestReplayComponent
          result={result}
          klines={klines}
          onTradeHighlight={onTradeHighlight}
        />
      );

      const stepButton = screen.getByLabelText('Step forward');

      for (let i = 0; i < 15; i++) {
        fireEvent.click(stepButton);
      }

      expect(onTradeHighlight).toHaveBeenCalledWith(expect.objectContaining({
        setupType: 'Test Setup',
        pnl: 500,
      }));
    });

    it('should call onTradeHighlight with null when no active trade', () => {
      const onTradeHighlight = vi.fn();
      render(
        <BacktestReplayComponent
          result={result}
          klines={klines}
          onTradeHighlight={onTradeHighlight}
        />
      );

      expect(onTradeHighlight).toHaveBeenCalledWith(null);
    });
  });

  describe('slider interaction', () => {
    it('should update index on slider change', () => {
      render(<BacktestReplayComponent result={result} klines={klines} />);

      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '50' } });

      expect(screen.getByText(/Candle 51 of 100/i)).toBeInTheDocument();
    });

    it.skip('should pause playback when slider is used', async () => {
      render(<BacktestReplayComponent result={result} klines={klines} />);

      const playButton = screen.getByLabelText('Play');
      fireEvent.click(playButton);

      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '50' } });

      await waitFor(() => {
        expect(screen.getByLabelText('Play')).toBeInTheDocument();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty klines array', () => {
      const emptyResult = createMockResult([]);
      render(<BacktestReplayComponent result={emptyResult} klines={[]} />);

      expect(screen.getByText('Backtest Replay')).toBeInTheDocument();
    });

    it('should handle result with no trades', () => {
      const noTradesResult = createMockResult([]);
      render(<BacktestReplayComponent result={noTradesResult} klines={klines} />);

      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('0.00%')).toBeInTheDocument();
    });

    it('should disable step forward at end of replay', () => {
      const shortKlines = klines.slice(0, 5);
      render(<BacktestReplayComponent result={result} klines={shortKlines} />);

      const stepButton = screen.getByLabelText('Step forward');

      for (let i = 0; i < 4; i++) {
        fireEvent.click(stepButton);
      }

      expect(stepButton).toBeDisabled();
    });

    it('should disable step backward at start of replay', () => {
      render(<BacktestReplayComponent result={result} klines={klines} />);

      const stepBackButton = screen.getByLabelText('Step back');
      expect(stepBackButton).toBeDisabled();
    });
  });

  describe('auto-play functionality', () => {
    it.skip('should advance automatically when playing', async () => {
      render(<BacktestReplayComponent result={result} klines={klines} />);

      const playButton = screen.getByLabelText('Play');
      fireEvent.click(playButton);

      vi.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(screen.getByText(/Candle 2 of 100/i)).toBeInTheDocument();
      });
    });

    it.skip('should stop at end of replay', async () => {
      const shortKlines = klines.slice(0, 3);
      render(<BacktestReplayComponent result={result} klines={shortKlines} />);

      const playButton = screen.getByLabelText('Play');
      fireEvent.click(playButton);

      vi.advanceTimersByTime(3000);

      await waitFor(() => {
        expect(screen.getByLabelText('Play')).toBeInTheDocument();
      });
    });

    it.skip('should respect playback speed', async () => {
      render(<BacktestReplayComponent result={result} klines={klines} />);

      const speed2xButton = screen.getByText('2x');
      fireEvent.click(speed2xButton);

      const playButton = screen.getByLabelText('Play');
      fireEvent.click(playButton);

      vi.advanceTimersByTime(500);

      await waitFor(() => {
        expect(screen.getByText(/Candle 2 of 100/i)).toBeInTheDocument();
      });
    });
  });
});
