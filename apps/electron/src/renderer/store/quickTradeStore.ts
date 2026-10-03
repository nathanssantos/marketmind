import { create } from 'zustand';
import { usePreferencesStore } from './preferencesStore';

export const TICKET_SIZE_PERCENT_PREF_KEY = 'ticketSizePercent';
export const DEFAULT_TICKET_SIZE_PERCENT = 10;
const MIN_TICKET_SIZE_PERCENT = 0.1;
const MAX_TICKET_SIZE_PERCENT = 100;

const isValidSizePercent = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= MIN_TICKET_SIZE_PERCENT && value <= MAX_TICKET_SIZE_PERCENT;

export interface TicketPrefill {
  /** 'BUY' for long, 'SELL' for short. */
  side: 'BUY' | 'SELL';
  /** Stop-loss price as a string the ticket can drop straight into its input. */
  stopLoss: string;
  /** Take-profit price. Same shape. */
  takeProfit: string;
  /** Entry price the drawing projected (used as the LIMIT price). */
  entryPrice: string;
}

interface QuickTradeState {
  sizePercent: number;
  setSizePercent: (pct: number) => void;
  hydrate: (tradingPrefs: Record<string, unknown>) => void;
  /**
   * One-shot prefill payload. Set by the long/short position drawing's
   * "send to ticket" button; consumed by `TradeTicket` on the next render.
   * Stays in state until the ticket calls `consumePrefill()` so the user
   * can switch tabs/panels without losing the prefill in flight.
   */
  pendingPrefill: TicketPrefill | null;
  prefillFromDrawing: (payload: TicketPrefill) => void;
  consumePrefill: () => TicketPrefill | null;
}

export const useQuickTradeStore = create<QuickTradeState>((set, get) => ({
  sizePercent: DEFAULT_TICKET_SIZE_PERCENT,
  setSizePercent: (pct) => {
    set({ sizePercent: pct });
    usePreferencesStore.getState().set('trading', TICKET_SIZE_PERCENT_PREF_KEY, pct);
  },
  hydrate: (tradingPrefs) => {
    const saved = tradingPrefs[TICKET_SIZE_PERCENT_PREF_KEY];
    set({ sizePercent: isValidSizePercent(saved) ? saved : DEFAULT_TICKET_SIZE_PERCENT });
  },
  pendingPrefill: null,
  prefillFromDrawing: (payload) => set({ pendingPrefill: payload }),
  consumePrefill: () => {
    const current = get().pendingPrefill;
    if (current) set({ pendingPrefill: null });
    return current;
  },
}));
