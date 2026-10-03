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
const useSymbolOpenPositionMock = vi.fn();
const useWalletFeesMock = vi.fn();
const marketStatusQueryMock = vi.fn();
const shortabilityQueryMock = vi.fn();
const commissionQueryMock = vi.fn();

const cancelAllOrdersMock = vi.fn();
const createOrderMock = vi.fn();
const setSizePercentMock = vi.fn();
const warningMock = vi.fn();
const errorMock = vi.fn();

const tradingPrefs = new Map<string, unknown>();
vi.mock('@renderer/store/preferencesStore', async () => {
  const React = await import('react');
  const usePref = <T,>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] => {
    const [value, setValue] = React.useState<T>((tradingPrefs.has(key) ? tradingPrefs.get(key) : initialValue) as T);
    const update = React.useCallback((next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const computed = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next;
        tradingPrefs.set(key, computed);
        return computed;
      });
    }, [key]);
    return [value, update];
  };
  return { useTradingPref: usePref, useUIPref: usePref, useChartPref: usePref };
});
vi.mock('@renderer/hooks/useActiveWallet', () => ({ useActiveWallet: () => useActiveWalletMock() }));
vi.mock('@renderer/hooks/useBookTicker', () => ({ useBookTicker: (symbol: string) => useBookTickerMock(symbol) }));
vi.mock('@renderer/hooks/useBackendFuturesTrading', () => ({ useBackendFuturesTrading: (walletId: string) => useBackendFuturesTradingMock(walletId) }));
vi.mock('@renderer/hooks/useBackendTradingMutations', () => ({ useBackendTradingMutations: () => useBackendTradingMutationsMock() }));
vi.mock('@renderer/hooks/useOrderQuantity', () => ({ useOrderQuantity: (...args: unknown[]) => useOrderQuantityMock(...args) }));
vi.mock('@renderer/hooks/useLeverageBrackets', () => ({ useLeverageBrackets: () => undefined }));
vi.mock('@renderer/hooks/useSymbolOpenPosition', () => ({ useSymbolOpenPosition: (...args: unknown[]) => useSymbolOpenPositionMock(...args) }));
vi.mock('@renderer/hooks/useWalletFees', () => ({ useWalletFees: (...args: unknown[]) => useWalletFeesMock(...args) }));
vi.mock('@renderer/hooks/useTradingMarketType', () => ({ useTradingMarketType: (chart: string | undefined) => chart ?? 'FUTURES' }));
vi.mock('@renderer/hooks/useToast', () => ({ useToast: () => useToastMock() }));
vi.mock('@renderer/store/quickTradeStore', () => ({
  useQuickTradeStore: (selector?: (s: unknown) => unknown) => {
    const state = useQuickTradeStoreMock();
    return typeof selector === 'function' ? selector(state) : state;
  },
}));
vi.mock('@renderer/store/priceStore', () => ({ usePricesForSymbols: (symbols: string[]) => usePricesForSymbolsMock(symbols) }));
vi.mock('@renderer/utils/canvas/perfMonitor', () => ({ perfMonitor: { isEnabled: () => false, recordComponentRender: vi.fn() } }));
vi.mock('@renderer/utils/trpc', () => ({
  trpc: {
    useUtils: () => ({}),
    auth: { me: { useQuery: () => ({ data: { id: 'test-user' }, isLoading: false, error: null }) } },
    preferences: {
      getByCategory: { useQuery: () => ({ data: {}, isLoading: false, isSuccess: true, error: null }) },
      set: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) },
    },
    stocks: {
      marketStatus: { useQuery: (...args: unknown[]) => marketStatusQueryMock(...args) },
      shortability: { useQuery: (...args: unknown[]) => shortabilityQueryMock(...args) },
      commissionEstimate: { useQuery: (...args: unknown[]) => commissionQueryMock(...args) },
    },
  },
}));
vi.mock('./GridOrderPopover', () => ({
  GridOrderPopover: ({ triggerElement }: { triggerElement?: React.ReactNode }) => <div data-testid="grid-popover">{triggerElement}</div>,
}));
vi.mock('./TrailingStopPopover', () => ({
  TrailingStopPopover: ({ symbol, triggerElement }: { symbol: string; triggerElement?: React.ReactNode }) => <div data-testid={`trailing-popover-${symbol}`}>{triggerElement}</div>,
}));
vi.mock('./LeveragePopover', () => ({
  LeveragePopover: ({ symbol }: { symbol: string }) => <div data-testid={`leverage-popover-${symbol}`} />,
}));

import { TradeTicketActions } from './TradeTicket';

type Wallet = { id: string; currentBalance: string; walletType: 'paper' | 'live' | 'testnet'; exchange: 'BINANCE' | 'INTERACTIVE_BROKERS'; currency: string; marketType: 'SPOT' | 'FUTURES' };

const PAPER_FUTURES_WALLET: Wallet = { id: 'w1', currentBalance: '10000', walletType: 'paper', exchange: 'BINANCE', currency: 'USDT', marketType: 'FUTURES' };
const LIVE_FUTURES_WALLET: Wallet = { ...PAPER_FUTURES_WALLET, walletType: 'live' };
const PAPER_SPOT_WALLET: Wallet = { ...PAPER_FUTURES_WALLET, marketType: 'SPOT' };
const IB_WALLET: Wallet = { id: 'w2', currentBalance: '10000', walletType: 'testnet', exchange: 'INTERACTIVE_BROKERS', currency: 'USD', marketType: 'SPOT' };
const OPEN_SESSION = { isOpen: true, sessionType: 'REGULAR', nextOpen: null, nextClose: '2026-10-03T20:00:00.000Z', isHoliday: false, isEarlyClose: false, earlyCloseTime: null, timezone: 'America/New_York' };
const CLOSED_SESSION = { ...OPEN_SESSION, isOpen: false, sessionType: 'CLOSED', nextOpen: '2026-10-06T13:30:00.000Z', nextClose: null };

const renderTicket = (props: Partial<React.ComponentProps<typeof TradeTicketActions>> = {}) =>
  render(
    <ChakraProvider value={defaultSystem}>
      <ColorModeProvider>
        <TradeTicketActions symbol="BTCUSDT" marketType="FUTURES" {...props} />
      </ColorModeProvider>
    </ChakraProvider>,
  );

interface Defaults {
  wallet?: Wallet | null;
  sizePercent?: number;
  price?: number;
  bid?: number;
  ask?: number;
  quantity?: string;
  openPosition?: { side: 'LONG' | 'SHORT'; quantity: number } | null;
  isReady?: boolean;
  notReadyReason?: string | null;
  minNotional?: number;
  prefill?: { side: 'BUY' | 'SELL'; entryPrice: string; stopLoss: string; takeProfit: string } | null;
  marketStatus?: typeof OPEN_SESSION | undefined;
  shortability?: unknown;
}

const setDefaults = (overrides: Defaults = {}) => {
  const {
    wallet = PAPER_FUTURES_WALLET, sizePercent = 10, price = 50_000, bid = 49_950, ask = 50_050, quantity = '0.1000',
    openPosition = null, isReady = true, notReadyReason = null, minNotional = 5, prefill = null, marketStatus, shortability,
  } = overrides;

  useActiveWalletMock.mockReturnValue({ activeWallet: wallet, exchangeId: wallet?.exchange ?? 'BINANCE', isIB: wallet?.exchange === 'INTERACTIVE_BROKERS' });
  useBookTickerMock.mockReturnValue({ bidPrice: bid, askPrice: ask });
  useBackendFuturesTradingMock.mockReturnValue({ cancelAllOrders: cancelAllOrdersMock, isCancellingAllOrders: false });
  useBackendTradingMutationsMock.mockReturnValue({ createOrder: createOrderMock, isCreatingOrder: false });
  useOrderQuantityMock.mockReturnValue({ getQuantity: () => quantity, leverage: 5, balance: parseFloat(wallet?.currentBalance ?? '0'), isReady, notReadyReason, tickSize: 0.1, stepSize: 0.001, minNotional, sizePercent });
  useSymbolOpenPositionMock.mockReturnValue(openPosition);
  useWalletFeesMock.mockReturnValue({ maker: 0.0002, taker: 0.0005, vipLevel: 0, hasBnbDiscount: false, isLoaded: true });
  useToastMock.mockReturnValue({ warning: warningMock, error: errorMock });
  useQuickTradeStoreMock.mockReturnValue({
    sizePercent,
    setSizePercent: setSizePercentMock,
    pendingPrefill: prefill,
    prefillFromDrawing: vi.fn(),
    consumePrefill: () => prefill,
  });
  usePricesForSymbolsMock.mockReturnValue({ BTCUSDT: price, AAPL: price });
  marketStatusQueryMock.mockReturnValue({ data: marketStatus });
  shortabilityQueryMock.mockReturnValue({ data: shortability });
  commissionQueryMock.mockReturnValue({ data: { commission: 1, perShareRate: 0.005, tier: 'TIER_1', shares: 1, tradeValue: 1, effectiveRate: 0.001 } });
  createOrderMock.mockResolvedValue({ orderId: '1', openExecutions: [] });
};

const submit = () => screen.getByTestId('trade-ticket-submit');
const sideButton = (side: 'buy' | 'sell') => screen.getByTestId(`trade-ticket-side-${side}`);
const enableProtection = async (user: ReturnType<typeof userEvent.setup>, sl: string, tp: string) => {
  await user.click(screen.getByTestId('trade-ticket-sl-switch'));
  await user.click(screen.getByTestId('trade-ticket-tp-switch'));
  fireEvent.change(screen.getByTestId('trade-ticket-sl-input'), { target: { value: sl } });
  fireEvent.change(screen.getByTestId('trade-ticket-tp-input'), { target: { value: tp } });
};
const confirmDialog = async () => screen.findByRole('dialog');

beforeEach(() => {
  vi.clearAllMocks();
  tradingPrefs.clear();
  setDefaults();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TradeTicket — side selector and action button', () => {
  it('starts on Buy and shows the open-order label with quantity and price', () => {
    renderTicket();

    expect(sideButton('buy')).toHaveAttribute('aria-checked', 'true');
    expect(submit()).toHaveTextContent('chart.quickTrade.action.open');
    expect(submit()).toBeEnabled();
  });

  it('switching to Sell sends a SELL order after confirmation', async () => {
    const user = userEvent.setup();
    renderTicket();

    await user.click(sideButton('sell'));
    await user.click(submit());
    const dialog = await confirmDialog();
    expect(within(dialog).getByText('SHORT')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /confirmSell/ }));

    expect(createOrderMock).toHaveBeenCalledWith(expect.objectContaining({ side: 'SELL', type: 'MARKET', quantity: '0.1000', referencePrice: 49_950, marketType: 'FUTURES' }));
  });

  it('labels the button Close when the order flattens the opposite position', () => {
    setDefaults({ openPosition: { side: 'LONG', quantity: 0.1 } });
    renderTicket();

    fireEvent.click(sideButton('sell'));

    expect(submit()).toHaveTextContent('chart.quickTrade.action.close');
    expect(screen.getByText('chart.quickTrade.reduceNote')).toBeInTheDocument();
  });

  it('closes with the exact position quantity when the sized quantity is within 1% of it', async () => {
    setDefaults({ openPosition: { side: 'LONG', quantity: 0.101 }, quantity: '0.100' });
    const user = userEvent.setup();
    renderTicket();

    fireEvent.click(sideButton('sell'));
    expect(submit()).toHaveTextContent('chart.quickTrade.action.close');
    await user.click(submit());
    await user.click(within(await confirmDialog()).getByRole('button', { name: /confirmSell/ }));

    expect(createOrderMock).toHaveBeenCalledWith(expect.objectContaining({ side: 'SELL', quantity: '0.101' }));
  });

  it('labels the button Reduce when the order is smaller than the opposite position', () => {
    setDefaults({ openPosition: { side: 'LONG', quantity: 0.5 } });
    renderTicket();

    fireEvent.click(sideButton('sell'));

    expect(submit()).toHaveTextContent('chart.quickTrade.action.reduce');
  });

  it('labels the button Reverse when the order is larger than the opposite position', () => {
    setDefaults({ openPosition: { side: 'LONG', quantity: 0.04 } });
    renderTicket();

    fireEvent.click(sideButton('sell'));

    expect(submit()).toHaveTextContent('chart.quickTrade.action.reverse');
  });

  it('shows a PAPER badge on paper wallets and LIVE on live wallets', () => {
    const { unmount } = renderTicket();
    expect(submit()).toHaveTextContent('chart.quickTrade.paper');
    unmount();

    setDefaults({ wallet: LIVE_FUTURES_WALLET });
    renderTicket();
    expect(submit()).toHaveTextContent('chart.quickTrade.live');
  });

  it('disables the button and shows the reason when sizing is not ready', () => {
    setDefaults({ isReady: false, notReadyReason: 'Loading leverage…' });
    renderTicket();

    expect(submit()).toBeDisabled();
    expect(screen.getByTestId('trade-ticket-disabled-reason')).toHaveTextContent('Loading leverage…');
  });

  it('explains that the size is below the symbol step when the quantity rounds to zero', () => {
    setDefaults({ quantity: '0.000' });
    renderTicket();

    expect(submit()).toBeDisabled();
    expect(screen.getByTestId('trade-ticket-disabled-reason')).toHaveTextContent('chart.quickTrade.reason.sizeBelowStep');
  });

  it('disables the button when the order is below the minimum notional', () => {
    setDefaults({ quantity: '0.00001', minNotional: 5 });
    renderTicket();

    expect(submit()).toBeDisabled();
    expect(screen.getByTestId('trade-ticket-disabled-reason')).toHaveTextContent('chart.quickTrade.reason.belowMinNotional');
  });

  it('warns and does not open the confirmation without a wallet', async () => {
    setDefaults({ wallet: null });
    const user = userEvent.setup();
    renderTicket();

    expect(submit()).toBeDisabled();
    await user.click(submit());
    expect(createOrderMock).not.toHaveBeenCalled();
  });
});

describe('TradeTicket — order type', () => {
  it('shows Stop instead of Limit when the limit price crosses the market', async () => {
    const user = userEvent.setup();
    renderTicket();

    await user.click(screen.getByRole('tab', { name: 'chart.quickTrade.orderTypeLimit' }));
    fireEvent.change(screen.getByLabelText('chart.quickTrade.limitPrice'), { target: { value: '51000' } });

    expect(screen.getByRole('tab', { name: 'chart.quickTrade.orderTypeStop' })).toBeInTheDocument();
    await user.click(submit());
    const dialog = await confirmDialog();
    expect(within(dialog).getByText('chart.quickTrade.orderTypeStop')).toBeInTheDocument();
  });

  it('keeps Limit when the limit price rests away from the market and sends type LIMIT with the price', async () => {
    const user = userEvent.setup();
    renderTicket();

    await user.click(screen.getByRole('tab', { name: 'chart.quickTrade.orderTypeLimit' }));
    fireEvent.change(screen.getByLabelText('chart.quickTrade.limitPrice'), { target: { value: '49000' } });
    await user.click(submit());
    await user.click(within(await confirmDialog()).getByRole('button', { name: /confirmBuy/ }));

    expect(createOrderMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'LIMIT', price: '49000', referencePrice: 49_000 }));
  });

  it('the Mid button resets the limit price to the book mid', async () => {
    const user = userEvent.setup();
    renderTicket();

    await user.click(screen.getByRole('tab', { name: 'chart.quickTrade.orderTypeLimit' }));
    fireEvent.change(screen.getByLabelText('chart.quickTrade.limitPrice'), { target: { value: '1' } });
    await user.click(screen.getByRole('button', { name: 'chart.quickTrade.mid' }));

    expect((screen.getByLabelText('chart.quickTrade.limitPrice') as HTMLInputElement).value).toBe('50000');
  });

  it('arrow keys move the limit price by one tick', async () => {
    const user = userEvent.setup();
    renderTicket();

    await user.click(screen.getByRole('tab', { name: 'chart.quickTrade.orderTypeLimit' }));
    const input = screen.getByLabelText('chart.quickTrade.limitPrice') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(parseFloat(input.value)).toBeCloseTo(50_000.1, 6);
  });
});

describe('TradeTicket — SL and TP', () => {
  it('typing a price fills the percent and typing a percent fills the price', async () => {
    const user = userEvent.setup();
    renderTicket();

    await user.click(screen.getByTestId('trade-ticket-sl-switch'));
    fireEvent.change(screen.getByTestId('trade-ticket-sl-input'), { target: { value: '49048' } });
    expect((screen.getByTestId('trade-ticket-sl-percent') as HTMLInputElement).value).toBe('-2.00');

    await user.click(screen.getByTestId('trade-ticket-tp-switch'));
    fireEvent.change(screen.getByTestId('trade-ticket-tp-percent'), { target: { value: '3' } });
    expect(parseFloat((screen.getByTestId('trade-ticket-tp-input') as HTMLInputElement).value)).toBeCloseTo(50_050 * 1.03, 0);
  });

  it('blocks a Buy whose SL sits above the entry and shows the reason', async () => {
    const user = userEvent.setup();
    renderTicket();

    await user.click(screen.getByTestId('trade-ticket-sl-switch'));
    fireEvent.change(screen.getByTestId('trade-ticket-sl-input'), { target: { value: '51000' } });

    expect(submit()).toBeDisabled();
    expect(screen.getByTestId('trade-ticket-disabled-reason')).toHaveTextContent('chart.quickTrade.slInvalid');
  });

  it('sends SL, TP and OCO by default and shows risk and R:R', async () => {
    const user = userEvent.setup();
    renderTicket();
    await enableProtection(user, '49000', '52000');

    expect(screen.getByText('chart.quickTrade.risk')).toBeInTheDocument();
    expect(screen.getByText('chart.quickTrade.riskReward')).toBeInTheDocument();
    await user.click(submit());
    const dialog = await confirmDialog();
    expect(within(dialog).getByText('chart.quickTrade.protectionOco')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /confirmBuy/ }));

    expect(createOrderMock).toHaveBeenCalledWith(expect.objectContaining({ stopLoss: '49000', takeProfit: '52000', protectionMode: 'OCO' }));
  });

  it('sends INDEPENDENT when the OCO switch is off', async () => {
    const user = userEvent.setup();
    renderTicket();
    await enableProtection(user, '49000', '52000');
    await user.click(screen.getByTestId('trade-ticket-oco-switch'));
    await user.click(submit());
    await user.click(within(await confirmDialog()).getByRole('button', { name: /confirmBuy/ }));

    expect(createOrderMock).toHaveBeenCalledWith(expect.objectContaining({ protectionMode: 'INDEPENDENT' }));
  });

  it('keeps the OCO switch disabled until both SL and TP are on', async () => {
    const user = userEvent.setup();
    renderTicket();
    const ocoInput = () => screen.getByTestId('trade-ticket-oco-switch').querySelector('input');

    expect(ocoInput()).toBeDisabled();
    await user.click(screen.getByTestId('trade-ticket-sl-switch'));
    expect(ocoInput()).toBeDisabled();
    await user.click(screen.getByTestId('trade-ticket-tp-switch'));
    expect(ocoInput()).toBeEnabled();
  });

  it('drops SL and TP from an order that reduces the opposite position', async () => {
    setDefaults({ openPosition: { side: 'LONG', quantity: 0.5 } });
    const user = userEvent.setup();
    renderTicket();
    await enableProtection(user, '49000', '52000');
    fireEvent.click(sideButton('sell'));
    await user.click(submit());
    await user.click(within(await confirmDialog()).getByRole('button', { name: /confirmSell/ }));

    expect(createOrderMock).toHaveBeenCalledWith(expect.not.objectContaining({ stopLoss: expect.anything() }));
    expect(createOrderMock).toHaveBeenCalledWith(expect.not.objectContaining({ protectionMode: expect.anything() }));
  });

  it('toasts each protection error reported after the order', async () => {
    createOrderMock.mockResolvedValueOnce({ orderId: '1', protectionErrors: ['Stop loss was not placed: boom'] });
    const user = userEvent.setup();
    renderTicket();
    await enableProtection(user, '49000', '52000');
    await user.click(submit());
    await user.click(within(await confirmDialog()).getByRole('button', { name: /confirmBuy/ }));

    expect(errorMock).toHaveBeenCalledWith('trading.order.protectionFailed', 'Stop loss was not placed: boom');
  });
});

describe('TradeTicket — confirmation dialog', () => {
  it('shows total, margin, leverage, estimated fee and break-even for futures', async () => {
    const user = userEvent.setup();
    renderTicket();
    await user.click(submit());
    const dialog = await confirmDialog();

    expect(within(dialog).getByText('LONG')).toBeInTheDocument();
    expect(within(dialog).getByText('futures.leverage')).toBeInTheDocument();
    expect(within(dialog).getByText('chart.quickTrade.margin')).toBeInTheDocument();
    expect(within(dialog).getByText('chart.quickTrade.estimatedFee')).toBeInTheDocument();
    expect(within(dialog).getByText('chart.quickTrade.breakeven')).toBeInTheDocument();
    expect(within(dialog).getByText(/5005\.00 USDT/)).toBeInTheDocument();
  });

  it('closing the dialog does not send the order', async () => {
    const user = userEvent.setup();
    renderTicket();
    await user.click(submit());
    const dialog = await confirmDialog();
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }));

    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it('skips the confirmation for market orders when the preference is on', async () => {
    tradingPrefs.set('ticketSkipMarketConfirm', true);
    const user = userEvent.setup();
    renderTicket();
    await user.click(submit());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(createOrderMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'MARKET' }));
  });
});

describe('TradeTicket — asset type matrix', () => {
  it('spot: hides leverage, margin and liquidation, labels sides Buy and Sell, and disables Sell without holdings', () => {
    setDefaults({ wallet: PAPER_SPOT_WALLET });
    renderTicket({ marketType: 'SPOT' });

    expect(screen.queryByTestId('leverage-popover-BTCUSDT')).not.toBeInTheDocument();
    expect(screen.queryByText('chart.quickTrade.margin')).not.toBeInTheDocument();
    expect(screen.queryByText('chart.quickTrade.liquidation')).not.toBeInTheDocument();
    expect(sideButton('buy')).toHaveTextContent('trading.ticket.buy');
    fireEvent.click(sideButton('sell'));
    expect(submit()).toBeDisabled();
    expect(screen.getByTestId('trade-ticket-disabled-reason')).toHaveTextContent('trading.spot.nothingToSell');
  });

  it('spot: Sell closes the held position', () => {
    setDefaults({ wallet: PAPER_SPOT_WALLET, openPosition: { side: 'LONG', quantity: 0.1 } });
    renderTicket({ marketType: 'SPOT' });

    fireEvent.click(sideButton('sell'));

    expect(submit()).toBeEnabled();
    expect(submit()).toHaveTextContent('chart.quickTrade.action.close');
  });

  it('spot: a Sell larger than the holding is capped to it and closes the position', async () => {
    setDefaults({ wallet: PAPER_SPOT_WALLET, openPosition: { side: 'LONG', quantity: 0.05 }, quantity: '0.100' });
    const user = userEvent.setup();
    renderTicket({ marketType: 'SPOT' });

    fireEvent.click(sideButton('sell'));
    expect(submit()).toHaveTextContent('chart.quickTrade.action.close');
    await user.click(submit());
    await user.click(within(await confirmDialog()).getByRole('button', { name: /confirmSell/ }));

    expect(createOrderMock).toHaveBeenCalledWith(expect.objectContaining({ side: 'SELL', quantity: '0.050', marketType: 'SPOT' }));
  });

  it('futures: shows leverage, margin and liquidation and labels sides Long and Short', () => {
    renderTicket();

    expect(screen.getByTestId('leverage-popover-BTCUSDT')).toBeInTheDocument();
    expect(screen.getByText('chart.quickTrade.margin')).toBeInTheDocument();
    expect(screen.getByText('chart.quickTrade.liquidation')).toBeInTheDocument();
    expect(sideButton('buy')).toHaveTextContent('chart.quickTrade.sideBuyLong');
    expect(screen.getByText('futures.cancelOrders')).toBeInTheDocument();
  });

  it('stocks: shows the market session, hides leverage and uses the IB commission as the fee', async () => {
    setDefaults({ wallet: IB_WALLET, marketStatus: OPEN_SESSION, quantity: '10' });
    const user = userEvent.setup();
    renderTicket({ symbol: 'AAPL', marketType: 'SPOT' });

    expect(screen.getByTestId('trade-ticket-market-session')).toHaveTextContent('marketStatus.open');
    expect(screen.queryByTestId('leverage-popover-AAPL')).not.toBeInTheDocument();
    expect(screen.queryByText('futures.cancelOrders')).not.toBeInTheDocument();
    await user.click(submit());
    const dialog = await confirmDialog();
    expect(within(dialog).getByText(/1\.00 USD/)).toBeInTheDocument();
  });

  it('stocks: market orders are blocked while the session is closed', () => {
    setDefaults({ wallet: IB_WALLET, marketStatus: CLOSED_SESSION, quantity: '10' });
    renderTicket({ symbol: 'AAPL', marketType: 'SPOT' });

    expect(screen.getByTestId('trade-ticket-market-session')).toHaveTextContent('marketStatus.closed');
    expect(submit()).toBeDisabled();
    expect(screen.getByTestId('trade-ticket-disabled-reason')).toHaveTextContent('chart.quickTrade.reason.marketClosed');
  });

  it('stocks: Short is blocked when the symbol is not shortable', () => {
    setDefaults({ wallet: IB_WALLET, marketStatus: OPEN_SESSION, quantity: '10', shortability: { known: true, info: { symbol: 'AAPL', available: false, difficulty: 'unavailable', sharesAvailable: 0 } } });
    renderTicket({ symbol: 'AAPL', marketType: 'SPOT' });

    fireEvent.click(sideButton('sell'));

    expect(submit()).toBeDisabled();
    expect(screen.getByTestId('trade-ticket-disabled-reason')).toHaveTextContent('chart.quickTrade.reason.notShortable');
  });

  it('stocks: Short is allowed when the symbol is shortable', () => {
    setDefaults({ wallet: IB_WALLET, marketStatus: OPEN_SESSION, quantity: '10', shortability: { known: true, info: { symbol: 'AAPL', available: true, difficulty: 'easy', sharesAvailable: 1_000_000 } } });
    renderTicket({ symbol: 'AAPL', marketType: 'SPOT' });

    fireEvent.click(sideButton('sell'));

    expect(submit()).toBeEnabled();
  });
});

describe('TradeTicket — prefill from the position drawing', () => {
  it('selects the side, switches to Limit and fills entry, SL and TP, with a strip that can clear it', async () => {
    setDefaults({ prefill: { side: 'SELL', entryPrice: '50100', stopLoss: '51000', takeProfit: '48000' } });
    const user = userEvent.setup();
    renderTicket();

    expect(sideButton('sell')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('tab', { name: 'chart.quickTrade.orderTypeLimit' })).toHaveAttribute('aria-selected', 'true');
    expect((screen.getByLabelText('chart.quickTrade.limitPrice') as HTMLInputElement).value).toBe('50100');
    expect((screen.getByTestId('trade-ticket-sl-input') as HTMLInputElement).value).toBe('51000');
    expect((screen.getByTestId('trade-ticket-tp-input') as HTMLInputElement).value).toBe('48000');
    expect(screen.getByText('chart.quickTrade.fromDrawing')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'common.clear' }));

    expect(screen.queryByText('chart.quickTrade.fromDrawing')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'chart.quickTrade.orderTypeMarket' })).toHaveAttribute('aria-selected', 'true');
  });

  it('switching side after a prefill clears the drawing strip', () => {
    setDefaults({ prefill: { side: 'BUY', entryPrice: '50100', stopLoss: '49000', takeProfit: '52500' } });
    renderTicket();

    fireEvent.click(sideButton('sell'));

    expect(screen.queryByText('chart.quickTrade.fromDrawing')).not.toBeInTheDocument();
  });
});

describe('TradeTicket — size controls and secondary actions', () => {
  it('presets, slider steps and bounds update the size percent', async () => {
    const user = userEvent.setup();
    renderTicket();

    await user.click(screen.getByRole('button', { name: '50%' }));
    expect(setSizePercentMock).toHaveBeenCalledWith(50);
    await user.click(screen.getByRole('button', { name: 'chart.quickTrade.increaseSize' }));
    expect(setSizePercentMock).toHaveBeenCalledWith(15);
    await user.click(screen.getByRole('button', { name: 'chart.quickTrade.decreaseSize' }));
    expect(setSizePercentMock).toHaveBeenCalledWith(5);
  });

  it('Cancel Orders asks for confirmation and calls cancelAllOrders', async () => {
    const user = userEvent.setup();
    renderTicket();

    await user.click(screen.getByText('futures.cancelOrders'));
    const dialog = await confirmDialog();
    await user.click(within(dialog).getByRole('button', { name: 'futures.cancelOrders' }));

    expect(cancelAllOrdersMock).toHaveBeenCalledWith({ walletId: 'w1', symbol: 'BTCUSDT' });
  });

  it('renders the Grid and Trailing Stop rows', () => {
    renderTicket();

    expect(screen.getByTestId('grid-popover')).toBeInTheDocument();
    expect(screen.getByTestId('trailing-popover-BTCUSDT')).toBeInTheDocument();
  });

  it('shows the options menu only when onClose is passed', async () => {
    const onClose = vi.fn();
    const { unmount } = renderTicket();
    expect(screen.queryByRole('button', { name: 'common.options' })).not.toBeInTheDocument();
    unmount();

    const user = userEvent.setup();
    renderTicket({ onClose });
    await user.click(screen.getByRole('button', { name: 'common.options' }));
    await user.click(await screen.findByText('common.close'));
    expect(onClose).toHaveBeenCalled();
  });
});
