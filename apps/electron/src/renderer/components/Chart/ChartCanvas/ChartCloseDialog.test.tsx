import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChartCloseDialog } from './ChartCloseDialog';
import type { BackendExecution } from '../useOrderLinesRenderer';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      if (!vars) return key;
      return Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)), key);
    },
  }),
}));

const wrap = (ui: React.ReactElement) => (
  <ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>
);

const mockExec: BackendExecution = {
  id: 'exec-1',
  symbol: 'BTCUSDT',
  side: 'LONG',
  entryPrice: '100',
  quantity: '0.01',
  stopLoss: null,
  takeProfit: null,
  status: 'open',
  setupType: null,
  marketType: 'FUTURES',
  openedAt: new Date().toISOString(),
};

const mockManager = {
  getKlines: () => [{ openTime: 0, closeTime: 0, open: 100, high: 110, low: 95, close: 110, volume: 0 }],
} as unknown as CanvasManager;

describe('ChartCloseDialog', () => {
  it('renders nothing when orderToClose is null', () => {
    const { container } = render(
      wrap(
        <ChartCloseDialog
          orderToClose={null}
          onOpenChange={vi.fn()}
          onConfirmClose={vi.fn()}
          allExecutions={[]}
          manager={null}
        />,
      ),
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders close-position confirmation with PnL when execution is open', () => {
    render(
      wrap(
        <ChartCloseDialog
          orderToClose="exec-1"
          onOpenChange={vi.fn()}
          onConfirmClose={vi.fn()}
          allExecutions={[mockExec]}
          manager={mockManager}
        />,
      ),
    );
    expect(screen.getByText('trading.dialogs.chartClose.title')).toBeInTheDocument();
    expect(screen.getByText('trading.dialogs.chartClose.submit')).toBeInTheDocument();
    expect(screen.getByText(/\+10\.00%/)).toBeInTheDocument();
  });

  it('renders sltp removal confirmation with type interpolation', () => {
    render(
      wrap(
        <ChartCloseDialog
          orderToClose="sltp:stopLoss:exec-1"
          onOpenChange={vi.fn()}
          onConfirmClose={vi.fn()}
          allExecutions={[mockExec]}
          manager={mockManager}
        />,
      ),
    );
    expect(screen.getByText('trading.dialogs.chartRemoveSlTp.title')).toBeInTheDocument();
    expect(screen.getByText('trading.dialogs.chartRemoveSlTp.submit')).toBeInTheDocument();
  });
});
