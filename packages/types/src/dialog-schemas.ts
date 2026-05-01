/**
 * Reusable zod schemas for dialog form validation.
 *
 * v1.6 Track E.7 — single source of truth shared between the renderer
 * (form validation) and any future consumer. Backend procedures still
 * declare their own .input() schemas inline; aligning those is a
 * follow-up. The renderer can adopt these progressively during the
 * Track A modal sweep — each rewritten dialog drops its hand-rolled
 * validation in favor of `schema.safeParse(values)`.
 *
 * Field-level rules (length, format) live here so the same validator
 * runs in form `onChange` and on submit. Cross-field rules and
 * exchange-call side effects stay in the dialog handler.
 */

import { z } from 'zod';

/** Wallet display name — used in CreateWalletDialog + UpdateWallet. */
export const walletNameSchema = z.string().min(1).max(255);

/** Currency code for paper wallet creation. Mirrors WalletCurrency type. */
export const walletCurrencySchema = z.enum(['USDT', 'USD', 'BRL', 'EUR']);

/** Market type — spot vs futures. */
export const marketTypeSchema = z.enum(['SPOT', 'FUTURES']);

/** Paper wallet creation form. */
export const createPaperWalletSchema = z.object({
  name: walletNameSchema,
  initialBalance: z.string().min(1).default('10000'),
  currency: walletCurrencySchema.default('USDT'),
  marketType: marketTypeSchema.default('FUTURES'),
});
export type CreatePaperWalletInput = z.infer<typeof createPaperWalletSchema>;

/** Real-money (testnet/live) wallet creation form. */
export const createRealWalletSchema = z.object({
  name: walletNameSchema,
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
  walletType: z.enum(['live', 'testnet']).default('testnet'),
  marketType: marketTypeSchema.default('FUTURES'),
});
export type CreateRealWalletInput = z.infer<typeof createRealWalletSchema>;

/** Screener saved-set name — used by SaveScreenerDialog. */
export const screenerNameSchema = z.string().min(1).max(100);

/** Trading profile name — used by ProfileEditorDialog and ImportProfileDialog. */
export const tradingProfileNameSchema = z.string().min(1).max(255);

/** Watcher symbol input — uppercased ticker (BTCUSDT, AAPL, etc.). */
export const watcherSymbolSchema = z
  .string()
  .min(1)
  .max(20)
  .regex(/^[A-Z0-9]+$/, 'Symbol must be uppercase alphanumeric');

/**
 * Helper for the renderer: derive a `{ valid, errors }` object from a
 * zod parse result, without throwing.
 *
 * Returns:
 *  - `valid: true` + `errors: {}` when the parse succeeds
 *  - `valid: false` + `errors: Record<fieldName, message>` when it fails
 *
 * Each field gets its first error message; subsequent issues on the same
 * field are dropped (matches typical inline form-error UX).
 */
export const parseFormValues = <T extends z.ZodTypeAny>(
  schema: T,
  values: unknown,
): { valid: true; data: z.infer<T> } | { valid: false; errors: Record<string, string> } => {
  const result = schema.safeParse(values);
  if (result.success) return { valid: true, data: result.data };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    if (!errors[path]) errors[path] = issue.message;
  }
  return { valid: false, errors };
};
