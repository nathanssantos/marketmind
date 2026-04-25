/**
 * Branded (nominal) ID types — structurally still strings at runtime, but
 * distinct at the type level so the compiler refuses to substitute one ID
 * for another. Catches `walletId` ↔ `userId` ↔ `orderId` mix-ups at compile
 * time.
 *
 * Construction is intentionally explicit through the `brand*` helpers below.
 * In tRPC routers, brand at the boundary (Zod input → handler) and pass the
 * branded type into service functions.
 *
 * ### Usage
 *
 * Type a function parameter as the branded form:
 *
 *     async function getWallet(walletId: WalletId, userId: UserId) { ... }
 *
 * Callers must brand strings explicitly:
 *
 *     const wallet = await getWallet(brandWalletId(input.walletId), brandUserId(ctx.user.id));
 *
 * The compiler now refuses:
 *
 *     getWallet(input.userId, input.walletId);  // type error: argument order swapped
 *     getWallet('abc', 'def');                  // type error: raw string ≠ WalletId
 *
 * ### Migration strategy
 *
 * The brand is **structurally compatible with `string`** (it's `string & {...}`),
 * which means existing string-typed call sites continue to compile. Migrate
 * incrementally:
 *
 *   1. Promote a service function's parameter from `string` to `WalletId`.
 *   2. Fix the call sites the type-checker flags by wrapping in `brandWalletId()`.
 *   3. Promote the next service.
 *
 * Best place to brand is at boundaries: tRPC handlers (right after Zod validation),
 * DB query functions (input), and event payloads (constructor).
 */

declare const brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type WalletId = Brand<string, 'WalletId'>;
export type UserId = Brand<string, 'UserId'>;
export type OrderId = Brand<string, 'OrderId'>;
export type SetupId = Brand<string, 'SetupId'>;
export type ExecutionId = Brand<string, 'ExecutionId'>;
export type ProfileId = Brand<string, 'ProfileId'>;
export type SymbolString = Brand<string, 'Symbol'>;
export type StrategyId = Brand<string, 'StrategyId'>;

export const brandWalletId = (id: string): WalletId => id as WalletId;
export const brandUserId = (id: string): UserId => id as UserId;
export const brandOrderId = (id: string): OrderId => id as OrderId;
export const brandSetupId = (id: string): SetupId => id as SetupId;
export const brandExecutionId = (id: string): ExecutionId => id as ExecutionId;
export const brandProfileId = (id: string): ProfileId => id as ProfileId;
export const brandSymbol = (s: string): SymbolString => s as SymbolString;
export const brandStrategyId = (id: string): StrategyId => id as StrategyId;
