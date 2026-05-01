# Order/Position chart reactivity — audit + fix plan

> **Trigger:** user reported (2026-05-02) that closing a position via Stop Loss in profit took ~1 minute for the position to disappear from the chart. The order closed correctly on Binance — the lag was renderer-side. Quote: *"a experiencia no grafico foi trágica"*.
>
> This is a v1.6 follow-up. Adding to V1_6_PLAN.md as Track F (order reactivity).

## Symptom recap

- SL hits on Binance (price crosses the trigger).
- Binance fills the order, position is closed at exchange-level.
- Chart still renders the position line, the X-button, and the SL/TP markers.
- ~60s later, all of those disappear.
- No toast / no flash / no visual indication that the close fired during that window.

The user expects: the moment Binance fills, the chart should update within a second or two. Anything more than ~3s is a bug.

## Reactivity chain (current architecture)

```
Binance → user data stream → backend → WebSocket emit → renderer socket bus → query invalidation → tRPC refetch → chart re-render
   T0          T1                T2          T3                  T4                  T5                T6              T7
```

Expected end-to-end latency: ~300–500 ms for a healthy path.

### Where each step lives

| Step | Code | Notes |
|---|---|---|
| Binance → backend | `apps/backend/src/services/binance-futures-user-stream.ts` (592 LOC) | Wraps `binance` SDK's `wsConnectionMargin` / `wsConnectionUSDM`. Routes events to handlers in `services/user-stream/`. |
| Exit-fill detection | `services/user-stream/handle-exit-fill.ts` | Updates `tradeExecutions.status = 'closed'` in DB, computes PnL, then emits WebSocket events. |
| Backend emit | `wsService.emitPositionClosed(walletId, ...)` | Plus `emitPositionUpdate` and `emitOrderUpdate`. Goes to room `positions:<walletId>`. |
| Renderer subscription | `apps/electron/.../hooks/socket/useWalletSubscription.ts` | Subscribes to `orders / positions / wallet` rooms when wallet is active. |
| Event handler | `apps/electron/.../context/RealtimeTradingSyncContext.tsx` | `useSocketEvent('position:closed', ...)` schedules query invalidation (debounced 100ms). |
| Query invalidate | Lines 49-54 of context | Invalidates `trading.getTradeExecutions`, `trading.getPositions`, `autoTrading.getActiveExecutions`, `autoTrading.getExecutionHistory`. |
| Chart consumption | `apps/electron/.../components/Chart/ChartCanvas/useChartTradingData.ts` | Renders from `autoTrading.getActiveExecutions` (filtered by `status IN ('open','pending')`). |

## Suspicious patterns found in audit

### 1. Backup-polling cadence is 30s

`apps/electron/src/shared/constants/queryConfig.ts`:
```ts
BACKUP_POLLING_INTERVAL: 30000,
```

Every active-executions query polls every 30s as a fallback. **If the WebSocket event misses or arrives late, the user sees stale data for up to 30s.** That alone explains half the user's reported lag.

The 30s isn't itself wrong as a backup — but it's the *only* clear-after-miss mechanism. There's no shorter "did anything close?" probe.

### 2. closingSnapshotsRef is user-close-only

`useChartTradingData.ts` line 192-194:
```ts
closingSnapshotsRef.current.forEach((snapshot, id) => {
  if (!realIds.has(id)) merged.push(snapshot);
});
```

Snapshots are populated by `handleConfirmCloseOrder` (user-initiated close), not by SL/TP fills. **Good.** But if for any reason a SL-triggered close doesn't reach the renderer's invalidation, there's no compensating snapshot to keep things visible — the line just freezes at its old position until the next 30s poll. That's not the bug we have, but it is a fragility.

### 3. Optimistic overrides have a 5s TTL

```ts
const OPTIMISTIC_OVERRIDE_TTL_MS = 5_000;
```

5s is fine for most user-driven optimistic patches (set-SL, modify-price), but if the backend takes longer than 5s to ACK (e.g. Binance is slow), the optimistic override clears and the chart flashes back to the pre-action state. **Not the bug we have, but adjacent fragility.**

### 4. The SL fill backend code path

`handle-exit-fill.ts:227-248` updates the DB status to `'closed'` synchronously, then emits `position:closed`. **Looks correct.**

But: the `handle-exit-fill` is called from the user-stream `ORDER_TRADE_UPDATE` handler. If the user stream is **disconnected** at the moment the SL fills (e.g. backend just restarted, listenKey lapsed, network hiccup), the fill goes unprocessed *until the user stream reconnects and replays*. Binance does NOT replay missed events on reconnect — they're lost forever from the stream perspective. The fallback is the periodic position-sync poll.

### 5. position-sync poll cadence — unknown

This is the polling mechanism that **catches missed fills** when the user-stream is unhealthy. I haven't yet located:
- The cadence (how often does the backend sync position state from REST?)
- Whether it emits `position:closed` when it discovers a fill it missed
- Whether it runs even when the user stream looks healthy (defense-in-depth)

This is a critical investigation point — likely the smoking gun if the user's actual lag was 60s.

### 6. e2e socket bridge runs in dev

`useSocketEvent` in tests (and in dev e2e bypass mode) uses an injected fake bus. If the user was running in any kind of test/dev mode where the socket isn't real, events never reach the renderer. Worth verifying the user wasn't seeing this.

## What I haven't yet investigated

These are the next concrete things to dig into before coding any fix:

- [ ] **`handle-algo-update.ts` flow** — STOP_MARKET (algo) SL orders take a different path than regular limit orders. The handler is 307 LOC; needs careful read to confirm it emits `position:closed` correctly.
- [ ] **`handle-untracked-fill.ts` flow** — when an SL fills via algo trigger, the system may treat it as an "untracked fill" if the order tracking lost the link. This handler also emits position:closed, but the path is more complex.
- [ ] **Position sync cadence + emit behavior** — see #5 above.
- [ ] **listenKey health monitoring** — is there a watchdog ensuring the user stream is alive? When does it reconnect? Does it emit a "we just reconnected, please refetch all positions" signal to the renderer?
- [ ] **socketBus deduplication / queueing** — does it drop events under load? Does it batch + delay them? Look at `apps/electron/src/renderer/services/socketBus.ts`.
- [ ] **Chart-side render lag once data arrives** — the chart uses an imperative renderer; does `markDirty('overlays')` fire when `allExecutions` changes? Re-check.
- [ ] **Order line "loading" state** — `orderLoadingMapRef` keeps the X-button spinning; does anything keep it spinning past the actual data update for SL fills?
- [ ] **Browser-tab visibility throttling** — if the chart tab is in the background, browsers throttle setIntervals. Does `BACKUP_POLLING_INTERVAL` survive tab inactivity? Was the user's chart in the foreground?

## Plan: 4-stage fix

### Stage F.1 — Instrumentation (first, before any fix)
Goal: prove the actual latency in the user's case, not just guess.

- Add timing logs at each step of the chain: backend `handle-exit-fill` start/end, websocket emit time, renderer event receipt time, query invalidate time, refetch response time, chart re-render time. Wire to a `perfMonitor.recordOrderClose(stage, ts)` call that surfaces in the `chart.perf` overlay.
- Add a "last position-sync at" indicator visible in dev (next to the existing `chart.perf` overlay) so we can visually confirm the user-stream health.
- Reproduce the user's exact scenario: open a paper position with SL, wait for fill, measure each stage.

**No code changes to behavior** in F.1 — just visibility.

### Stage F.2 — Backend resilience (the most likely root cause)
Hypotheses to test in F.1, then fix here:

- **Add a position-state reconciliation watchdog** that runs every 5s (vs current ~30s polling) and emits `position:closed` for any execution that's `status='open'` in DB but no longer present in Binance's open-positions response. This is the "did we miss a fill?" probe.
- **listenKey health watchdog**: log + metric every 60s; force-reconnect if not seen-alive for >2× the keepalive interval; emit a `stream:reconnected` event so the renderer can force-refresh trading queries.
- **Make sure handle-algo-update + handle-untracked-fill paths emit `position:closed` consistently** — re-audit each.

### Stage F.3 — Renderer reactivity hardening
Once the backend signal is reliable:

- **Drop `BACKUP_POLLING_INTERVAL` from 30s to 5s** for active executions and orders. The websocket should be the primary signal; polling is the safety net. 5s is invisible-feeling for backup; 30s is actively bad.
- **Add a "fast-recheck" trigger after any user action**: when the user clicks close-order, also schedule a refetch 1s + 3s + 5s after submit, regardless of websocket events. Belt and suspenders.
- **Fix the chart to render an immediate "closing" treatment when `position:update` arrives with `status='closed'`** — gray out the line + show a "closed at $X.XX" label — instead of waiting for the next data refresh. The websocket payload already carries enough to render the closing state.
- **`closingSnapshotsRef` should also catch SL/TP fills**: when `position:closed` event arrives, populate the ref with the last-known state so the chart shows the close animation, then clears 800ms later. Currently this only fires for user-clicked closes.

### Stage F.4 — Visual feedback on close (user-visible win)
Even if the underlying signal arrives in 100ms, the user sees no feedback during that window. Add:

- **Order-line flash animation** keyed by `position:closed` (not just user-driven close), playing for 800ms with a green-or-red color matching the PnL.
- **"Position closed" toast** that fires on `position:closed` regardless of who initiated it, with PnL and exit reason in the body. Already partially done (`trade:notification` event handler in RealtimeTradingSyncContext line 154-188); audit if it actually fires for SL fills.
- **Optimistic chart-line update on every `position:update`** (not just `position:closed`) — keeps the chart visibly current even before the next query refresh.

## Sequencing

| # | Stage | What | Effort |
|---|---|---|---|
| 1 | F.1 | Instrumentation — backend + renderer timing logs, dev overlay | 3-4h |
| 2 | F.1 | Reproduce user's case + measure | 1-2h |
| 3 | F.2 | Position reconciliation watchdog (every 5s) | 4-5h |
| 4 | F.2 | listenKey health watchdog + reconnect signal | 3-4h |
| 5 | F.2 | Re-audit handle-algo-update + handle-untracked-fill emits | 2-3h |
| 6 | F.3 | Drop BACKUP_POLLING_INTERVAL to 5s + fast-recheck after submit | 2h |
| 7 | F.3 | closingSnapshotsRef populates on position:closed event | 2h |
| 8 | F.4 | Order-line flash on position:closed | 2-3h |
| 9 | F.4 | Toast audit for SL/TP fills | 1-2h |
| 10 | F.4 | Optimistic chart-line update on position:update | 2-3h |

**Total: ~25-30h**. Big chunk of work, but addresses the worst UX bug in the trading flow.

## Acceptance

- F.1 instrumentation lands first and is left enabled in dev. Production gets a feature flag (`chart.perf.orderReactivity`).
- After F.2 + F.3, repro the user's case: SL fills → position disappears from chart in **< 1.5s** (95th percentile). 1s if WebSocket is healthy; 1.5s if missed and caught by the 5s reconciliation watchdog → 1s renderer reaction.
- After F.4: even with worst-case 1.5s, the user sees explicit close feedback within 200ms (flash + toast) so the perceived latency drops to near-zero.

Add the new audit to `pnpm test`'s perf-spec equivalent: an e2e that triggers a paper-mode SL via the test fixture and asserts the chart visual updates within 2s.

## Out of scope

- Backtest mode (uses synthetic events; not user-stream-driven).

---

# Track F (broader scope) — ALL order/position events, not just SL

> **2026-04-30 update.** User: *"veja que a revisao das ordens no grafico nao deve ser só pra SL, revise tudo. TP. ordens limit etc etc"*. The original audit focused on SL because that was the trigger. This section expands the scope to every order/position event that should reflect on the chart — TP fills, limit entry fills, order cancels, order modifies, partial closes, liquidations, pyramiding, trailing-stop activation. The fixes from F.1–F.4 above are reused; what changes is the breadth of paths we audit and the toast/flash matrix we wire up.

## Event matrix — what should happen on the chart for each event

For each row, the columns are:
- **Backend emit** — what the backend currently fires
- **Chart needs** — what the chart should reflect
- **Toast?** — does the user need a toast notification (success/info/error)
- **Status (2026-04-30)**

| Event | Backend emit | Chart needs | Toast? | Status |
|---|---|---|---|---|
| **Limit entry placed** (NEW order) | `order:created` | New limit-order line drawn | no (user just clicked submit) | ✅ wired |
| **Limit entry filled → position opens** | `order:update` (status filled) + `position:update` (new exec) | Limit line removed, position line + SL/TP lines drawn | ✅ "Position opened · {symbol} · {side} @ {price}" | ❌ **no toast emitted** — gap |
| **Pyramid entry filled** (additional fill on existing position) | `position:update` (avg entry updated) | Position line moved to new avg entry, qty label updated | ✅ "Pyramid filled · {symbol} · qty {n} @ {price}" | ❌ **no toast emitted** — gap |
| **Partial close filled** (reduce-only partial fill) | `position:update` (qty reduced) | Position line stays, qty label decreases | ✅ "Partial close · {symbol} · qty {n} @ {price} · PnL {±x}" | ❌ **no toast emitted** — gap |
| **SL fill → full close** | `position:closed` + `order:update` + `position:update` | Position line removed, opposite SL/TP cancelled, flash + toast | ✅ "Stop Loss hit · {symbol} · ...PnL" | ✅ wired (F.4 ships toast) |
| **TP fill → full close** | `position:closed` + `order:update` + `position:update` | Same as SL fill, green toast | ✅ "Take Profit hit · {symbol} · ...PnL" | ✅ wired (F.4 ships toast) |
| **Trailing-stop activation** | `position:update` + `trade:notification` (TRAILING_STOP_UPDATED) | SL line moves up, badge "trailing active" | ✅ "Trailing stop active · {symbol} · SL@{newPrice}" | ✅ wired |
| **Trailing-stop tightening** | `position:update` (slPrice changed) | SL line moves to new tighter price | ⚠️ silent (avoid spam — only first activation toasts) | ✅ wired |
| **Manual close (user click)** | `position:closed` + `order:update` | Same as SL/TP but with reason='MANUAL' | ✅ "Position closed · {symbol} · ...PnL" | ❌ **no toast emitted** — gap |
| **Liquidation** | `position:closed` (reason=LIQUIDATION) + risk:alert | Position line removed, red flash, critical toast | ✅ critical "🚨 Liquidated · {symbol} · -{loss}" | ⚠️ partial — risk:alert toasts but no position:closed-side toast |
| **Order cancel (limit)** | `order:cancelled` + `order:update` | Limit line removed | ⚠️ user-initiated → silent; auto-cancel → toast | ❌ **no toast on auto-cancel** — gap |
| **Order modify (price/qty drag)** | `order:update` (new price) | Order line moves to new price | no (user dragged it) | ✅ wired |
| **OCO opposite-side cancel** (when SL fills, the TP gets cancelled — and vice versa) | `order:cancelled` + `order:update` | The opposite-side line disappears | no (implicit from the close) | ✅ wired (chain reaction) |
| **STOP_MARKET algo trigger fill** (Binance algo path) | `position:closed` via `handle-algo-update.ts` | Same as SL fill | ✅ same as SL/TP toast | ⚠️ **needs audit** — handle-algo-update emits position:update but not the trade:notification |
| **Untracked fill caught by reconciliation** (e.g. user-stream missed event, position-sync caught it) | `position:closed` via `handle-untracked-fill.ts` | Same as the original event would have looked | ✅ "Position closed · ..." (with reason='RECONCILED' marker) | ⚠️ **needs audit** — emits position:closed but no toast |
| **stream:reconnected** (user-stream just came back online after a gap) | new event `stream:reconnected` | Force-refetch all trading queries | ⚠️ optional info toast only if gap >30s | ❌ **doesn't exist yet** — F.2 work |

## Renderer subscription audit (current vs needed)

`apps/electron/.../context/RealtimeTradingSyncContext.tsx`:

| Event | Subscribed? | Action | Gap |
|---|---|---|---|
| `position:update` | ✅ | invalidate positions+wallet | — |
| `position:closed` | ✅ | invalidate positions+wallet+setupStats+equityCurve | — (chart now also subscribes directly) |
| `order:update` | ✅ | invalidate orders | — |
| `order:created` | ✅ | invalidate orders+wallet | — |
| `order:cancelled` | ✅ | invalidate orders+wallet | — |
| `wallet:update` | ✅ | invalidate wallet | — |
| `risk:alert` | ✅ | toast on critical liquidation risk | — |
| `trade:notification` | ✅ | toast (color by PnL sign) + native notification | TRAILING_STOP_UPDATED skips toast (intentional) |
| `stream:reconnected` | ❌ | should force-refetch all trading queries | **F.2 deliverable** |

`apps/electron/.../components/Chart/ChartCanvas/useChartTradingData.ts`:

| Event | Subscribed? | Action | Gap |
|---|---|---|---|
| `position:closed` | ✅ | snapshot exec to closingSnapshotsRef + flash + invalidate | — (added in F.3) |
| `position:update` | ❌ | should optimistically patch the visible position line | **F.4 deliverable** |
| `order:update` | ❌ | should optimistically patch the visible order line (price changed) | **F.4 deliverable** |

## Backend emit gaps to fix

After auditing all 8 user-stream handlers + 4 cross-cutting services, the gaps are:

### Toast notifications (`emitTradeNotification`)

Currently emitted from:
- ✅ `trailing-stop-apply.ts` — TRAILING_STOP_UPDATED
- ✅ `handle-exit-fill.ts` — POSITION_CLOSED (SL/TP) — added in F.4 (PR #366)

Missing — should be added:
- ❌ **Limit entry filled → position opens.** Add to `handle-pending-fill.ts` after the position is created. Title: `"Position opened · {symbol}"`, body with side/qty/entryPrice. Type: `POSITION_OPENED` (new variant).
- ❌ **Pyramid entry filled.** Add to `binance-futures-user-stream.ts` line ~170 after `emitPositionUpdate` for merge events. Type: `POSITION_PYRAMIDED` (new variant).
- ❌ **Partial close filled.** Add wherever partial fills update qty (likely `handle-exit-fill.ts` early branch when `remaining > 0`). Type: `POSITION_PARTIAL_CLOSE` (new variant).
- ❌ **Manual close.** When `handle-exit-fill.ts` runs with `reason='MANUAL'`, currently emits POSITION_CLOSED toast. Verify reason classification — already covered by F.4 (PR #366) as long as `determinedExitReason` includes MANUAL.
- ❌ **Liquidation.** When `handle-account-events.ts` emits `risk:alert` with type=LIQUIDATION, also emit a `trade:notification` (POSITION_CLOSED with reason=LIQUIDATION) so the user gets both the alert AND a position-close toast. Critical urgency.
- ❌ **Algo fill.** `handle-algo-update.ts` line ~270 currently emits `position:update` only. Add `emitPositionClosed` + `emitTradeNotification` when the algo fill closes a position. Reuse handle-exit-fill's emit logic (extract to a shared helper).
- ❌ **Untracked-fill close.** `handle-untracked-fill.ts` line 161 emits `position:closed` but no `trade:notification`. Add one with reason=RECONCILED.
- ❌ **Auto-cancel of orders.** When an order is cancelled by the system (not the user — e.g. wallet-disabled or expired-conditional), emit a `trade:notification` with type=ORDER_CANCELLED. User-initiated cancels stay silent.

### `position:closed` emit gaps

- ✅ `handle-exit-fill.ts` — emits
- ✅ `handle-untracked-fill.ts` — emits
- ✅ `position-lifecycle.ts` — emits
- ❌ `handle-algo-update.ts` — emits `position:update` with `status='closed'` but NOT a dedicated `position:closed`. Renderer's chart-side close-flash subscribes specifically to `position:closed`, so algo-path closes won't flash. **Fix: emit `position:closed` from algo path too.**

### `stream:reconnected` event (new)

After the user-stream reconnects after a >5s gap, emit `stream:reconnected` to all wallet rooms so the renderer force-refetches trading state. Wired in `binance-futures-user-stream.ts` reconnect handler (the watchdog already exists at 15s health check / 60s stale threshold per memory).

## Updated F.2 / F.3 / F.4 deliverables (broader scope)

### F.2 — Backend resilience (broadened)

In addition to the original F.2 items:

- **Algo path emits `position:closed` + `trade:notification`** (mirror the regular SL/TP path). Extract `emitClosePayload(execution, ws)` helper to avoid drift.
- **Untracked-fill path emits `trade:notification`** with reason=RECONCILED so user knows a missed event was caught.
- **Liquidation path emits both `risk:alert` AND `trade:notification`** so the user gets the critical alert and the close confirmation.
- **`stream:reconnected` event** added to the WS service, fired from user-stream watchdog after a successful reconnect. Renderer force-refetches.
- **Auto-cancel toast** for orders cancelled by the system (wallet disabled, expired, etc).

### F.3 — Renderer reactivity hardening (broadened)

In addition to the original F.3 items:

- **Subscribe to `stream:reconnected`** in RealtimeTradingSyncContext → force-refresh all trading queries.
- **Order-side fast-recheck** for limit order modifies and cancels (1s + 3s after submit, regardless of websocket).
- **`position:update` chart subscription**: in `useChartTradingData.ts`, subscribe to `position:update` so live qty/avgEntry/SL/TP changes patch the chart immediately without waiting for query refetch.
- **`order:update` chart subscription**: in `useChartTradingData.ts`, subscribe to `order:update` so price-changed orders patch the chart line position immediately.

### F.4 — Visual feedback (broadened)

In addition to the original F.4 items:

- **Position-opened flash + toast** — green flash on the new position line for 800ms when first drawn, plus toast (covered above).
- **Pyramid flash** — orange/blue flash on the position line when the avg-entry shifts (qty grew).
- **Partial-close flash** — yellow flash on position line when qty shrinks but stays >0.
- **Liquidation flash** — red full-line flash + critical toast.
- **Order-line move animation** — when `order:update` arrives with new price, animate the line smoothly to the new y-coordinate instead of teleporting (200ms transition).
- **Order-line cancel fade** — when `order:cancelled` arrives, fade the line out over 300ms before removing.

## New / updated trade-notification types

In `@marketmind/types`, extend `TradeNotificationPayload['type']`:

```ts
type TradeNotificationType =
  | 'POSITION_OPENED'        // new — limit entry fill
  | 'POSITION_CLOSED'        // existing — SL/TP/manual/liquidation/algo
  | 'POSITION_PYRAMIDED'     // new — additional fill on existing
  | 'POSITION_PARTIAL_CLOSE' // new — reduce qty but not full close
  | 'TRAILING_STOP_UPDATED'  // existing — silent
  | 'ORDER_CANCELLED'        // new — auto-cancel only
;
```

Renderer `RealtimeTradingSyncContext.tsx` updates the toast color logic:
- POSITION_OPENED → info (blue)
- POSITION_CLOSED → green if pnl≥0 else red (existing)
- POSITION_PYRAMIDED → info
- POSITION_PARTIAL_CLOSE → green/red by partial-pnl sign
- TRAILING_STOP_UPDATED → silent (existing)
- ORDER_CANCELLED → warning (orange)

## Updated sequencing

| # | Stage | What | Effort |
|---|---|---|---|
| 1 | F.1 | Instrumentation — backend + renderer timing logs, dev overlay | 3-4h |
| 2 | F.1 | Reproduce user's case + measure | 1-2h |
| 3 | F.2 | Position reconciliation watchdog @ 30s (replaces 5min) | ✅ shipped (PR #365) |
| 4 | F.2 | listenKey health watchdog → `stream:reconnected` event | 4-5h |
| 5 | F.2 | Algo-path emits position:closed + trade:notification | 2-3h |
| 6 | F.2 | Untracked-fill path emits trade:notification | 1h |
| 7 | F.2 | Liquidation path emits trade:notification (in addition to risk:alert) | 2h |
| 8 | F.2 | Auto-cancel toast for system-cancelled orders | 1-2h |
| 9 | F.2 | New trade-notification types (POSITION_OPENED/PYRAMIDED/PARTIAL/ORDER_CANCELLED) in @marketmind/types | 2h |
| 10 | F.2 | Pending-fill emits POSITION_OPENED toast | 1-2h |
| 11 | F.2 | Pyramid + partial-close emits | 2-3h |
| 12 | F.3 | BACKUP_POLLING_INTERVAL: 30s → 5s | ✅ shipped (PR #364) |
| 13 | F.3 | Chart subscribes to position:closed for snapshot+flash | ✅ shipped (PR #364) |
| 14 | F.3 | Chart subscribes to position:update + order:update (live patch) | 4-5h |
| 15 | F.3 | RealtimeTradingSyncContext subscribes to stream:reconnected | 1-2h |
| 16 | F.3 | Fast-recheck (1s + 3s) after user-action submits | 2-3h |
| 17 | F.4 | SL/TP toast (POSITION_CLOSED) | ✅ shipped (PR #366) |
| 18 | F.4 | Position-opened / pyramid / partial-close / liquidation toasts | 3-4h |
| 19 | F.4 | Order-line flash variants (open / close / pyramid / partial / liquidation) | 4-5h |
| 20 | F.4 | Order-line move animation (price changed) + cancel fade | 3-4h |

**Shipped so far:** F.3 backup polling, F.3 chart position:closed subscription, F.2 position-sync 30s, F.4 SL/TP toast.
**Remaining estimate:** ~35-45h.

## Acceptance (broadened)

- Every event in the matrix above produces visible feedback (flash + toast where applicable) within 1.5s p95.
- Worst-case (websocket missed): the 30s position-sync + 5s backup-polling catches it within 5-30s and emits the same flash/toast as the realtime path would have.
- E2E coverage: a paper-mode test fixture that simulates each event type and asserts the chart reflects within 2s and the toast surfaces.
- Out of band: trailing stop already covered, no behavior change there.
