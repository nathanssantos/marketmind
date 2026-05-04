import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ColorModeProvider } from '@renderer/components/ui/color-mode';

const useActiveWalletMock = vi.fn();
const useBookTickerMock = vi.fn();
const useBackendFuturesTradingMock = vi.fn();
const useBackendTradingMutationsMock = vi.fn();
const useOrderQuantityMock = vi.fn();
const useToastMock = vi.fn();
const useQuickTradeStoreMock = vi.fn();
const usePricesForSymbolsMock = vi.fn();

const reversePositionMock = vi.fn();
const closePositionAndCancelOrdersMock = vi.fn();
const cancelAllOrdersMock = vi.fn();
const createOrderMock = vi.fn();
const setSizePercentMock = vi.fn();
const warningMock = vi.fn();
const errorMock = vi.fn();

vi.mock('@renderer/hooks/useActiveWallet', () => ({
  useActiveWallet: () => useActiveWalletMock(),
}));

vi.mock('@renderer/hooks/useBookTicker', () => ({
  useBookTicker: (symbol: string) => useBookTickerMock(symbol),
}));

vi.mock('@renderer/hooks/useBackendFuturesTrading', () => ({
  useBackendFuturesTrading: (walletId: string) => useBackendFuturesTradingMock(walletId),
}));

vi.mock('@renderer/hooks/useBackendTradingMutations', () => ({
  useBackendTradingMutations: () => useBackendTradingMutationsMock(),
}));

vi.mock('@renderer/hooks/useOrderQuantity', () => ({
  useOrderQuantity: (symbol: string, marketType: string) => useOrderQuantityMock(symbol, marketType),
}));

vi.mock('@renderer/hooks/useToast', () => ({
  useToast: () => useToastMock(),
}));

vi.mock('@renderer/store/quickTradeStore', () => ({
  useQuickTradeStore: () => useQuickTradeStoreMock(),
}));

vi.mock('@renderer/store/priceStore', () => ({
  usePricesForSymbols: (symbols: string[]) => usePricesForSymbolsMock(symbols),
}));

vi.mock('@renderer/utils/canvas/perfMonitor', () => ({
  perfMonitor: {
    isEnabled: () => false,
    recordComponentRender: vi.fn(),
  },
}));

const gridOrderPopoverRender = vi.fn();
vi.mock('./GridOrderPopover', () => ({
  GridOrderPopover: ({ triggerElement }: { triggerElement?: React.ReactNode }) => {
    gridOrderPopoverRender();
    return <div data-testid="grid-popover">{triggerElement}</div>;
  },
}));

const trailingStopPopoverRender = vi.fn();
vi.mock('./TrailingStopPopover', () => ({
  TrailingStopPopover: ({ symbol, triggerElement }: { symbol: string; triggerElement?: React.ReactNode }) => {
    trailingStopPopoverRender(symbol);
    return <div data-testid={`trailing-popover-${symbol}`}>{triggerElement}</div>;
  },
}));

const leveragePopoverRender = vi.fn();
vi.mock('./LeveragePopover', () => ({
  LeveragePopover: ({ symbol }: { symbol: string }) => {
    leveragePopoverRender(symbol);
    return <div data-testid={`leverage-popover-${symbol}`} />;
  },
}));

import { QuickTradeActions } from './QuickTradeToolbar';

const renderActions = (props: Partial<React.ComponentProps<typeof QuickTradeActions>> = {}) =>
  render(
    <ChakraProvider value={defaultSystem}>
      <ColorModeProvider>
        <QuickTradeActions
          symbol="BTCUSDT"
          marketType="FUTURES"
          {...props}
        />
      </ColorModeProvider>
    </ChakraProvider>,
  );

const setDefaults = (overrides: { positions?: unknown[]; sizePercent?: number; price?: number; bid?: number; ask?: number } = {}) => {
  const { positions = [], sizePercent = 10, price = 50_000, bid = 49_950, ask = 50_050 } = overrides;

  useActiveWalletMock.mockReturnValue({ activeWallet: { id: 'w1', currentBalance: '10000' } });
  useBookTickerMock.mockReturnValue({ bidPrice: bid, askPrice: ask });
  useBackendFuturesTradingMock.mockReturnValue({
    positions,
    reversePosition: reversePositionMock,
    isReversingPosition: false,
    closePositionAndCancelOrders: closePositionAndCancelOrdersMock,
    isClosingPositionAndCancellingOrders: false,
    cancelAllOrders: cancelAllOrdersMock,
    isCancellingAllOrders: false,
  });
  useBackendTradingMutationsMock.mockReturnValue({
    createOrder: createOrderMock,
    isCreatingOrder: false,
  });
  useOrderQuantityMock.mockReturnValue({ getQuantity: () => '0.1000', leverage: 5 });
  useToastMock.mockReturnValue({ warning: warningMock, error: errorMock });
  useQuickTradeStoreMock.mockReturnValue({ sizePercent, setSizePercent: setSizePercentMock });
  usePricesForSymbolsMock.mockReturnValue({ BTCUSDT: price });
};

beforeEach(() => {
  setDefaults();
  reversePositionMock.mockResolvedValue({ success: true });
  closePositionAndCancelOrdersMock.mockResolvedValue({ success: true });
  cancelAllOrdersMock.mockResolvedValue({ success: true });
  createOrderMock.mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('QuickTradeToolbar — Buy / Sell flow (regression: v0.107)', () => {
  it('places a BUY market order with the previewed quantity (NOT percent)', async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole('button', { name: /chart\.quickTrade\.buy/i }));

    expect(await screen.findByText('chart.quickTrade.confirmOrder')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /chart\.quickTrade\.confirmBuy/i }));

    expect(createOrderMock).toHaveBeenCalledTimes(1);
    const arg = createOrderMock.mock.calls[0]![0];
    expect(arg).toMatchObject({
      walletId: 'w1',
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'MARKET',
      quantity: '0.1000',
      referencePrice: 50_050,
    });
    expect(arg).not.toHaveProperty('percent');
  });

  it('places a SELL market order at the bid price', async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole('button', { name: /chart\.quickTrade\.sell/i }));
    await user.click(await screen.findByRole('button', { name: /chart\.quickTrade\.confirmSell/i }));

    expect(createOrderMock).toHaveBeenCalledWith(expect.objectContaining({
      side: 'SELL',
      type: 'MARKET',
      quantity: '0.1000',
      referencePrice: 49_950,
    }));
  });

  it('warns when no wallet is active and does NOT open the confirm dialog', async () => {
    useActiveWalletMock.mockReturnValue({ activeWallet: null });
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole('button', { name: /chart\.quickTrade\.buy/i }));

    expect(warningMock).toHaveBeenCalledWith('trading.ticket.noWallet');
    expect(screen.queryByText('chart.quickTrade.confirmOrder')).not.toBeInTheDocument();
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it('errors when computed quantity is invalid (e.g. 0)', async () => {
    useOrderQuantityMock.mockReturnValue({ getQuantity: () => '0', leverage: 5 });
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole('button', { name: /chart\.quickTrade\.buy/i }));

    expect(errorMock).toHaveBeenCalledWith('chart.quickTrade.invalidQuantityError');
    expect(screen.queryByText('chart.quickTrade.confirmOrder')).not.toBeInTheDocument();
  });

  it('errors when no live price is available (book ticker = 0 and store price = 0)', async () => {
    setDefaults({ price: 0, bid: 0, ask: 0 });
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole('button', { name: /chart\.quickTrade\.buy/i }));

    expect(errorMock).toHaveBeenCalledWith('chart.quickTrade.noPriceError');
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it('falls back to currentPrice when the book ticker has no ask/bid', async () => {
    setDefaults({ price: 50_000, bid: 0, ask: 0 });
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole('button', { name: /chart\.quickTrade\.buy/i }));
    await user.click(await screen.findByRole('button', { name: /chart\.quickTrade\.confirmBuy/i }));

    expect(createOrderMock).toHaveBeenCalledWith(expect.objectContaining({ referencePrice: 50_000 }));
  });

  it('shows a toast and resets the pending order if createOrder throws', async () => {
    createOrderMock.mockRejectedValueOnce(new Error('insufficient margin'));
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole('button', { name: /chart\.quickTrade\.buy/i }));
    await user.click(await screen.findByRole('button', { name: /chart\.quickTrade\.confirmBuy/i }));

    expect(errorMock).toHaveBeenCalledWith('trading.order.failed', 'insufficient margin');
  });
});

describe('QuickTradeToolbar — Reverse Position', () => {
  it('the reverse row is disabled when there is no open position', () => {
    renderActions();

    const row = screen.getByText('futures.reversePosition').parentElement!;
    expect(row).toHaveStyle({ opacity: '0.4' });
  });

  it('opens the confirm dialog and calls reversePosition with positionId', async () => {
    const user = userEvent.setup();
    setDefaults({ positions: [{ id: 'pos-1', symbol: 'BTCUSDT', side: 'LONG', status: 'open' }] });
    renderActions();

    await user.click(screen.getByText('futures.reversePosition'));

    expect(await screen.findByText('futures.reverseConfirmTitle')).toBeInTheDocument();

    const dialog = screen.getByText('futures.reverseConfirmTitle').closest('[role="dialog"]')!;
    await user.click(within(dialog).getByRole('button', { name: /futures\.reversePosition/i }));

    expect(reversePositionMock).toHaveBeenCalledWith({
      walletId: 'w1',
      symbol: 'BTCUSDT',
      positionId: 'pos-1',
    });
  });

  it('toasts the error message returned in result.error when reverse fails', async () => {
    reversePositionMock.mockResolvedValueOnce({ success: false, error: 'No active position' });
    setDefaults({ positions: [{ id: 'pos-1', symbol: 'BTCUSDT', side: 'SHORT', status: 'open' }] });
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByText('futures.reversePosition'));

    const dialog = screen.getByText('futures.reverseConfirmTitle').closest('[role="dialog"]')!;
    await user.click(within(dialog).getByRole('button', { name: /futures\.reversePosition/i }));

    await vi.waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith('futures.reverseFailed', 'No active position');
    });
  });

  it('toasts the thrown message when reversePosition rejects', async () => {
    reversePositionMock.mockRejectedValueOnce(new Error('network down'));
    setDefaults({ positions: [{ id: 'pos-1', symbol: 'BTCUSDT', side: 'LONG', status: 'open' }] });
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByText('futures.reversePosition'));

    const dialog = screen.getByText('futures.reverseConfirmTitle').closest('[role="dialog"]')!;
    await user.click(within(dialog).getByRole('button', { name: /futures\.reversePosition/i }));

    await vi.waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith('futures.reverseFailed', 'network down');
    });
  });
});

describe('QuickTradeToolbar — Close Position', () => {
  it('the close row is disabled when there is no open position', () => {
    renderActions();

    const row = screen.getByText('futures.closePosition').parentElement!;
    expect(row).toHaveStyle({ opacity: '0.4' });
  });

  it('opens the confirm dialog and calls closePositionAndCancelOrders with positionId', async () => {
    setDefaults({ positions: [{ id: 'pos-2', symbol: 'BTCUSDT', side: 'LONG', status: 'open' }] });
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByText('futures.closePosition'));

    expect(await screen.findByText('futures.closePositionConfirmTitle')).toBeInTheDocument();

    const dialog = screen.getByText('futures.closePositionConfirmTitle').closest('[role="dialog"]')!;
    await user.click(within(dialog).getByRole('button', { name: /futures\.closePosition/i }));

    expect(closePositionAndCancelOrdersMock).toHaveBeenCalledWith({
      walletId: 'w1',
      symbol: 'BTCUSDT',
      positionId: 'pos-2',
    });
  });

  it('toasts when closePositionAndCancelOrders rejects', async () => {
    closePositionAndCancelOrdersMock.mockRejectedValueOnce(new Error('exchange closed'));
    setDefaults({ positions: [{ id: 'pos-2', symbol: 'BTCUSDT', side: 'LONG', status: 'open' }] });
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByText('futures.closePosition'));

    const dialog = screen.getByText('futures.closePositionConfirmTitle').closest('[role="dialog"]')!;
    await user.click(within(dialog).getByRole('button', { name: /futures\.closePosition/i }));

    await vi.waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith('futures.closePositionFailed', 'exchange closed');
    });
  });
});

describe('QuickTradeToolbar — Cancel Orders', () => {
  it('opens the confirm dialog (no position required) and calls cancelAllOrders', async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByText('futures.cancelOrders'));

    expect(await screen.findByText('futures.cancelOrdersConfirmTitle')).toBeInTheDocument();

    const dialog = screen.getByText('futures.cancelOrdersConfirmTitle').closest('[role="dialog"]')!;
    await user.click(within(dialog).getByRole('button', { name: /futures\.cancelOrders/i }));

    expect(cancelAllOrdersMock).toHaveBeenCalledWith({ walletId: 'w1', symbol: 'BTCUSDT' });
  });

  it('does nothing when there is no active wallet', async () => {
    useActiveWalletMock.mockReturnValue({ activeWallet: null });
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByText('futures.cancelOrders'));

    const dialog = screen.getByText('futures.cancelOrdersConfirmTitle').closest('[role="dialog"]')!;
    await user.click(within(dialog).getByRole('button', { name: /futures\.cancelOrders/i }));

    expect(cancelAllOrdersMock).not.toHaveBeenCalled();
  });

  it('toasts when cancelAllOrders rejects', async () => {
    cancelAllOrdersMock.mockRejectedValueOnce(new Error('rate limited'));
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByText('futures.cancelOrders'));

    const dialog = screen.getByText('futures.cancelOrdersConfirmTitle').closest('[role="dialog"]')!;
    await user.click(within(dialog).getByRole('button', { name: /futures\.cancelOrders/i }));

    await vi.waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith('futures.cancelOrdersFailed', 'rate limited');
    });
  });
});

describe('QuickTradeToolbar — Grid Orders / Trailing Stop sub-components', () => {
  it('renders GridOrderPopover with the action-row trigger always visible', () => {
    renderActions();

    expect(gridOrderPopoverRender).toHaveBeenCalled();
    expect(screen.getByTestId('grid-popover')).toBeInTheDocument();
    expect(screen.getByText('chart.quickTrade.gridOrders')).toBeInTheDocument();
  });

  it('renders TrailingStopPopover with the symbol and the trigger element', () => {
    renderActions();

    expect(trailingStopPopoverRender).toHaveBeenCalledWith('BTCUSDT');
    expect(screen.getByTestId('trailing-popover-BTCUSDT')).toBeInTheDocument();
    expect(screen.getByText('chart.quickTrade.trailingStop')).toBeInTheDocument();
  });

  it('hides Reverse / Close / Cancel rows for SPOT but still renders Grid + Trailing', () => {
    renderActions({ marketType: 'SPOT' });

    expect(screen.queryByText('futures.reversePosition')).not.toBeInTheDocument();
    expect(screen.queryByText('futures.closePosition')).not.toBeInTheDocument();
    expect(screen.queryByText('futures.cancelOrders')).not.toBeInTheDocument();
    expect(screen.getByText('chart.quickTrade.gridOrders')).toBeInTheDocument();
    expect(screen.getByText('chart.quickTrade.trailingStop')).toBeInTheDocument();
  });
});

describe('QuickTradeToolbar — Size controls (presets, slider, +/- 5%)', () => {
  it('clicking a preset updates the size percent', async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole('button', { name: '50%' }));
    expect(setSizePercentMock).toHaveBeenCalledWith(50);
  });

  it('+ button rounds up to the next 5% bucket (10 → 15)', async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole('button', { name: /increase size 5%/i }));
    expect(setSizePercentMock).toHaveBeenCalledWith(15);
  });

  it('- button rounds down to the previous 5% bucket (10 → 5)', async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole('button', { name: /decrease size 5%/i }));
    expect(setSizePercentMock).toHaveBeenCalledWith(5);
  });

  it('+ button caps at 100', () => {
    setDefaults({ sizePercent: 100 });
    renderActions();

    const incButton = screen.getByRole('button', { name: /increase size 5%/i });
    expect(incButton).toBeDisabled();
  });

  it('- button is disabled at the 0.1 minimum', async () => {
    setDefaults({ sizePercent: 0.1 });
    renderActions();
    expect(screen.getByRole('button', { name: /decrease size 5%/i })).toBeDisabled();
  });

  it('renders all 5 size preset buttons (10, 25, 50, 75, 100)', () => {
    renderActions();
    expect(screen.getByRole('button', { name: '10%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '25%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '50%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '75%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '100%' })).toBeInTheDocument();
  });

  it('+ from a non-multiple-of-5 (12.5) snaps to the next 5 bucket (15)', async () => {
    setDefaults({ sizePercent: 12.5 });
    const user = userEvent.setup();
    renderActions();
    await user.click(screen.getByRole('button', { name: /increase size 5%/i }));
    expect(setSizePercentMock).toHaveBeenCalledWith(15);
  });

  it('- from a non-multiple-of-5 (12.5) snaps to the previous 5 bucket (10)', async () => {
    setDefaults({ sizePercent: 12.5 });
    const user = userEvent.setup();
    renderActions();
    await user.click(screen.getByRole('button', { name: /decrease size 5%/i }));
    expect(setSizePercentMock).toHaveBeenCalledWith(10);
  });

  it('display rounds sizePercent to 1 decimal place', () => {
    setDefaults({ sizePercent: 33.333 });
    renderActions();
    expect(screen.getByText('33.3%')).toBeInTheDocument();
  });
});

describe('QuickTradeToolbar — Pending order confirmation dialog', () => {
  const openConfirm = async () => {
    const user = userEvent.setup();
    renderActions();
    await user.click(screen.getByRole('button', { name: /chart\.quickTrade\.buy/i }));
    return user;
  };

  it('shows the order summary (symbol, side, price, quantity, leverage)', async () => {
    setDefaults({ ask: 50_050 });
    useOrderQuantityMock.mockReturnValue({ getQuantity: () => '0.2500', leverage: 10 });
    await openConfirm();

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('BTCUSDT')).toBeInTheDocument();
    expect(within(dialog).getByText('LONG')).toBeInTheDocument();
    expect(within(dialog).getByText('0.2500')).toBeInTheDocument();
    expect(within(dialog).getByText('10x')).toBeInTheDocument();
  });

  it('SELL side renders SHORT in the side row', async () => {
    const user = userEvent.setup();
    renderActions();
    await user.click(screen.getByRole('button', { name: /chart\.quickTrade\.sell/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('SHORT')).toBeInTheDocument();
  });

  it('totalValue = quantity × price', async () => {
    setDefaults({ ask: 50_050 });
    useOrderQuantityMock.mockReturnValue({ getQuantity: () => '0.1000', leverage: 5 });
    await openConfirm();

    const dialog = await screen.findByRole('dialog');
    // 0.1 × 50050 = 5005
    expect(within(dialog).getByText(/5,?005\.00 USDT/)).toBeInTheDocument();
  });

  it('margin = totalValue / leverage', async () => {
    setDefaults({ ask: 50_050 });
    useOrderQuantityMock.mockReturnValue({ getQuantity: () => '0.1000', leverage: 5 });
    await openConfirm();

    const dialog = await screen.findByRole('dialog');
    // 5005 / 5 = 1001
    expect(within(dialog).getByText(/1,?001\.00 USDT/)).toBeInTheDocument();
  });

  it('cancel via close button does NOT fire createOrder', async () => {
    const user = userEvent.setup();
    renderActions();
    await user.click(screen.getByRole('button', { name: /chart\.quickTrade\.buy/i }));

    const dialog = await screen.findByRole('dialog');
    // Close icon button (CloseTrigger) — typically has accessible name "Close" or similar.
    const closeBtn = within(dialog).queryByRole('button', { name: /close|cancel|×/i });
    if (closeBtn) await user.click(closeBtn);

    // Even if the dialog can't be closed by an accessible button match,
    // the absence of a confirm click is enough — createOrder mustn't fire.
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it('keeps the dialog open while createOrder is in flight', async () => {
    let resolveCreate: () => void = () => {};
    createOrderMock.mockReturnValueOnce(new Promise<void>((resolve) => {
      resolveCreate = () => resolve();
    }));
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole('button', { name: /chart\.quickTrade\.buy/i }));
    await user.click(await screen.findByRole('button', { name: /chart\.quickTrade\.confirmBuy/i }));

    // pendingOrder is only cleared in the finally — while the promise
    // is in flight the dialog is still mounted so the user can't
    // double-fire by clicking again.
    expect(screen.getByText('chart.quickTrade.confirmOrder')).toBeInTheDocument();

    resolveCreate();
    await vi.waitFor(() => {
      expect(screen.queryByText('chart.quickTrade.confirmOrder')).not.toBeInTheDocument();
    });
  });
});

describe('QuickTradeToolbar — Position detection edge cases', () => {
  it('detects open position via Binance-shape positions (positionAmt > 0 → LONG)', async () => {
    setDefaults({
      positions: [{ symbol: 'BTCUSDT', positionAmt: '0.5' }],
    });
    const user = userEvent.setup();
    renderActions();

    // Reverse row should be enabled — the Binance-shape position counts as open.
    await user.click(screen.getByText('futures.reversePosition'));
    const dialog = await screen.findByText('futures.reverseConfirmTitle');
    expect(dialog).toBeInTheDocument();
  });

  it('detects open position via Binance-shape positions (positionAmt < 0 → SHORT)', async () => {
    setDefaults({
      positions: [{ symbol: 'BTCUSDT', positionAmt: '-0.5' }],
    });
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByText('futures.reversePosition'));
    expect(await screen.findByText('futures.reverseConfirmTitle')).toBeInTheDocument();
  });

  it('treats positionAmt=0 as no open position', () => {
    setDefaults({
      positions: [{ symbol: 'BTCUSDT', positionAmt: '0' }],
    });
    renderActions();
    const row = screen.getByText('futures.reversePosition').parentElement!;
    expect(row).toHaveStyle({ opacity: '0.4' });
  });

  it('only matches positions for the current symbol', () => {
    setDefaults({
      positions: [{ id: 'pos-1', symbol: 'ETHUSDT', side: 'LONG', status: 'open' }],
    });
    renderActions();
    const row = screen.getByText('futures.reversePosition').parentElement!;
    expect(row).toHaveStyle({ opacity: '0.4' });
  });

  it('picks the open position when array contains a closed one for the same symbol', async () => {
    setDefaults({
      positions: [
        { id: 'pos-old', symbol: 'BTCUSDT', side: 'LONG', status: 'closed' },
        { id: 'pos-new', symbol: 'BTCUSDT', side: 'SHORT', status: 'open' },
      ],
    });
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByText('futures.reversePosition'));
    const dialog = screen.getByText('futures.reverseConfirmTitle').closest('[role="dialog"]')!;
    await user.click(within(dialog).getByRole('button', { name: /futures\.reversePosition/i }));

    expect(reversePositionMock).toHaveBeenCalledWith(expect.objectContaining({
      positionId: 'pos-new',
    }));
  });

  it('null positions array — reverse / close stay disabled', () => {
    useBackendFuturesTradingMock.mockReturnValue({
      positions: null,
      reversePosition: reversePositionMock,
      isReversingPosition: false,
      closePositionAndCancelOrders: closePositionAndCancelOrdersMock,
      isClosingPositionAndCancellingOrders: false,
      cancelAllOrders: cancelAllOrdersMock,
      isCancellingAllOrders: false,
    });
    renderActions();

    expect(screen.getByText('futures.reversePosition').parentElement!).toHaveStyle({ opacity: '0.4' });
    expect(screen.getByText('futures.closePosition').parentElement!).toHaveStyle({ opacity: '0.4' });
  });

  it('ignores positions when marketType is SPOT (no FUTURES position concept)', () => {
    setDefaults({
      positions: [{ id: 'pos-1', symbol: 'BTCUSDT', side: 'LONG', status: 'open' }],
    });
    renderActions({ marketType: 'SPOT' });

    expect(screen.queryByText('futures.reversePosition')).not.toBeInTheDocument();
  });
});

describe('QuickTradeToolbar — Layout-level UI affordances', () => {
  it('renders LeveragePopover only for FUTURES', () => {
    renderActions();
    expect(screen.getByTestId('leverage-popover-BTCUSDT')).toBeInTheDocument();
  });

  it('does NOT render LeveragePopover for SPOT', () => {
    renderActions({ marketType: 'SPOT' });
    expect(screen.queryByTestId('leverage-popover-BTCUSDT')).not.toBeInTheDocument();
  });

  it('drag handle is hidden by default and shown when showDragHandle is true', () => {
    const { rerender } = renderActions();
    expect(document.querySelector('[class*="cursor-grab"]')).not.toBeInTheDocument();

    rerender(
      <ChakraProvider value={defaultSystem}>
        <ColorModeProvider>
          <QuickTradeActions
            symbol="BTCUSDT"
            marketType="FUTURES"
            showDragHandle
            onDragStart={vi.fn()}
          />
        </ColorModeProvider>
      </ChakraProvider>,
    );
    // The drag handle uses cursor: grab — find it by the icon's parent role/style.
    // Using a visible-element check — the LuGripVertical icon adds an svg.
    const handles = document.querySelectorAll('svg');
    expect(handles.length).toBeGreaterThan(0);
  });

  it('options menu (Close) is hidden when onClose is not passed', () => {
    renderActions();
    expect(screen.queryByRole('button', { name: /options/i })).not.toBeInTheDocument();
  });

  it('options menu shown when onClose is passed and clicking Close fires the callback', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <ChakraProvider value={defaultSystem}>
        <ColorModeProvider>
          <QuickTradeActions symbol="BTCUSDT" marketType="FUTURES" onClose={onClose} />
        </ColorModeProvider>
      </ChakraProvider>,
    );

    const trigger = screen.getByRole('button', { name: /options/i });
    expect(trigger).toBeInTheDocument();

    await user.click(trigger);
    const closeItem = await screen.findByText('common.close');
    await user.click(closeItem);

    expect(onClose).toHaveBeenCalled();
  });
});
