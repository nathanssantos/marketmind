# Claude Models Reference

## 🤖 Available Claude Models (API)

### Claude Sonnet 4.5 (Recommended)
**API ID:** `claude-sonnet-4-5-20250929`

**Best for:**
- Complex agents and coding tasks
- Technical analysis
- Chart pattern recognition
- Multi-step reasoning

**Specifications:**
- Context Window: 200K tokens (1M tokens in beta with header)
- Max Output: 64K tokens
- Pricing: $3 / MTok input, $15 / MTok output
- Training Data: July 2025
- Reliable Knowledge: January 2025
- Latency: Fast
- Extended Thinking: Yes

---

### Claude Haiku 4.5 (Fastest)
**API ID:** `claude-haiku-4-5-20251001`

**Best for:**
- Quick responses
- Real-time chat
- High-volume requests
- Cost-sensitive applications

**Specifications:**
- Context Window: 200K tokens
- Max Output: 64K tokens
- Pricing: $1 / MTok input, $5 / MTok output
- Training Data: July 2025
- Reliable Knowledge: February 2025
- Latency: Fastest
- Extended Thinking: Yes

---

### Claude Opus 4.1 (Specialized Reasoning)
**API ID:** `claude-opus-4-1-20250805`

**Best for:**
- Complex reasoning tasks
- Detailed analysis
- High-quality outputs
- Critical decision making

**Specifications:**
- Context Window: 200K tokens
- Max Output: 32K tokens
- Pricing: $15 / MTok input, $75 / MTok output
- Training Data: March 2025
- Reliable Knowledge: January 2025
- Latency: Moderate
- Extended Thinking: Yes

---

## 🎯 Which Model to Choose?

### For MarketMind Application

**Chart Analysis:** Claude Sonnet 4.5
- Best balance of speed, cost, and intelligence
- Excellent at technical pattern recognition
- Great for multi-modal (text + image) analysis

**Real-time Chat:** Claude Haiku 4.5
- Fastest response times
- Lower cost for high-volume usage
- Still highly capable

**Complex Trading Strategies:** Claude Opus 4.1
- Deepest reasoning for complex scenarios
- Best for detailed strategy analysis
- Higher cost but premium quality

---

## 🔧 Using Different Models

### In Code

```typescript
// Use Claude Sonnet 4.5 (default)
const aiService = new AIService({
  provider: 'anthropic',
  apiKey: 'sk-ant-...',
  model: 'claude-sonnet-4-5-20250929', // or omit for default
});

// Use Claude Haiku 4.5 (fastest)
const aiService = new AIService({
  provider: 'anthropic',
  apiKey: 'sk-ant-...',
  model: 'claude-haiku-4-5-20251001',
});

// Use Claude Opus 4.1 (specialized reasoning)
const aiService = new AIService({
  provider: 'anthropic',
  apiKey: 'sk-ant-...',
  model: 'claude-opus-4-1-20250805',
});
```

### Using Aliases (Auto-update)

```typescript
// Using aliases (automatically points to latest version)
const aiService = new AIService({
  provider: 'anthropic',
  apiKey: 'sk-ant-...',
  model: 'claude-sonnet-4-5', // alias
});
```

⚠️ **Note:** For production, use specific model versions (with date) for consistent behavior.

---

## 💰 Cost Comparison

For analyzing 1000 charts with ~2K tokens input + 1K tokens output:

### Claude Sonnet 4.5
- Input: 1000 × 2K tokens = 2M tokens × $3/MTok = **$6**
- Output: 1000 × 1K tokens = 1M tokens × $15/MTok = **$15**
- **Total: $21**

### Claude Haiku 4.5
- Input: 2M tokens × $1/MTok = **$2**
- Output: 1M tokens × $5/MTok = **$5**
- **Total: $7**

### Claude Opus 4.1
- Input: 2M tokens × $15/MTok = **$30**
- Output: 1M tokens × $75/MTok = **$75**
- **Total: $105**

---

## 🚀 Performance Features

### All Claude 4 Models Support:

✅ **Vision** - Analyze chart images  
✅ **Extended Thinking** - Deep reasoning mode  
✅ **Priority Tier** - Faster response times  
✅ **Multilingual** - Multiple languages  
✅ **Large Context** - 200K+ token windows  
✅ **Tool Use** - Function calling capabilities  

---

## 📊 Comparison with Other Providers

| Feature | Claude Sonnet 4.5 | GPT-4o | Gemini 1.5 Pro |
|---------|-------------------|--------|----------------|
| Input Pricing | $3/MTok | $2.50/MTok | $1.25/MTok |
| Output Pricing | $15/MTok | $10/MTok | $5/MTok |
| Context Window | 200K (1M beta) | 128K | 2M |
| Max Output | 64K | 16K | 8K |
| Vision | ✅ | ✅ | ✅ |
| Speed | Fast | Fast | Very Fast |
| Reasoning | Excellent | Excellent | Good |

---

## 🔐 Getting API Access

1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Sign up for an account
3. Add payment method (required for API access)
4. Generate API key
5. Start with $5-10 credit to test

### Pricing Plans
- **Pay-as-you-go:** No monthly fee, pay per token
- **Credits:** Purchase credits in advance
- **Enterprise:** Custom pricing for high volume

---

## 📚 Additional Resources

- [Claude API Documentation](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
- [Model Comparison](https://docs.anthropic.com/en/docs/about-claude/models)
- [Pricing Details](https://docs.anthropic.com/en/docs/about-claude/pricing)
- [Best Practices](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices)
- [Migration Guide](https://docs.anthropic.com/en/docs/about-claude/models/migrating-to-claude-4)

---

**Last Updated:** November 15, 2025  
**Claude Version:** 4.5
