import { create } from 'zustand';

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
  sizePercent: 0.1,
  setSizePercent: (pct) => set({ sizePercent: pct }),
  pendingPrefill: null,
  prefillFromDrawing: (payload) => set({ pendingPrefill: payload }),
  consumePrefill: () => {
    const current = get().pendingPrefill;
    if (current) set({ pendingPrefill: null });
    return current;
  },
}));
