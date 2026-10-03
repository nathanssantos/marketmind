# Trade Ticket Spec

> **One sentence:** one ticket component, read top to bottom in the order a trader decides (size → side → type → protection → send), whose fields follow the asset type of the selected wallet.
>
> **Authored:** 2026-10-03, during plan item 1.3 of [`APP_REVIEW_PLAN.md`](APP_REVIEW_PLAN.md). The floating ticket and the grid panel render this same component.

## Layout

```
┌──────────────────────────────────────────────────┐
│ 10%  25%  50%  75%  100%                    5x ▾ │  size + leverage (futures only)
│ ●────────────────────────────  −  10%  +          │
├──────────────────────────────────────────────────┤
│ [  Buy / Long  ] [  Sell / Short ]   OCO ◉       │  side + OCO
├──────────────────────────────────────────────────┤
│ [ Market ] [ Limit ]  [ 84,747.30 ]              │  type + price (price only for Limit)
│ ◉ SL [ 83,070 ]  -1.98%   ◉ TP [ 87,309 ]  +3.02%│  protection with % from entry
├──────────────────────────────────────────────────┤
│ Total 932.48 USDT · Margin 186.50 · Liq. 71,030  │  summary, recomputed per side
│ Risk 2.1% of balance · R:R 1 : 1.5               │
├──────────────────────────────────────────────────┤
│ ┃        Buy 0.011 BTC @ 84,747.30              ┃ │  single action button, side colour
├──────────────────────────────────────────────────┤
│ ✕ Cancel orders    ▦ Grid    🛡 Trailing          │  secondary actions
└──────────────────────────────────────────────────┘
```

## Behaviour

**Side selector.** Segmented Buy | Sell, coloured by the selected side. The "→" button of a Long or Short Position drawing selects the side, the Limit type, the price, SL and TP, and shows a thin strip above the action button: "From Long Position drawing · clear". Switching side keeps SL and TP; if they end up on the wrong side the field turns red and the action button is disabled with the reason.

**OCO.** Same row, right side. Enabled only when both SL and TP are on; disabled state has a tooltip. Remembers the last choice (preference `ticketProtectionOco`, default on).

**Type and price.** Market has no price field. Limit fills the price with the book mid on switch and has a "Mid" button to reset. When a Limit price crosses the market (Buy above, Sell below) the chip shows **Stop**, because that is what the server sends.

**SL and TP.** Toggle, price and % from entry on one line; price and % are both editable and stay in sync. Placeholders suggest −2% / +3% on the correct side. With an open position on the opposite side, SL and TP turn grey with the note "This order reduces the open position; SL and TP do not apply", and the confirm dialog repeats it.

**Summary.** Always visible: total, margin and liquidation (futures only), **Risk** = loss if the SL fires including the account's real fees, and R:R when SL and TP are on. Estimated fee and break-even price appear in the confirm dialog.

**Action button.** One button with side, quantity and price; green for Buy, red for Sell. Disabled with a short reason underneath (no wallet, no price, quantity below minimum, SL on the wrong side, leverage loading, market closed). With an open position on the opposite side the label becomes "Close 0.011 BTC" (equal quantity), "Reduce 0.005 BTC" (smaller) or "Reverse to Short 0.004" (larger). A PAPER or LIVE badge sits on the button.

**Confirm dialog.** Same summary plus estimated entry fee and break-even price, and "Protection: OCO / Independent" when both SL and TP are set. Preference to skip confirmation for market orders (default: ask).

**Keyboard.** ↑/↓ in price fields move one tick of the symbol; Enter in a field opens the confirmation.

## Asset type matrix

| | Crypto spot | Crypto futures | Stocks (Interactive Brokers) |
|---|---|---|---|
| Sides | Buy / Sell (Sell only with holdings) | Buy/Long · Sell/Short | Buy / Sell; Short only when the symbol is shortable |
| Leverage | none | 1–125x with Binance brackets | none; account margin shown |
| Margin and liquidation | none | both | margin only |
| Quantity | symbol step (0.001 BTC) | symbol step | whole shares |
| Order types | Market, Limit, Stop | Market, Limit, Stop | Market, Limit, Stop; market orders only while the session is open |
| Fees | account spot rate | account futures rate | IB commission estimate |
| Funding | no | informative only | no |
| Quote currency | wallet quote (USDT) | USDT | USD |
| Hours | 24/7 | 24/7 | session strip: pre-market, regular, after-hours, closed, with next open |

Fee rates come from `fees.forWallet` (Binance account tier, cached for a day). Paper wallets use the published VIP0 table of the wallet's market.

## Default layouts

The ticket panel height is one shared constant used by the layout templates, the default seed and the marketing screenshot fixture, so the three stop drifting (they were 10, 19 and 20 rows). A test renders the ticket at the panel height and fails when the content overflows.

## Stocks: validation status

Interactive Brokers prices and orders need a running IB Gateway. Until one is available the stocks column is built and covered by mocked tests only, and the plan marks it as not seen on screen.
