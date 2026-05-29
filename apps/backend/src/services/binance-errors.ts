/**
 * Single source of truth for classifying Binance SDK / REST errors.
 *
 * Binance errors arrive in several shapes depending on the call path:
 *   - the SDK's raw `{ code, msg }` object
 *   - an `Error` whose `.message` carries the text
 *   - a wrapper `{ body: { code, msg } }` (HTTP-layer)
 *   - nested under `.cause`
 *
 * Before this module the same predicates (order-not-found, benign
 * margin-type, -1021 timestamp skew) were re-implemented inline in ~10
 * places with slightly different string lists, so a code that matched in
 * one path silently didn't in another. Everything funnels through here now.
 */

interface BinanceErrorShape {
  code?: number;
  msg?: string;
  message?: string;
  body?: { code?: number; msg?: string };
  cause?: unknown;
}

/** Extract the numeric Binance error code from any shape (incl. body / cause). */
export const binanceErrorCode = (error: unknown): number | undefined => {
  const e = error as BinanceErrorShape | null | undefined;
  if (!e || typeof e !== 'object') return undefined;
  if (typeof e.code === 'number') return e.code;
  if (typeof e.body?.code === 'number') return e.body.code;
  if (e.cause && e.cause !== e) return binanceErrorCode(e.cause);
  return undefined;
};

/** Lowercased text from every place Binance stashes a message. */
export const binanceErrorText = (error: unknown): string => {
  const e = error as BinanceErrorShape | null | undefined;
  if (!e) return '';
  if (typeof e === 'string') return (e as string).toLowerCase();
  const parts = [e.message, e.msg, e.body?.msg].filter((p): p is string => typeof p === 'string');
  let text = parts.join(' ');
  if (e.cause && e.cause !== e) text += ' ' + binanceErrorText(e.cause);
  return text.toLowerCase();
};

/**
 * -1021: request timestamp outside the server's recvWindow (clock skew).
 * recvWindow does NOT help in the "ahead" direction — handled by the
 * time-sync self-heal in guardBinanceCall.
 */
export const isTimestampError = (error: unknown): boolean => {
  if (binanceErrorCode(error) === -1021) return true;
  const t = binanceErrorText(error);
  return t.includes('ahead of the server') || t.includes('recvwindow');
};

/**
 * -2011: order/algo no longer exists on the exchange (already filled,
 * cancelled, or never tracked). Almost always benign on a cancel path —
 * the caller's intent (order gone) is already satisfied.
 */
export const isOrderNotFound = (error: unknown): boolean => {
  if (binanceErrorCode(error) === -2011) return true;
  const t = binanceErrorText(error);
  return t.includes('unknown order')
    || t.includes('order does not exist')
    || t.includes('does not exist')
    || t.includes('not found');
};

/**
 * -4046 / -4067: "no need to change margin type" — Binance returns an
 * error status even when the symbol's margin type already matches the
 * request. Benign: the desired state is already in place.
 */
export const isBenignMarginTypeError = (error: unknown): boolean => {
  const code = binanceErrorCode(error);
  if (code === -4046 || code === -4067) return true;
  const t = binanceErrorText(error);
  return t.includes('no need to change margin type')
    || t.includes('margin type cannot be changed');
};
