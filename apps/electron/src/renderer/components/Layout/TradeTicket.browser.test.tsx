import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColorModeProvider } from '@renderer/components/ui/color-mode';
import { DEFAULT_ROW_HEIGHT, GRID_MARGIN, TRADING_RAIL_ROWS } from '@shared/types/layout';

vi.mock('@renderer/hooks/useActiveWallet', () => ({
  useActiveWallet: () => ({ activeWallet: { id: 'w1', currentBalance: '10000', walletType: 'paper', exchange: 'BINANCE', currency: 'USDT', marketType: 'FUTURES' }, exchangeId: 'BINANCE', isIB: false }),
}));
vi.mock('@renderer/hooks/useBookTicker', () => ({ useBookTicker: () => ({ bidPrice: 49_950, askPrice: 50_050 }) }));
vi.mock('@renderer/hooks/useBackendFuturesTrading', () => ({ useBackendFuturesTrading: () => ({ cancelAllOrders: vi.fn(), isCancellingAllOrders: false }) }));
vi.mock('@renderer/hooks/useBackendTradingMutations', () => ({ useBackendTradingMutations: () => ({ createOrder: vi.fn(), isCreatingOrder: false }) }));
vi.mock('@renderer/hooks/useOrderQuantity', () => ({
  useOrderQuantity: () => ({ getQuantity: () => '0.1000', leverage: 5, balance: 10_000, isReady: true, notReadyReason: null, tickSize: 0.1, stepSize: 0.001, minNotional: 5, sizePercent: 10 }),
}));
vi.mock('@renderer/hooks/useLeverageBrackets', () => ({ useLeverageBrackets: () => undefined }));
vi.mock('@renderer/hooks/useSymbolOpenPosition', () => ({ useSymbolOpenPosition: () => null }));
vi.mock('@renderer/hooks/useWalletFees', () => ({ useWalletFees: () => ({ maker: 0.0002, taker: 0.0005, vipLevel: 0, hasBnbDiscount: false, isLoaded: true }) }));
vi.mock('@renderer/hooks/useTradingMarketType', () => ({ useTradingMarketType: () => 'FUTURES' }));
vi.mock('@renderer/hooks/useToast', () => ({ useToast: () => ({ warning: vi.fn(), error: vi.fn() }) }));
vi.mock('@renderer/store/quickTradeStore', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useQuickTradeStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      sizePercent: 10,
      setSizePercent: vi.fn(),
      pendingPrefill: { side: 'BUY', entryPrice: '50100', stopLoss: '49000', takeProfit: '52500' },
      prefillFromDrawing: vi.fn(),
      consumePrefill: () => ({ side: 'BUY', entryPrice: '50100', stopLoss: '49000', takeProfit: '52500' }),
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));
vi.mock('@renderer/store/priceStore', async (importOriginal) => ({ ...(await importOriginal<object>()), usePricesForSymbols: () => ({ BTCUSDT: 50_000 }) }));
vi.mock('@renderer/store/preferencesStore', async (importOriginal) => {
  const original = await importOriginal<object>();
  const usePref = <T,>(_key: string, initialValue: T): [T, (value: T) => void] => [initialValue, () => undefined];
  const usePreferencesStore = Object.assign(
    (selector?: (state: Record<string, unknown>) => unknown) => {
      const state = { isHydrated: true, chart: {}, ui: {}, trading: {} };
      return typeof selector === 'function' ? selector(state) : state;
    },
    { getState: () => ({ isHydrated: true, chart: {}, ui: {}, trading: {}, set: () => undefined }) },
  );
  return { ...original, useTradingPref: usePref, useUIPref: usePref, useChartPref: usePref, usePreferencesStore };
});
vi.mock('@renderer/utils/trpc', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  trpc: {
    useUtils: () => ({}),
    auth: { me: { useQuery: () => ({ data: { id: 'u' }, isLoading: false, error: null }) } },
    preferences: {
      getByCategory: { useQuery: () => ({ data: {}, isLoading: false, isSuccess: true, error: null }) },
      set: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) },
    },
    stocks: {
      marketStatus: { useQuery: () => ({ data: undefined }) },
      shortability: { useQuery: () => ({ data: undefined }) },
      commissionEstimate: { useQuery: () => ({ data: undefined }) },
    },
  },
}));
vi.mock('./GridOrderPopover', () => ({ GridOrderPopover: ({ triggerElement }: { triggerElement?: React.ReactNode }) => <div>{triggerElement}</div> }));
vi.mock('./TrailingStopPopover', () => ({ TrailingStopPopover: ({ triggerElement }: { triggerElement?: React.ReactNode }) => <div>{triggerElement}</div> }));
vi.mock('./LeveragePopover', () => ({ LeveragePopover: () => <div style={{ height: 20 }} /> }));

import { TradeTicketActions } from './TradeTicket';

const PANEL_PADDING_PX = 6;
const TICKET_PANEL_WIDTH_PX = 432;

const panelHeightPx = (rows: number): number => rows * DEFAULT_ROW_HEIGHT + (rows - 1) * GRID_MARGIN[1];

describe('TradeTicket panel height', () => {
  it('fits the ticket, with the drawing strip and both protection rows, inside the default ticket panel height', () => {
    const { container } = render(
      <ChakraProvider value={defaultSystem}>
        <ColorModeProvider>
          <div style={{ width: TICKET_PANEL_WIDTH_PX, height: panelHeightPx(TRADING_RAIL_ROWS.ticket), padding: PANEL_PADDING_PX, overflow: 'auto', boxSizing: 'border-box' }} data-testid="ticket-panel">
            <TradeTicketActions symbol="BTCUSDT" marketType="FUTURES" />
          </div>
        </ColorModeProvider>
      </ChakraProvider>,
    );

    const panel = container.querySelector('[data-testid="ticket-panel"]') as HTMLDivElement;
    expect(panel.scrollHeight).toBeLessThanOrEqual(panel.clientHeight);
  });
});
