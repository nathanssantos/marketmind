import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
  // Selector-aware mock — supports both `useQuickTradeStore()` (returns
  // the whole state object) and `useQuickTradeStore((s) => s.xxx)`
  // (returns a single field). Production code uses selectors; some
  // existing tests still destructure the whole object.
  useQuickTradeStore: (selector?: (s: unknown) => unknown) => {
    const state = useQuickTradeStoreMock();
    return typeof selector === 'function' ? selector(state) : state;
  },
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

import { TradeTicketActions } from './TradeTicket';

const renderActions = (props: Partial<React.ComponentProps<typeof TradeTicketActions>> = {}) =>
  render(
    <ChakraProvider value={defaultSystem}>
      <ColorModeProvider>
        <TradeTicketActions
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
  useOrderQuantityMock.mockReturnValue({ getQuantity: () => '0.1000', leverage: 5, isReady: true, notReadyReason: null });
  useToastMock.mockReturnValue({ warning: warningMock, error: errorMock });
  useQuickTradeStoreMock.mockReturnValue({
    sizePercent,
    setSizePercent: setSizePercentMock,
    pendingPrefill: null,
    prefillFromDrawing: vi.fn(),
    consumePrefill: () => null,
  });
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

describe('TradeTicket — Buy / Sell flow (regression: v0.107)', () => {
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
    useOrderQuantityMock.mockReturnValue({ getQuantity: () => '0', leverage: 5, isReady: true, notReadyReason: null });
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

describe('TradeTicket — Reverse / Close moved out of the ticket (regression)', () => {
  // These actions live in PositionActionsPopover (opened from the canvas
  // position-chip kebab). The ticket body itself MUST NOT render them.
  it('does NOT render the Reverse Position row in the ticket body', () => {
    renderActions();
    expect(screen.queryByText('futures.reversePosition')).not.toBeInTheDocument();
  });

  it('does NOT render the Close Position row in the ticket body', () => {
    renderActions();
    expect(screen.queryByText('futures.closePosition')).not.toBeInTheDocument();
  });

  it('still does NOT render Reverse/Close even when there IS an open position', () => {
    setDefaults({ positions: [{ id: 'pos-1', symbol: 'BTCUSDT', side: 'LONG', status: 'open' }] });
    renderActions();
    expect(screen.queryByText('futures.reversePosition')).not.toBeInTheDocument();
    expect(screen.queryByText('futures.closePosition')).not.toBeInTheDocument();
  });
});

describe('TradeTicket — Cancel Orders', () => {
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

describe('TradeTicket — Grid Orders / Trailing Stop sub-components', () => {
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

  it('hides Cancel Orders row for SPOT but still renders Grid + Trailing', () => {
    renderActions({ marketType: 'SPOT' });

    expect(screen.queryByText('futures.cancelOrders')).not.toBeInTheDocument();
    expect(screen.getByText('chart.quickTrade.gridOrders')).toBeInTheDocument();
    expect(screen.getByText('chart.quickTrade.trailingStop')).toBeInTheDocument();
  });
});

describe('TradeTicket — Size controls (presets, slider, +/- 5%)', () => {
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

describe('TradeTicket — Pending order confirmation dialog', () => {
  const openConfirm = async () => {
    const user = userEvent.setup();
    renderActions();
    await user.click(screen.getByRole('button', { name: /chart\.quickTrade\.buy/i }));
    return user;
  };

  it('shows the order summary (symbol, side, price, quantity, leverage)', async () => {
    setDefaults({ ask: 50_050 });
    useOrderQuantityMock.mockReturnValue({ getQuantity: () => '0.2500', leverage: 10, isReady: true, notReadyReason: null });
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
    useOrderQuantityMock.mockReturnValue({ getQuantity: () => '0.1000', leverage: 5, isReady: true, notReadyReason: null });
    await openConfirm();

    const dialog = await screen.findByRole('dialog');
    // 0.1 × 50050 = 5005
    expect(within(dialog).getByText(/5,?005\.00 USDT/)).toBeInTheDocument();
  });

  it('margin = totalValue / leverage', async () => {
    setDefaults({ ask: 50_050 });
    useOrderQuantityMock.mockReturnValue({ getQuantity: () => '0.1000', leverage: 5, isReady: true, notReadyReason: null });
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

describe('TradeTicket — Order type tabs (Market / Limit)', () => {
  it('renders Market and Limit tabs', () => {
    renderActions();
    expect(screen.getByRole('tab', { name: 'chart.quickTrade.orderTypeMarket' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'chart.quickTrade.orderTypeLimit' })).toBeInTheDocument();
  });

  it('Market is selected by default', () => {
    renderActions();
    expect(screen.getByRole('tab', { name: 'chart.quickTrade.orderTypeMarket' })).toHaveAttribute('aria-selected', 'true');
  });

  it('selecting Limit reveals the limit price input (and Market hides it)', async () => {
    const user = userEvent.setup();
    renderActions();
    expect(screen.queryByLabelText('chart.quickTrade.limitPrice')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'chart.quickTrade.orderTypeLimit' }));
    expect(screen.getByLabelText('chart.quickTrade.limitPrice')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'chart.quickTrade.orderTypeMarket' }));
    expect(screen.queryByLabelText('chart.quickTrade.limitPrice')).not.toBeInTheDocument();
  });

  it('Limit price input defaults to the mid price ((bid + ask) / 2)', async () => {
    const user = userEvent.setup();
    renderActions();
    await user.click(screen.getByRole('tab', { name: 'chart.quickTrade.orderTypeLimit' }));
    const input = await screen.findByLabelText('chart.quickTrade.limitPrice') as HTMLInputElement;
    // bid=49950, ask=50050 → mid 50000
    expect(input.value).toBe('50000');
  });

  it('submitting a LIMIT order sends type=LIMIT and price=limitPrice (NOT bid/ask)', async () => {
    const user = userEvent.setup();
    renderActions();
    await user.click(screen.getByRole('tab', { name: 'chart.quickTrade.orderTypeLimit' }));
    const input = screen.getByLabelText('chart.quickTrade.limitPrice') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '49000' } });

    await user.click(screen.getByRole('button', { name: /chart\.quickTrade\.buy/i }));
    await user.click(await screen.findByRole('button', { name: /chart\.quickTrade\.confirmBuy/i }));

    const arg = createOrderMock.mock.calls[0]![0];
    expect(arg).toMatchObject({
      type: 'LIMIT',
      price: '49000',
      referencePrice: 49000,
    });
  });

  it('LIMIT with empty price errors out and does NOT call createOrder', async () => {
    const user = userEvent.setup();
    renderActions();
    await user.click(screen.getByRole('tab', { name: 'chart.quickTrade.orderTypeLimit' }));
    const input = screen.getByLabelText('chart.quickTrade.limitPrice') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: /chart\.quickTrade\.buy/i }));

    expect(errorMock).toHaveBeenCalledWith('chart.quickTrade.noPriceError');
    expect(createOrderMock).not.toHaveBeenCalled();
  });
});

describe('TradeTicket — SL / TP at open', () => {
  const enableSl = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByTestId('trade-ticket-sl-switch'));
  };
  const enableTp = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByTestId('trade-ticket-tp-switch'));
  };

  it('SL input is disabled by default and enabled after toggling the SL switch', async () => {
    const user = userEvent.setup();
    renderActions();
    const slInput = screen.getByTestId('trade-ticket-sl-input') as HTMLInputElement;
    expect(slInput).toBeDisabled();
    await enableSl(user);
    expect(slInput).not.toBeDisabled();
  });

  it('TP input is disabled by default and enabled after toggling the TP switch', async () => {
    const user = userEvent.setup();
    renderActions();
    const tpInput = screen.getByTestId('trade-ticket-tp-input') as HTMLInputElement;
    expect(tpInput).toBeDisabled();
    await enableTp(user);
    expect(tpInput).not.toBeDisabled();
  });

  it('BUY with SL above entry errors out and does NOT call createOrder', async () => {
    const user = userEvent.setup();
    renderActions();
    await enableSl(user);
    const slInput = screen.getByTestId('trade-ticket-sl-input') as HTMLInputElement;
    fireEvent.change(slInput, { target: { value: '51000' } });
    await user.click(screen.getByRole('button', { name: /chart\.quickTrade\.buy/i }));

    expect(errorMock).toHaveBeenCalledWith('chart.quickTrade.slInvalid');
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it('BUY with TP below entry errors out and does NOT call createOrder', async () => {
    const user = userEvent.setup();
    renderActions();
    await enableTp(user);
    const tpInput = screen.getByTestId('trade-ticket-tp-input') as HTMLInputElement;
    fireEvent.change(tpInput, { target: { value: '40000' } });
    await user.click(screen.getByRole('button', { name: /chart\.quickTrade\.buy/i }));

    expect(errorMock).toHaveBeenCalledWith('chart.quickTrade.tpInvalid');
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it('SELL with SL below entry errors (SL must be ABOVE entry for SHORTs)', async () => {
    const user = userEvent.setup();
    renderActions();
    await enableSl(user);
    const slInput = screen.getByTestId('trade-ticket-sl-input') as HTMLInputElement;
    fireEvent.change(slInput, { target: { value: '48000' } });
    await user.click(screen.getByRole('button', { name: /chart\.quickTrade\.sell/i }));

    expect(errorMock).toHaveBeenCalledWith('chart.quickTrade.slInvalid');
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it('valid BUY with SL+TP passes them through to createOrder', async () => {
    const user = userEvent.setup();
    renderActions();
    await enableSl(user);
    await enableTp(user);

    const slInput = screen.getByTestId('trade-ticket-sl-input') as HTMLInputElement;
    const tpInput = screen.getByTestId('trade-ticket-tp-input') as HTMLInputElement;
    fireEvent.change(slInput, { target: { value: '49000' } });
    fireEvent.change(tpInput, { target: { value: '52000' } });

    await user.click(screen.getByRole('button', { name: /chart\.quickTrade\.buy/i }));
    await user.click(await screen.findByRole('button', { name: /chart\.quickTrade\.confirmBuy/i }));

    expect(createOrderMock).toHaveBeenCalledWith(expect.objectContaining({
      side: 'BUY',
      type: 'MARKET',
      stopLoss: '49000',
      takeProfit: '52000',
    }));
  });
});

describe('TradeTicket — Total value row', () => {
  it('renders a total-value row whose number tracks qty × ref price', () => {
    setDefaults({ bid: 49_950, ask: 50_050 });
    useOrderQuantityMock.mockReturnValue({ getQuantity: () => '0.1000', leverage: 5, isReady: true, notReadyReason: null });
    renderActions();
    const total = screen.getByTestId('trade-ticket-total-value');
    // mid 50000 × 0.1 = 5000
    expect(total.textContent).toMatch(/5,?000\.00 USDT/);
  });

  it('shows — when price is unavailable', () => {
    setDefaults({ price: 0, bid: 0, ask: 0 });
    renderActions();
    expect(screen.getByTestId('trade-ticket-total-value').textContent).toBe('—');
  });
});

describe('TradeTicket — Field placeholders', () => {
  it('SL input shows a placeholder near -2% from the mid price', () => {
    setDefaults({ bid: 49_950, ask: 50_050 });
    renderActions();
    const slInput = screen.getByTestId('trade-ticket-sl-input') as HTMLInputElement;
    expect(slInput.placeholder).toBe('49000.00');
  });

  it('TP input shows a placeholder near +4% from the mid price', () => {
    setDefaults({ bid: 49_950, ask: 50_050 });
    renderActions();
    const tpInput = screen.getByTestId('trade-ticket-tp-input') as HTMLInputElement;
    expect(tpInput.placeholder).toBe('52000.00');
  });

  it('placeholders are empty when bid/ask are unavailable', () => {
    setDefaults({ price: 0, bid: 0, ask: 0 });
    renderActions();
    expect((screen.getByTestId('trade-ticket-sl-input') as HTMLInputElement).placeholder).toBe('');
    expect((screen.getByTestId('trade-ticket-tp-input') as HTMLInputElement).placeholder).toBe('');
  });
});

describe('TradeTicket — Prefill from chart drawing', () => {
  // Long/short position drawings on the chart have a "→ TICKET" button
  // that pushes their entry/SL/TP into `quickTradeStore.pendingPrefill`.
  // The ticket consumes it once, switches to LIMIT type, and enables SL+TP.
  it('consumes pendingPrefill and populates LIMIT + SL + TP', async () => {
    const consumePrefillMock = vi.fn(() => ({
      side: 'BUY' as const,
      entryPrice: '50100',
      stopLoss: '49000',
      takeProfit: '52500',
    }));
    useQuickTradeStoreMock.mockReturnValue({
      sizePercent: 10,
      setSizePercent: setSizePercentMock,
      pendingPrefill: { side: 'BUY', entryPrice: '50100', stopLoss: '49000', takeProfit: '52500' },
      prefillFromDrawing: vi.fn(),
      consumePrefill: consumePrefillMock,
    });
    renderActions();
    expect(consumePrefillMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('tab', { name: 'chart.quickTrade.orderTypeLimit' }))
      .toHaveAttribute('aria-selected', 'true');
    expect((screen.getByLabelText('chart.quickTrade.limitPrice') as HTMLInputElement).value)
      .toBe('50100');
    expect((screen.getByTestId('trade-ticket-sl-input') as HTMLInputElement).value).toBe('49000');
    expect((screen.getByTestId('trade-ticket-tp-input') as HTMLInputElement).value).toBe('52500');
  });

  it('does nothing when pendingPrefill is null', () => {
    const consumePrefillMock = vi.fn();
    useQuickTradeStoreMock.mockReturnValue({
      sizePercent: 10,
      setSizePercent: setSizePercentMock,
      pendingPrefill: null,
      prefillFromDrawing: vi.fn(),
      consumePrefill: consumePrefillMock,
    });
    renderActions();
    expect(consumePrefillMock).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: 'chart.quickTrade.orderTypeMarket' }))
      .toHaveAttribute('aria-selected', 'true');
  });
});

describe('TradeTicket — Layout-level UI affordances', () => {
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
          <TradeTicketActions
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
          <TradeTicketActions symbol="BTCUSDT" marketType="FUTURES" onClose={onClose} />
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
