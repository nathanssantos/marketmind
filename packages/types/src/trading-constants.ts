/**
 * Cross-package trading-domain constants.
 *
 * v1.6 Track E.6 — moved out of inline declarations in renderer
 * components so backend, future tooling, and any new feature reads
 * the same source of truth.
 */

import type { WalletCurrency } from './trading';

/**
 * Currencies the user can pick when creating a wallet. Subset of all
 * known WalletCurrency values — anything else is read-only on existing
 * wallets and not offered as a creation choice.
 *
 * Was: inline `const SELECTABLE_CURRENCIES` in CreateWalletDialog.tsx.
 */
export const SELECTABLE_CURRENCIES: readonly WalletCurrency[] = ['USDT', 'USD', 'BRL', 'EUR'] as const;

/**
 * Leverage values offered as one-click presets in the leverage selector.
 * Crypto futures land at 125× max on Binance USDT-M; the preset list
 * covers conservative through aggressive in widely-used steps.
 *
 * Was: inline `const LEVERAGE_PRESETS` in LeverageSelector.tsx.
 */
export const LEVERAGE_PRESETS = [1, 2, 3, 5, 10, 20, 50, 75, 100, 125] as const;

/**
 * NYSE trading sessions in fractional hours (Eastern time).
 * - PRE_MARKET: 4:00 → 9:30 ET
 * - REGULAR:    9:30 → 16:00 ET
 * - AFTER_HOURS: 16:00 → 20:00 ET
 *
 * Was: inline `const NYSE_HOURS` in MarketStatusBar.tsx.
 */
export const NYSE_TIMEZONE = 'America/New_York' as const;

export const NYSE_HOURS = {
  PRE_MARKET: { start: 4, end: 9.5 },
  REGULAR: { start: 9.5, end: 16 },
  AFTER_HOURS: { start: 16, end: 20 },
} as const;

/**
 * Reg T margin fractions — set by the Federal Reserve Board for U.S.
 * stock margin accounts. Initial = the fraction of the trade value the
 * customer must put up in cash; Maintenance = the minimum equity ratio
 * before a margin call.
 *
 * These are regulatory constants; they don't change without an FRB rule
 * change. Sourced here so backend risk checks and the frontend's
 * MarginInfoPanel agree.
 *
 * Was: inline `const REG_T_INITIAL_MARGIN` / `REG_T_MAINTENANCE_MARGIN`
 * in MarginInfoPanel.tsx.
 */
export const REG_T_INITIAL_MARGIN = 0.5 as const;
export const REG_T_MAINTENANCE_MARGIN = 0.25 as const;
