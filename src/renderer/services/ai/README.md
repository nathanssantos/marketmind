# AI Service Documentation

## 📋 Overview

The AI Service provides a unified interface for integrating multiple AI providers (OpenAI, Anthropic, Gemini) to analyze financial charts and provide trading insights.

---

## 🏗 Architecture

```
ai/
├── AIService.ts              # Main service (provider manager)
├── types.ts                  # BaseAIProvider abstract class + types
├── prompts.json             # All AI prompts (system, user, templates)
├── index.ts                 # Public exports
├── README.md                # This file
└── providers/
    ├── OpenAIProvider.ts    # OpenAI GPT-4o implementation
    ├── ClaudeProvider.ts    # Claude (Anthropic) implementation
    ├── GeminiProvider.ts    # (TODO) Gemini implementation
    └── index.ts             # Provider exports
```

---

## 🚀 Quick Start

### Basic Usage

```typescript
import { AIService } from '@renderer/services/ai';

// Initialize with OpenAI
const aiService = new AIService({
  provider: 'openai',
  apiKey: 'sk-proj-...',
  model: 'gpt-4o',        // optional, defaults to provider's default
  temperature: 0.7,        // optional, defaults to 0.7
  maxTokens: 4096,         // optional, defaults to 4096
});

// Or use Claude (Anthropic)
const aiService = new AIService({
  provider: 'anthropic',
  apiKey: 'sk-ant-...',
  model: 'claude-sonnet-4-5-20250929', // optional
  temperature: 0.7,
  maxTokens: 4096,
});

// Simple chat message
const response = await aiService.sendMessage([
  { 
    id: '1', 
    role: 'user', 
    content: 'What is a doji candlestick pattern?',
    timestamp: Date.now()
  }
]);

console.log(response.text);
```

### Chart Analysis

```typescript
import type { AIAnalysisRequest } from '@shared/types';

// Analyze a chart with image
const request: AIAnalysisRequest = {
  chartImage: 'data:image/png;base64,...', // base64 chart screenshot
  candles: marketData.candles,              // array of Candle objects
  context: 'Bitcoin 1-hour chart',          // optional context
  news: recentNews,                         // optional news articles
};

const analysis = await aiService.analyzeChart(request);

console.log(analysis.text);          // Full analysis text
console.log(analysis.confidence);    // Confidence score (0-100)
console.log(analysis.signals);       // Trading signals array

// Example signal
if (analysis.signals && analysis.signals.length > 0) {
  const signal = analysis.signals[0];
  console.log(signal.signal);        // 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
  console.log(signal.confidence);    // 85
  console.log(signal.reasoning);     // Why this signal was chosen
}
```

---

## 📦 API Reference

### AIService

#### Constructor

```typescript
constructor(config: AIServiceConfig)

interface AIServiceConfig {
  provider: 'openai' | 'anthropic' | 'gemini';
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}
```

#### Methods

##### sendMessage(messages, images?)
Send chat messages with optional images.

```typescript
sendMessage(
  messages: AIMessage[],
  images?: string[]
): Promise<AIAnalysisResponse>

interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  timestamp: number;
}
```

##### analyzeChart(request)
Analyze a financial chart with AI vision.

```typescript
analyzeChart(
  request: AIAnalysisRequest
): Promise<AIAnalysisResponse>

interface AIAnalysisRequest {
  chartImage: string;        // base64 image
  candles: Candle[];         // price data
  news?: NewsArticle[];      // optional news
  context?: string;          // optional context
}

interface AIAnalysisResponse {
  text: string;              // Full response text
  confidence?: number;       // 0-100
  signals?: TradingSignalData[];
}
```

##### switchProvider(newConfig)
Switch to a different AI provider.

```typescript
switchProvider(newConfig: AIServiceConfig): void

// Example
aiService.switchProvider({
  provider: 'anthropic',
  apiKey: 'sk-ant-...',
  model: 'claude-3-opus-20240229',
});
```

##### updateConfig(partialConfig)
Update current provider configuration.

```typescript
updateConfig(partialConfig: Partial<AIServiceConfig>): void

// Example
aiService.updateConfig({
  temperature: 0.5,
  maxTokens: 2048,
});
```

##### Utility Methods

```typescript
getProviderType(): AIProviderType
getConfig(): AIServiceConfig
getSystemPrompt(): string
getChatSystemPrompt(): string
getDisclaimer(): string
getSignalInfo(signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell')
```

---

## 🎨 Prompts System

All prompts are centralized in `prompts.json`:

```json
{
  "chartAnalysis": {
    "system": "You are an expert technical analyst...",
    "userTemplate": "Please analyze this financial chart...",
    "contextTemplate": "\n\nAdditional Context: {context}",
    "priceDataTemplate": "\n\nLatest Price Data:\n- Open: ${open}...",
    "newsTemplate": "\n\nRecent News Headlines:\n{newsItems}"
  },
  "chat": {
    "system": "You are a helpful AI assistant...",
    "disclaimer": "Remember: This is educational information only..."
  },
  "signals": {
    "strong_buy": {
      "label": "STRONG BUY",
      "description": "Very bullish indicators...",
      "color": "#22c55e"
    }
    // ... other signals
  }
}
```

### Benefits
- **Centralized**: All prompts in one place
- **Easy to Update**: Modify prompts without changing code
- **i18n Ready**: Can be replaced with localized versions
- **Version Control**: Track prompt changes over time

---

## 🔌 Supported Providers

### OpenAI (GPT-4o)
- **Model**: `gpt-4o` (default)
- **Strengths**: Excellent general knowledge, vision capabilities
- **Cost**: Pay-per-use
- **API Key**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

### Anthropic (Claude)
- **Model**: `claude-sonnet-4-5-20250929` (default - Claude 4.5)
  - Also available: `claude-haiku-4-5-20251001` (fastest), `claude-opus-4-1-20250805` (specialized reasoning)
- **Strengths**: Advanced reasoning, code analysis, safety, 200K context window
- **Cost**: Paid plans starting at $20/month
- **API Key**: [console.anthropic.com](https://console.anthropic.com)
- **Why Claude 4.5?**
  - State-of-the-art performance in coding and agentic tasks
  - Exceptional reasoning capabilities
  - Extended thinking support
  - Better at following complex instructions
  - 1M token context window (beta)

### Coming Soon
- **Google Gemini**: Competitive pricing, multimodal capabilities

---

## 🔌 Adding New Providers

To add a new AI provider (e.g., Google Gemini):

### 1. Create Provider Class

```typescript
// providers/GeminiProvider.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseAIProvider, type AIProviderConfig } from '../types';
import type { AIMessage, AIAnalysisRequest, AIAnalysisResponse } from '@shared/types';

export class GeminiProvider extends BaseAIProvider {
  private client: GoogleGenerativeAI;

  constructor(config: AIProviderConfig) {
    super(config);
    this.client = new GoogleGenerativeAI(this.apiKey);
  }

  protected getDefaultModel(): string {
    return 'gemini-1.5-pro';
  }

  async sendMessage(
    messages: AIMessage[],
    images?: string[]
  ): Promise<AIAnalysisResponse> {
    // Implementation
  }

  async analyzeChart(
    request: AIAnalysisRequest
  ): Promise<AIAnalysisResponse> {
    // Implementation
  }
}
```

### 2. Update AIService

```typescript
// AIService.ts
import { GeminiProvider } from './providers/GeminiProvider';

// In initializeProvider() method:
case 'gemini':
  this.provider = new GeminiProvider(providerConfig);
  break;
```

### 3. Export Provider

```typescript
// providers/index.ts
export { GeminiProvider } from './GeminiProvider';
```

---

## 🧪 Testing

```typescript
import { AIService } from '@renderer/services/ai';

describe('AIService', () => {
  let service: AIService;

  beforeEach(() => {
    service = new AIService({
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY || 'test-key',
    });
  });

  it('should send a simple message', async () => {
    const response = await service.sendMessage([
      { 
        id: '1', 
        role: 'user', 
        content: 'Hello',
        timestamp: Date.now()
      }
    ]);

    expect(response.text).toBeTruthy();
  });

  it('should analyze a chart', async () => {
    const request = {
      chartImage: 'data:image/png;base64,...',
      candles: mockCandles,
    };

    const analysis = await service.analyzeChart(request);

    expect(analysis.text).toBeTruthy();
    expect(analysis.signals).toBeDefined();
  });
});
```

---

## 🎯 Best Practices

### 1. Error Handling

```typescript
try {
  const response = await aiService.sendMessage(messages);
  console.log(response.text);
} catch (error) {
  if (error instanceof Error) {
    console.error('AI error:', error.message);
    // Show user-friendly error message
  }
}
```

### 2. Rate Limiting

```typescript
// Use a queue or debounce for multiple requests
import { debounce } from 'lodash';

const debouncedAnalyze = debounce(async (request) => {
  return await aiService.analyzeChart(request);
}, 1000);
```

### 3. Caching Responses

```typescript
const cache = new Map<string, AIAnalysisResponse>();

const getCachedAnalysis = async (request: AIAnalysisRequest) => {
  const key = JSON.stringify(request);
  
  if (cache.has(key)) {
    return cache.get(key)!;
  }

  const response = await aiService.analyzeChart(request);
  cache.set(key, response);
  
  return response;
};
```

### 4. Streaming Responses (Future)

```typescript
// TODO: Implement streaming for real-time responses
const stream = await aiService.streamMessage(messages);

for await (const chunk of stream) {
  console.log(chunk.text);
  // Update UI incrementally
}
```

---

## 📊 Response Format

The AI is instructed to format chart analysis responses as:

```
**Summary**
Brief overview in 2-3 sentences about the current market state.

**Key Observations**
• First important finding
• Second important finding
• Third important finding

**Technical Assessment**
Detailed analysis of patterns, indicators, and market structure...

**Current Signal**: BUY
**Confidence**: 75%
**Reasoning**: The market shows bullish divergence with strong support...
```

---

## 🔐 Security

### API Key Storage

```typescript
// ❌ Bad: Never hardcode API keys
const service = new AIService({
  provider: 'openai',
  apiKey: 'sk-proj-abc123...',  // DON'T DO THIS
});

// ✅ Good: Use environment variables or secure storage
import { safeStorage } from 'electron';

const encryptedKey = safeStorage.encryptString(apiKey);
// Store encryptedKey in local file

const decryptedKey = safeStorage.decryptString(encryptedKey);
const service = new AIService({
  provider: 'openai',
  apiKey: decryptedKey,
});
```

---

## 📝 Examples

### Example 1: Basic Chat

```typescript
const messages: AIMessage[] = [
  {
    id: '1',
    role: 'user',
    content: 'What is a golden cross pattern?',
    timestamp: Date.now(),
  }
];

const response = await aiService.sendMessage(messages);
console.log(response.text);
// "A golden cross is a bullish technical analysis pattern..."
```

### Example 2: Chart Analysis with Context

```typescript
const request: AIAnalysisRequest = {
  chartImage: chartScreenshot,  // base64
  candles: last100Candles,
  context: 'ETH/USD 4-hour chart showing recent breakout above $2000',
  news: [
    {
      id: '1',
      title: 'Ethereum Merge Update Announced',
      summary: 'Core developers confirm...',
      url: 'https://...',
      source: 'CoinDesk',
      publishedAt: Date.now(),
      sentiment: 'positive',
    }
  ],
};

const analysis = await aiService.analyzeChart(request);

if (analysis.signals && analysis.signals[0]) {
  const { signal, confidence } = analysis.signals[0];
  const signalInfo = aiService.getSignalInfo(signal);
  
  console.log(`Signal: ${signalInfo.label}`);
  console.log(`Confidence: ${confidence}%`);
  console.log(`Color: ${signalInfo.color}`);
}
```

---

## 🚧 Future Enhancements

- [ ] Streaming responses for real-time output
- [x] Anthropic Claude provider (✅ COMPLETED)
- [ ] Google Gemini provider
- [ ] Response caching layer
- [ ] Rate limiting and retry logic
- [ ] Token usage tracking
- [ ] Cost estimation
- [ ] Multi-language prompts (i18n)
- [ ] Custom prompt templates
- [ ] Fine-tuned models support

---

## 📚 References

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Anthropic Claude Documentation](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
- [GPT-4 Vision Guide](https://platform.openai.com/docs/guides/vision)
- [Best Practices for Prompt Engineering](https://platform.openai.com/docs/guides/prompt-engineering)

---

**Last Updated:** November 15, 2025  
**Version:** 1.1.0
