# Binance Trading Fees - Complete Guide

**Last Updated:** November 29, 2025  
**Source:** [Binance Official Fee Schedule](https://www.binance.com/en/fee/schedule)

---

## 📊 Spot Trading Fees

### Standard Fee Structure (VIP 0)

| Fee Type | Rate | Description |
|----------|------|-------------|
| **Maker Fee** | 0.1000% (0.001) | Orders that add liquidity to the order book |
| **Taker Fee** | 0.1000% (0.001) | Orders that remove liquidity from the order book |

**Important:** By default, both maker and taker orders are charged **0.1%** of the trade value.

### Example Calculation

For a **$1,000 USD trade**:
- Entry fee: $1,000 × 0.001 = **$1.00**
- Exit fee: $1,000 × 0.001 = **$1.00**
- **Total round-trip cost: $2.00** (0.2% of position)

---

## 🎯 VIP Level Fee Discounts

Binance offers reduced fees based on 30-day trading volume and BNB holdings:

| VIP Level | 30-Day Volume (BTC) | BNB Balance | Maker Fee | Taker Fee |
|-----------|---------------------|-------------|-----------|-----------|
| VIP 0 | < 50 | < 0 | 0.1000% | 0.1000% |
| VIP 1 | ≥ 50 | ≥ 50 | 0.0900% | 0.1000% |
| VIP 2 | ≥ 500 | ≥ 200 | 0.0800% | 0.1000% |
| VIP 3 | ≥ 1,500 | ≥ 500 | 0.0600% | 0.0800% |
| VIP 4 | ≥ 4,500 | ≥ 1,000 | 0.0400% | 0.0600% |
| VIP 5 | ≥ 10,000 | ≥ 2,000 | 0.0200% | 0.0400% |
| VIP 6 | ≥ 30,000 | ≥ 5,000 | 0.0120% | 0.0240% |
| VIP 7 | ≥ 60,000 | ≥ 10,000 | 0.0100% | 0.0200% |
| VIP 8 | ≥ 150,000 | ≥ 15,000 | 0.0080% | 0.0160% |
| VIP 9 | ≥ 300,000 | ≥ 20,000 | 0.0040% | 0.0080% |

---

## 💰 BNB Discount (25% reduction)

**Using BNB to pay fees reduces costs by 25%:**

| Standard Fee | With BNB Discount |
|--------------|-------------------|
| 0.1000% | **0.0750%** |
| 0.0900% | **0.0675%** |
| 0.0800% | **0.0600%** |

**Example:** VIP 0 user with BNB discount:
- Maker/Taker: 0.1% → **0.075%**
- Round-trip: 0.2% → **0.15%**

---

## 🔄 API Trading Considerations

### 1. **Fee Calculation**
```
Entry Fee = Position Size × Fee Rate
Exit Fee = Position Size × Fee Rate
Total Fees = Entry Fee + Exit Fee
```

### 2. **Maker vs Taker**
- **Limit Orders** (placed in order book): Usually **Maker**
- **Market Orders** (executed immediately): Always **Taker**
- **Stop-Loss/Take-Profit**: Usually **Taker** when triggered

### 3. **Minimum Notional Value**
- Each trade must meet minimum value requirements
- Typically **$10 USD equivalent** per trade
- Varies by trading pair

### 4. **API Rate Limits**
- **Orders:** 10 orders/second per account
- **Weight-based limits:** 1200 weight/minute
- **Raw requests:** 6100 requests/5 minutes

---

## 📈 Impact on Trading Strategy

### Break-Even Calculation

For a **round-trip trade** (entry + exit):

| Fee Scenario | Total Fee | Min. Profit to Break-Even |
|--------------|-----------|---------------------------|
| VIP 0 (Standard) | 0.20% | **0.20%** |
| VIP 0 + BNB | 0.15% | **0.15%** |
| VIP 3 | 0.14% | **0.14%** |
| VIP 5 | 0.06% | **0.06%** |
| VIP 9 | 0.012% | **0.012%** |

### Risk:Reward Adjustment

**Traditional 2:1 R:R may not be enough!**

Example with VIP 0 fees (0.2% round-trip):
- Setup risk: 1%
- Target profit: 2%
- **Actual profit after fees:** 2% - 0.2% = **1.8%**
- **Actual R:R:** 1.8:1.2 = **1.5:1** ❌

**Recommended minimum R:R with fees:**
- For 0.2% fees: **2.5:1** or higher
- For 0.15% fees (BNB): **2.3:1** or higher

---

## 🎯 MarketMind Implementation Strategy

### 1. **Minimum Profit Threshold**
```typescript
const MIN_PROFIT_AFTER_FEES = 0.005; // 0.5% minimum profit after fees
const ROUND_TRIP_FEE = 0.002; // 0.2% (VIP 0 standard)

// Trade is viable if:
expectedProfit > (setupRisk + ROUND_TRIP_FEE + MIN_PROFIT_AFTER_FEES)
```

### 2. **Setup Viability Check**
Before creating orders, validate:
- ✅ Expected profit > fees + minimum profit
- ✅ Risk:Reward ratio after fees ≥ 2:1
- ✅ Position size ≥ minimum notional value

### 3. **Fee Display**
Show in order tooltips and trade list:
- Entry fee (estimated)
- Exit fee (estimated)
- Total fees paid
- Net profit/loss after fees

---

## 🔍 Dynamic Fee Fetching

### Binance API Endpoint
```
GET /api/v3/account
```

**Response includes:**
```json
{
  "makerCommission": 10,  // 10 = 0.1% (basis points)
  "takerCommission": 10,  // 10 = 0.1%
  "buyerCommission": 0,
  "sellerCommission": 0,
  "canTrade": true,
  "canWithdraw": true,
  "canDeposit": true
}
```

**Commission conversion:**
```typescript
makerFeeRate = makerCommission / 10000; // 10 → 0.001 (0.1%)
takerFeeRate = takerCommission / 10000; // 10 → 0.001 (0.1%)
```

---

## ⚠️ Important Notes

1. **Fees are deducted from the asset received:**
   - Buy BTC: Fee in BTC
   - Sell BTC: Fee in USDT

2. **Stop-Loss orders typically use TAKER fees:**
   - Always assume worst case (taker rate)

3. **Slippage is separate from fees:**
   - Market orders may have additional slippage
   - Fees apply to executed price, not intended price

4. **Real-time updates:**
   - VIP level changes monthly based on volume
   - BNB discount requires sufficient BNB balance
   - Fee rates can be cached for 24 hours

---

## 📚 References

- [Binance Fee Schedule](https://www.binance.com/en/fee/schedule)
- [Binance VIP Program](https://www.binance.com/en/vip)
- [Binance API Documentation](https://binance-docs.github.io/apidocs/spot/en/)
- [Trading Rules](https://www.binance.com/en/trade-rule)

---

## 🔄 Update Schedule

This document should be reviewed and updated:
- ✅ Monthly: Check for VIP level changes
- ✅ Quarterly: Verify fee structure changes
- ✅ When implementing live trading: Fetch real-time fees via API

**Next Review Date:** December 29, 2025
