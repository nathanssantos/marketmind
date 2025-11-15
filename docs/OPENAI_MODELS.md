# OpenAI GPT Models Reference

## 🤖 Available GPT Models (API)

### GPT-4o (Recommended)
**API ID:** `gpt-4o`

**Best for:**
- Complex technical analysis
- Chart pattern recognition
- Multi-modal analysis (text + images)
- Real-time market insights
- Balanced performance and cost

**Specifications:**
- Context Window: 128K tokens
- Max Output: 16,384 tokens
- Pricing: $2.50 / MTok input, $10 / MTok output
- Training Data: Up to October 2023
- Vision: ✅ Yes (natively supports images)
- Function Calling: ✅ Yes
- JSON Mode: ✅ Yes
- Latency: Fast

**Key Features:**
- Native vision capabilities (no separate API needed)
- Excellent at understanding financial charts
- Strong reasoning for trading strategies
- Supports structured outputs
- Reliable and consistent

---

### GPT-4o Mini (Cost-Effective)
**API ID:** `gpt-4o-mini`

**Best for:**
- High-volume requests
- Quick responses
- Real-time chat
- Simple analysis tasks
- Cost-sensitive applications

**Specifications:**
- Context Window: 128K tokens
- Max Output: 16,384 tokens
- Pricing: $0.15 / MTok input, $0.60 / MTok output
- Training Data: Up to October 2023
- Vision: ✅ Yes (natively supports images)
- Function Calling: ✅ Yes
- JSON Mode: ✅ Yes
- Latency: Very Fast

**Key Features:**
- 94% cheaper than GPT-4o for input
- Still supports vision and function calling
- Great for straightforward analysis
- Fast response times
- Best price-to-performance ratio

---

## 🎯 Which Model to Choose?

### For MarketMind Application

**Chart Analysis:** GPT-4o
- Best for detailed pattern recognition
- Excellent multi-modal understanding
- Reliable technical analysis
- Good balance of quality and cost

**Real-time Chat:** GPT-4o Mini
- 16x cheaper than GPT-4o
- Fast enough for real-time responses
- Still capable for most queries
- Ideal for high message volumes

**Complex Trading Strategies:** GPT-4o
- Superior reasoning capabilities
- Better at multi-step analysis
- More nuanced understanding
- Worth the premium for critical decisions

---

## 🔧 Using Different Models

### In Code

```typescript
// Use GPT-4o (default)
const aiService = new AIService({
  provider: 'openai',
  apiKey: 'sk-...',
  model: 'gpt-4o', // or omit for default
});

// Use GPT-4o Mini (cost-effective)
const aiService = new AIService({
  provider: 'openai',
  apiKey: 'sk-...',
  model: 'gpt-4o-mini',
});
```

### Vision API (Chart Analysis)

```typescript
const response = await aiService.analyzeChart({
  chartImage: 'data:image/png;base64,...',
  symbol: 'BTC/USDT',
  timeframe: '1h',
  prompt: 'Analyze this chart for trading opportunities',
});
```

---

## 💰 Cost Comparison

For analyzing 1000 charts with ~2K tokens input + 1K tokens output:

### GPT-4o
- Input: 1000 × 2K tokens = 2M tokens × $2.50/MTok = **$5**
- Output: 1000 × 1K tokens = 1M tokens × $10/MTok = **$10**
- **Total: $15**

### GPT-4o Mini
- Input: 2M tokens × $0.15/MTok = **$0.30**
- Output: 1M tokens × $0.60/MTok = **$0.60**
- **Total: $0.90** (94% cheaper!)

---

## 🚀 Performance Features

### Both Models Support:

✅ **Vision** - Native image understanding  
✅ **Function Calling** - Tool use capabilities  
✅ **JSON Mode** - Structured outputs  
✅ **System Messages** - Custom behavior  
✅ **Temperature Control** - Creativity adjustment  
✅ **Max Tokens** - Output length control  
✅ **Streaming** - Real-time responses  

---

## 📊 Comparison with Other Providers

| Feature | GPT-4o | Claude Sonnet 4.5 | Gemini 1.5 Pro |
|---------|--------|-------------------|----------------|
| Input Pricing | $2.50/MTok | $3/MTok | $1.25/MTok |
| Output Pricing | $10/MTok | $15/MTok | $5/MTok |
| Context Window | 128K | 200K (1M beta) | 2M |
| Max Output | 16K | 64K | 8K |
| Vision | ✅ Native | ✅ Native | ✅ Native |
| Speed | Fast | Fast | Very Fast |
| Reasoning | Excellent | Excellent | Good |

| Feature | GPT-4o Mini | Claude Haiku 4.5 | Gemini 1.5 Flash |
|---------|-------------|------------------|------------------|
| Input Pricing | $0.15/MTok | $1/MTok | $0.075/MTok |
| Output Pricing | $0.60/MTok | $5/MTok | $0.30/MTok |
| Context Window | 128K | 200K | 1M |
| Max Output | 16K | 64K | 8K |
| Vision | ✅ Native | ✅ Native | ✅ Native |
| Speed | Very Fast | Fastest | Very Fast |

---

## 🔐 Getting API Access

1. Visit [platform.openai.com](https://platform.openai.com)
2. Sign up for an account
3. Add payment method (required for API access)
4. Generate API key in [API Keys](https://platform.openai.com/api-keys)
5. Start with $5-10 credit to test

### Pricing Plans
- **Pay-as-you-go:** No monthly fee, pay per token
- **Prepaid Credits:** Purchase credits in advance with discounts
- **Enterprise:** Custom pricing for high volume

### Rate Limits (Tier 1)
- **GPT-4o:** 500 RPM, 10,000 TPM, 30,000 TPD
- **GPT-4o Mini:** 500 RPM, 200,000 TPM, 10,000,000 TPD

RPM = Requests Per Minute  
TPM = Tokens Per Minute  
TPD = Tokens Per Day

---

## 🎛️ Advanced Configuration

### Temperature Settings

```typescript
// More deterministic (0.0 - 0.3)
const response = await aiService.sendMessage({
  message: 'Analyze this chart',
  temperature: 0.2,
});

// Balanced (0.4 - 0.7)
const response = await aiService.sendMessage({
  message: 'Suggest trading strategies',
  temperature: 0.5,
});

// More creative (0.8 - 1.0)
const response = await aiService.sendMessage({
  message: 'Generate market insights',
  temperature: 0.8,
});
```

### Max Tokens Control

```typescript
// Short responses (save costs)
const response = await aiService.sendMessage({
  message: 'Quick price prediction',
  maxTokens: 100,
});

// Detailed analysis
const response = await aiService.sendMessage({
  message: 'Comprehensive market analysis',
  maxTokens: 2000,
});
```

---

## 💡 Best Practices

### Cost Optimization

1. **Use GPT-4o Mini for:**
   - Simple queries
   - High-volume chat
   - Quick confirmations
   - Real-time responses

2. **Use GPT-4o for:**
   - Complex analysis
   - Critical decisions
   - Multi-step reasoning
   - Detailed reports

3. **Optimize prompts:**
   - Be specific and concise
   - Avoid unnecessary context
   - Reuse system messages
   - Set appropriate max_tokens

### Quality Optimization

1. **System messages:**
   - Define AI behavior upfront
   - Include domain expertise
   - Set response format

2. **Few-shot examples:**
   - Show desired output format
   - Include edge cases
   - Demonstrate reasoning

3. **Temperature tuning:**
   - Low (0.0-0.3) for factual analysis
   - Medium (0.4-0.7) for balanced responses
   - High (0.8-1.0) for creative insights

---

## 🐛 Common Issues

### Rate Limit Errors (429)
**Problem:** Too many requests  
**Solution:** Implement exponential backoff, upgrade tier, or reduce frequency

### Context Length Errors (400)
**Problem:** Input + output exceeds 128K tokens  
**Solution:** Reduce context, summarize history, or split requests

### Invalid API Key (401)
**Problem:** Wrong or expired key  
**Solution:** Generate new key at platform.openai.com/api-keys

### Timeout Errors
**Problem:** Request takes too long  
**Solution:** Reduce max_tokens, simplify prompt, or implement retry logic

---

## 📚 Additional Resources

- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [GPT-4o Model Card](https://platform.openai.com/docs/models/gpt-4o)
- [Pricing Details](https://openai.com/api/pricing/)
- [Best Practices Guide](https://platform.openai.com/docs/guides/prompt-engineering)
- [Rate Limits](https://platform.openai.com/docs/guides/rate-limits)
- [Error Codes](https://platform.openai.com/docs/guides/error-codes)

---

## 🆚 Quick Comparison: When to Use Each

### Choose GPT-4o when:
- ✅ You need the best quality analysis
- ✅ Working with complex chart patterns
- ✅ Making critical trading decisions
- ✅ Detailed multi-step reasoning required
- ✅ Budget allows for premium quality

### Choose GPT-4o Mini when:
- ✅ High volume of simple queries
- ✅ Real-time chat interactions
- ✅ Cost is a primary concern
- ✅ Response speed is critical
- ✅ Task doesn't require deep reasoning

### Consider Claude when:
- ✅ Need larger context (200K+ tokens)
- ✅ Want longer outputs (up to 64K tokens)
- ✅ Prefer Claude's reasoning style
- ✅ Using extended thinking features

### Consider Gemini when:
- ✅ Need FREE tier for testing (2.0 Flash Exp)
- ✅ Want lowest cost ($0.0375/$0.15 for Flash-8B)
- ✅ Need massive context (2M tokens)
- ✅ Fast responses are priority

---

**Last Updated:** November 15, 2025  
**GPT Version:** 4o / 4o-mini
