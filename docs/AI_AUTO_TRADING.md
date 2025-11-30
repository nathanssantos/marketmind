# AI Auto-Trading System - MarketMind

## 📋 Overview

The AI Auto-Trading system allows MarketMind to automatically analyze charts and execute trades using artificial intelligence. The system combines technical analysis pattern recognition with AI decision-making to provide automated trading capabilities.

## 🎯 Features

### Core Capabilities
- **Automated Analysis**: AI analyzes charts at configurable intervals (1m to 1h)
- **Smart Decision Making**: Uses AI models (GPT-4o, Claude, Gemini) for buy/sell decisions
- **Risk Management**: Built-in stop-loss, take-profit, and position sizing
- **Safety Mechanisms**: Emergency stops, rate limiting, and trade validation
- **Performance Tracking**: Comprehensive statistics (win rate, P&L, pattern success)

### Risk Profiles

| Profile | Confidence Threshold | Risk/Reward | Use Case |
|---------|---------------------|-------------|----------|
| **Conservative** | 50%+ | 1:2 | Minimal risk, high-quality setups only |
| **Moderate** | 40%+ | 1:1.5 | Balanced approach (recommended) |
| **Aggressive** | 30%+ | 1:1 | More trades, higher risk tolerance |

## 🚀 Getting Started

### 1. Prerequisites

Before using AI Auto-Trading, ensure you have:

- ✅ **Trading Simulator Active**: Create a wallet in Settings > Trading Simulator
- ✅ **AI Configured**: Set up API key in Settings > AI Configuration
- ✅ **Sufficient Balance**: Ensure wallet has funds for trading

### 2. Configuration

#### Settings > AI Auto-Trading

**Risk Profile**
- Choose strategy: Conservative, Moderate, or Aggressive
- Set max position size (default: 10% of capital)
- Configure account risk percent (default: 1%)
- Set default stop-loss % (default: 2%)
- Set default take-profit % (default: 4%)

**Trading Limits**
- Analysis interval: How often AI checks the chart (default: 15m)
- Max trades per day: Maximum daily trades (default: 10)
- Max trades per hour: Rate limiting (default: 3)
- Min time between trades: Cooldown period (default: 5 minutes)

**Safety Settings**
- Max daily loss: Emergency stop at % loss (default: 5%)
- Emergency stop losses: Stop after N consecutive losses (default: 3)
- Notifications: Toggle alerts for trades, profits, and losses

### 3. Activation

1. Open Chat sidebar
2. Click the 🤖 (Bot icon) button next to AI Patterns toggle
3. AI will begin analyzing the chart automatically
4. Trades will appear in the Trading Panel

### 4. Monitoring

Track performance in:
- **Settings > AI Auto-Trading**: View statistics (total trades, win rate, P&L)
- **Trading Panel**: See open positions and trade history
- **Chat**: AI will explain its decisions (if AI Patterns enabled)

## 📊 How It Works

### Analysis Flow

```
1. Timer Triggers (based on analysis interval)
   ↓
2. AI Analyzes Current Chart
   - Technical patterns (34 pattern library)
   - Price action and volume
   - Trend alignment
   ↓
3. AI Returns Decision
   - Action: buy, sell, or hold
   - Confidence: 0-100%
   - Entry, stop-loss, take-profit prices
   - Reasoning and patterns identified
   ↓
4. Validation Engine
   - Check confidence threshold (risk profile)
   - Verify risk/reward ratio
   - Check trading limits (daily, hourly, cooldown)
   - Validate account balance
   ↓
5. Execute Trade (if validated)
   - Calculate position size (based on risk)
   - Place order with stop-loss & take-profit
   - Log trade details
   ↓
6. Position Monitoring
   - Check stop-loss and take-profit continuously
   - Close position automatically when hit
   - Update statistics
```

### Position Sizing

Position size is calculated based on:

1. **Risk Amount**: `account_balance * account_risk_percent / 100`
2. **Stop Distance**: `abs(entry_price - stop_loss_price)`
3. **Risk-Based Quantity**: `risk_amount / stop_distance`
4. **Max Position Value**: `account_balance * max_position_size / 100`
5. **Max Quantity**: `max_position_value / entry_price`
6. **Confidence Multiplier**:
   - 70%+ confidence: 1.0x
   - 50-69% confidence: 0.7x
   - Below 50%: 0.5x
7. **Final Quantity**: `min(risk_based_quantity, max_quantity) * confidence_multiplier`

### AI Prompts

The system uses specialized trading prompts (`prompts-trading.json`):

**Conservative Profile**
- Focus on high-probability setups
- Require strong confirmation
- Emphasize risk management

**Moderate Profile**
- Balanced approach
- Standard technical analysis
- Moderate risk tolerance

**Aggressive Profile**
- Earlier entries
- More trades
- Higher risk acceptance

## 🛡️ Safety Mechanisms

### Validation Rules

Every trade must pass:
- ✅ Confidence above threshold
- ✅ Risk/reward ratio meets minimum
- ✅ Sufficient account balance
- ✅ Within daily trade limit
- ✅ Within hourly trade limit
- ✅ Cooldown period elapsed

### Emergency Stops

Auto-trading stops automatically if:
- 🚨 Consecutive losses reach limit (default: 3)
- 🚨 Daily loss exceeds maximum % (default: 5%)
- 🚨 Account balance too low for minimum trade

### Manual Override

You can stop auto-trading at any time:
- Click the 🤖 button in Chat sidebar
- Auto-trading stops immediately
- Open positions remain active

## 📈 Performance Metrics

### Available Statistics

- **Total Trades**: All trades executed
- **Open Trades**: Currently active positions
- **Closed Trades**: Completed positions
- **Win Rate**: `(winning_trades / closed_trades) * 100`
- **Total Profit**: Sum of all profitable trades
- **Total Loss**: Sum of all losing trades
- **Net P&L**: `total_profit - total_loss`
- **Average Profit**: Mean profit per winning trade
- **Average Loss**: Mean loss per losing trade
- **Profit Factor**: `total_profit / total_loss`
- **Largest Win**: Best single trade
- **Largest Loss**: Worst single trade
- **Max Consecutive Wins/Losses**: Longest streaks
- **Pattern Success**: Win rate by pattern type

## 🔧 Advanced Configuration

### Custom Confidence Thresholds

Override default thresholds:
```typescript
{
  customConfidenceThreshold: 45, // Custom minimum confidence
  customRiskReward: 1.8,          // Custom minimum risk/reward
}
```

### Custom Trading Prompt

Edit the AI trading prompt in Settings > AI Configuration to customize:
- Analysis style
- Risk tolerance language
- Pattern priorities
- Entry/exit criteria

### Enabled Timeframes

Restrict analysis to specific timeframes:
```typescript
{
  enabledTimeframes: ['15m', '1h', '4h'], // Only analyze these
}
```

## 🐛 Troubleshooting

### AI Not Trading

**Issue**: Toggle active but no trades executed

**Solutions**:
1. Check AI configuration (API key valid)
2. Verify wallet has sufficient balance
3. Ensure chart has enough kline data (20+ klines)
4. Check if price movement meets threshold
5. Review trading limits (may have hit daily/hourly cap)

### Too Many Trades

**Issue**: AI trading too frequently

**Solutions**:
1. Switch to Conservative profile
2. Increase min time between trades
3. Reduce max trades per hour
4. Increase confidence threshold (custom)

### Frequent Losses

**Issue**: Low win rate, consecutive losses

**Solutions**:
1. Review market conditions (trending vs ranging)
2. Increase confidence threshold
3. Tighten stop-loss percentage
4. Switch to more conservative profile
5. Consider manual trading in volatile markets

### Emergency Stop Triggered

**Issue**: Auto-trading stopped automatically

**Reasons**:
- ✅ Reached consecutive loss limit → Review strategy
- ✅ Hit daily loss maximum → Wait for next day
- ✅ Insufficient balance → Deposit more funds

## 📚 Best Practices

### 1. Start Small
- Begin with Conservative profile
- Use small position sizes (5-10%)
- Test on demo/simulator first

### 2. Monitor Initially
- Watch first 10-20 trades closely
- Review AI reasoning in chat
- Adjust settings based on results

### 3. Set Realistic Expectations
- No system wins 100% of trades
- 50-60% win rate is excellent
- Focus on risk/reward, not win rate alone

### 4. Regular Review
- Check statistics weekly
- Identify successful patterns
- Adjust settings seasonally

### 5. Risk Management
- Never risk more than 1-2% per trade
- Use stop-losses on every trade
- Don't overtrade (respect limits)

## 🔒 Security & Privacy

- **API Keys**: Stored encrypted via Electron's safeStorage
- **Trade Data**: Persisted locally, never sent to external servers
- **AI Queries**: Only chart data sent to AI providers
- **No Cloud Storage**: All data stays on your device

## 🆘 Support

For issues or questions:
1. Check this documentation
2. Review IMPLEMENTATION_PLAN.md
3. Check GitHub issues
4. Create new issue with:
   - Trading config used
   - Error messages
   - Trade history (if relevant)

## 📝 Changelog

### v0.25.0 (November 2025)
- ✅ Initial AI Auto-Trading release
- ✅ 3 risk profiles (Conservative, Moderate, Aggressive)
- ✅ Emergency stops and safety mechanisms
- ✅ Comprehensive statistics tracking
- ✅ Multi-language support (EN, PT, ES, FR)

## 🔮 Future Enhancements

Planned features:
- [ ] Backtesting capability
- [ ] Custom pattern recognition training
- [ ] Multi-symbol trading
- [ ] Advanced portfolio management
- [ ] Trade copying/sharing
- [ ] Strategy marketplace

---

**⚠️ Disclaimer**: AI Auto-Trading involves risk. Past performance does not guarantee future results. Only trade with funds you can afford to lose. This software is for educational purposes. The developers are not responsible for any trading losses.
