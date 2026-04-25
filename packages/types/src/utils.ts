/**
 * Generic utility types — re-usable building blocks that aren't tied to any
 * specific domain. Add types here when (a) we have at least 2 unrelated
 * consumers, and (b) the type is small/standalone.
 */

/**
 * `NonEmptyArray<T>` — a tuple type that guarantees ≥1 element. Use when a
 * function requires "at least one" semantically (e.g., a backtest needs at
 * least one strategy, an alert needs at least one symbol).
 *
 *     function pickFirst<T>(arr: NonEmptyArray<T>): T { return arr[0]; }  // safe, no `?` or `!`
 */
export type NonEmptyArray<T> = [T, ...T[]];

/**
 * `Result<T, E>` — an explicit success/failure variant for operations where
 * throwing isn't desirable (background tasks, batch operations, anything
 * that wants to keep going on partial failure). Discriminated by `ok`.
 *
 *     function tryParse(s: string): Result<number, 'invalid'> { ... }
 *     const r = tryParse('42');
 *     if (r.ok) doSomething(r.value);
 *     else log(r.error);
 */
export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/**
 * `DeepReadonly<T>` — recursively marks every field of an object/array as
 * `readonly`. Use for config snapshots, frozen state passed to render code,
 * or any value that should never be mutated downstream.
 *
 *     const config: DeepReadonly<BacktestConfig> = freezeConfig(input);
 */
export type DeepReadonly<T> = T extends (infer R)[]
  ? readonly DeepReadonly<R>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

/**
 * `Maybe<T>` — explicit "value or absence" alias. Equivalent to `T | undefined`
 * but reads better in function signatures (`getCachedKline(): Maybe<Kline>`).
 */
export type Maybe<T> = T | undefined;

/**
 * `ValueOf<T>` — extracts the union of values from an object type. Useful
 * with `as const` maps:
 *
 *     const SIDES = { LONG: 'LONG', SHORT: 'SHORT' } as const;
 *     type Side = ValueOf<typeof SIDES>;  // 'LONG' | 'SHORT'
 */
export type ValueOf<T> = T[keyof T];

/**
 * `KeysMatching<T, V>` — keys of `T` whose value extends `V`. Helper for
 * generic filtering of object shapes (e.g. all string-typed fields).
 *
 *     type StringKeys = KeysMatching<Wallet, string>;  // 'id' | 'name' | 'apiKey' | ...
 */
export type KeysMatching<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

/**
 * `RequireFields<T, K>` — make specific keys of `T` required (the rest stay
 * as-is). Inverse of `Partial`.
 *
 *     type WithIdAndSymbol = RequireFields<TradingSetup, 'id' | 'symbol'>;
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
