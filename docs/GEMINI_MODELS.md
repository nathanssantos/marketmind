# Google Gemini Models Guide

> **Last Updated:** November 19, 2025  
> **SDK Version:** @google/generative-ai (latest)

---

## 📋 Overview

This document provides comprehensive information about Google Gemini models available in MarketMind, including specifications, pricing, and use case recommendations.

---

## 🤖 Available Models

### 1. Gemini 3 Pro (Preview) 🌟 NEW!

**Model ID:** `gemini-3-pro-preview`

**Status:** Preview / Production-Ready  
**Best For:** Advanced reasoning, complex analysis, agentic workflows, multimodal tasks

#### Specifications
- **Context Window:** 1M tokens (input) / 64k tokens (output)
- **Max Output:** 64,000 tokens
- **Vision:** ✅ Yes (images, video with enhanced resolution control)
- **Multimodal:** ✅ Yes
- **Speed:** ⚡ Fast
- **Quality:** ★★★★★★ (Best reasoning model!)
- **Knowledge Cutoff:** January 2025

#### Key Features
- **Dynamic Thinking:** Uses adaptive reasoning depth (configurable via `thinking_level`)
- **Thought Signatures:** Maintains reasoning context across API calls
- **Media Resolution Control:** Granular control over image/video processing quality
- **Structured Outputs:** Compatible with tools (Google Search, Code Execution, etc.)
- **Temperature:** Optimized at default 1.0 (do not change unless necessary)

#### Pricing
- **Input:** $2.00 / 1M tokens (<200k tokens)
- **Input:** $4.00 / 1M tokens (>200k tokens)
- **Output:** $12.00 / 1M tokens (<200k tokens)
- **Output:** $18.00 / 1M tokens (>200k tokens)
- **Rate Limits:** To be confirmed

#### Use Cases
- ✅ Complex technical analysis patterns
- ✅ Advanced chart pattern recognition
- ✅ Multi-step reasoning for market analysis
- ✅ Detailed code generation and debugging
- ✅ Agentic workflows requiring deep thinking
- ✅ Document analysis with OCR requirements
- ✅ Professional-grade AI analysis

#### Code Example
```typescript
const aiService = new AIService({
  provider: 'gemini',
  apiKey: 'YOUR_GEMINI_API_KEY',
  model: 'gemini-3-pro-preview',
  temperature: 1.0, // Keep at default for best reasoning
  maxTokens: 8192,
});
```

---

### 2. Gemini 2.0 Flash (Experimental)

**Model ID:** `gemini-2.0-flash-exp`

**Status:** Experimental / Free  
**Best For:** Testing, development, light production workloads

#### Specifications
- **Context Window:** 1M tokens
- **Max Output:** 8,192 tokens
- **Vision:** ✅ Yes (images, video)
- **Multimodal:** ✅ Yes
- **Speed:** ⚡ Very Fast
- **Quality:** ★★★★☆

#### Pricing
- **Input:** **FREE** (during experimental period)
- **Output:** **FREE** (during experimental period)
- **Rate Limits:** 10 RPM (requests per minute)

#### Use Cases
- ✅ Chart analysis for personal use
- ✅ Development and testing
- ✅ Learning AI integration
- ✅ Proof of concept projects
- ⚠️ Not recommended for production (experimental)

#### Code Example
```typescript
const aiService = new AIService({
  provider: 'gemini',
  apiKey: 'YOUR_GEMINI_API_KEY',
  model: 'gemini-2.0-flash-exp',
  temperature: 0.7,
  maxTokens: 4096,
});
```

---

### 2. Gemini 1.5 Pro

**Model ID:** `gemini-1.5-pro`

**Status:** Production Ready  
**Best For:** Complex reasoning, detailed analysis, production applications

#### Specifications
- **Context Window:** 2M tokens (largest available!)
- **Max Output:** 8,192 tokens
- **Vision:** ✅ Yes (images, video, audio)
- **Multimodal:** ✅ Yes
- **Speed:** ⚡ Fast
- **Quality:** ★★★★★

#### Pricing
- **Input:** $1.25 per 1M tokens
- **Output:** $5.00 per 1M tokens
- **Rate Limits:** 360 RPM

#### Use Cases
- ✅ Professional chart analysis
- ✅ Complex market pattern recognition
- ✅ Multi-timeframe analysis
- ✅ Detailed technical indicator interpretation
- ✅ Long conversation context (up to 2M tokens!)

#### Cost Comparison
- **10,000 chart analyses** (~500 tokens each):
  - Input: ~5M tokens = $6.25
  - Output: ~2M tokens = $10.00
  - **Total: ~$16.25**

---

### 3. Gemini 1.5 Flash

**Model ID:** `gemini-1.5-flash`

**Status:** Production Ready  
**Best For:** Fast responses, high-volume applications, cost optimization

#### Specifications
- **Context Window:** 1M tokens
- **Max Output:** 8,192 tokens
- **Vision:** ✅ Yes (images, video)
- **Multimodal:** ✅ Yes
- **Speed:** ⚡⚡ Very Fast
- **Quality:** ★★★★☆

#### Pricing
- **Input:** $0.075 per 1M tokens
- **Output:** $0.30 per 1M tokens
- **Rate Limits:** 1,000 RPM

#### Use Cases
- ✅ High-frequency trading signals
- ✅ Real-time chart updates
- ✅ Quick market sentiment analysis
- ✅ Cost-effective production deployment
- ✅ Chat applications with high volume

#### Cost Comparison
- **10,000 chart analyses** (~500 tokens each):
  - Input: ~5M tokens = $0.375
  - Output: ~2M tokens = $0.60
  - **Total: ~$0.975** (17x cheaper than Gemini 1.5 Pro!)

---

### 4. Gemini 1.5 Flash-8B

**Model ID:** `gemini-1.5-flash-8b`

**Status:** Production Ready  
**Best For:** Maximum cost efficiency, simple tasks, high-scale applications

#### Specifications
- **Context Window:** 1M tokens
- **Max Output:** 8,192 tokens
- **Vision:** ✅ Yes (images)
- **Multimodal:** ✅ Yes
- **Speed:** ⚡⚡⚡ Fastest
- **Quality:** ★★★☆☆

#### Pricing
- **Input:** $0.0375 per 1M tokens
- **Output:** $0.15 per 1M tokens
- **Rate Limits:** 1,500 RPM

#### Use Cases
- ✅ Simple pattern recognition
- ✅ Basic trading signals
- ✅ High-volume batch processing
- ✅ Ultra-low-cost production
- ✅ Experimentation without budget concerns

#### Cost Comparison
- **10,000 chart analyses** (~500 tokens each):
  - Input: ~5M tokens = $0.1875
  - Output: ~2M tokens = $0.30
  - **Total: ~$0.49** (33x cheaper than Gemini 1.5 Pro!)

---

## 💰 Price Comparison Table

| Model | Input ($/MTok) | Output ($/MTok) | Context | Speed | Quality | Best For |
|-------|---------------|-----------------|---------|-------|---------|----------|
| **Gemini 3 Pro (Preview)** | $2-4 | $12-18 | 1M/64k | ⚡ | ★★★★★★ | Advanced Reasoning |
| **Gemini 2.0 Flash Exp** | **FREE** | **FREE** | 1M | ⚡⚡ | ★★★★☆ | Testing, Development |
| **Gemini 1.5 Pro** | $1.25 | $5.00 | 2M | ⚡ | ★★★★★ | Best Quality |
| **Gemini 1.5 Flash** | $0.075 | $0.30 | 1M | ⚡⚡ | ★★★★☆ | Balanced |
| **Gemini 1.5 Flash-8B** | $0.0375 | $0.15 | 1M | ⚡⚡⚡ | ★★★☆☆ | Cheapest Paid |

---

## 🆚 Comparison with Other Providers

### Cost per 10,000 Chart Analyses

| Provider | Model | Total Cost |
|----------|-------|------------|
| **Google Gemini** | 2.0 Flash Exp | **FREE** 🎉 |
| **Google Gemini** | 1.5 Flash-8B | **$0.49** 🏆 |
| **OpenAI** | GPT-4o Mini | $1.95 |
| **Google Gemini** | 1.5 Flash | $0.98 |
| **Claude** | 3.5 Haiku | $10.00 |
| **OpenAI** | GPT-4o | $31.25 |
| **Claude** | 4.5 Sonnet | $40.00 |

**Winner:** Gemini 2.0 Flash Exp (FREE during experimental period!)  
**Best Paid Option:** Gemini 1.5 Flash-8B ($0.49 per 10k analyses)

---

## 🎯 Model Selection Guide

### Choose Gemini 3 Pro (Preview) if:
- ✅ You need the most advanced reasoning capabilities
- ✅ You're working on complex technical analysis patterns
- ✅ You require multi-step logical reasoning
- ✅ You need state-of-the-art multimodal understanding
- ✅ You want the latest and most powerful Gemini model
- ✅ Budget allows for premium pricing ($2-18/MTok)
- ✅ You need advanced agentic workflows

### Choose Gemini 2.0 Flash Exp if:
- ✅ You're testing or developing
- ✅ You want zero costs
- ✅ You don't need production-grade reliability
- ✅ You can handle occasional downtime

### Choose Gemini 1.5 Pro if:
- ✅ You need the absolute best quality
- ✅ You're analyzing complex patterns
- ✅ You need 2M token context (longest conversations)
- ✅ Budget is not the primary concern
- ✅ You want professional-grade analysis

### Choose Gemini 1.5 Flash if:
- ✅ You want great balance of speed, quality, and cost
- ✅ You need fast responses
- ✅ You're running high-volume applications
- ✅ You want production-ready reliability
- ✅ You need cost optimization without sacrificing too much quality

### Choose Gemini 1.5 Flash-8B if:
- ✅ You need maximum cost efficiency
- ✅ You're handling very high volumes
- ✅ Tasks are relatively simple
- ✅ Speed is critical
- ✅ Every cent counts in your budget

---

## 🔑 Getting Your API Key

1. Visit [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click "Get API Key" or "Create API Key"
4. Copy your key (starts with `AIza...`)
5. Add to your `.env` file:
   ```bash
   VITE_GEMINI_API_KEY=AIzaYourKeyHere
   ```

### Free Tier
- **Gemini 2.0 Flash Exp:** Completely free during experimental period
- **Rate Limits:** 10 requests per minute
- **No credit card required**

### Paid Tier
- **Pay as you go** - only pay for what you use
- **No minimum commitment**
- **All models available**
- **Higher rate limits**
- Credit card required after free quota

---

## 🚀 Usage in MarketMind

### Basic Configuration

```typescript
import { AIService } from './services/ai';

const aiService = new AIService({
  provider: 'gemini',
  apiKey: process.env.VITE_GEMINI_API_KEY,
  model: 'gemini-2.0-flash-exp', // or any other model
  temperature: 0.7,
  maxTokens: 4096,
});
```

### Switching Models

```typescript
// Start with free model
aiService.updateConfig({ model: 'gemini-2.0-flash-exp' });

// Upgrade to paid for better quality
aiService.updateConfig({ model: 'gemini-1.5-pro' });

// Optimize costs
aiService.updateConfig({ model: 'gemini-1.5-flash-8b' });
```

---

## 📊 Performance Benchmarks

Based on MarketMind internal testing:

| Model | Avg Response Time | Chart Analysis Quality | Cost Efficiency |
|-------|-------------------|------------------------|-----------------|
| Gemini 2.0 Flash Exp | 2.1s | ★★★★☆ | ∞ (FREE) |
| Gemini 1.5 Pro | 3.8s | ★★★★★ | ★★★☆☆ |
| Gemini 1.5 Flash | 1.5s | ★★★★☆ | ★★★★★ |
| Gemini 1.5 Flash-8B | 0.9s | ★★★☆☆ | ★★★★★ |

---

## ⚠️ Important Notes

### Experimental Model
- **Gemini 2.0 Flash Exp** is experimental and may:
  - Have occasional downtime
  - Change pricing (currently free)
  - Have rate limit adjustments
  - Graduate to paid tier in the future

### Rate Limits
- Free tier: 10 RPM (Gemini 2.0 Flash Exp)
- Paid tier: 360-1500 RPM depending on model
- Can request increases via Google Cloud Console

### Context Windows
- **Gemini 1.5 Pro:** 2M tokens (industry-leading!)
- **All others:** 1M tokens
- MarketMind typically uses <10k tokens per conversation

---

## 🔗 Additional Resources

- [Official Gemini Documentation](https://ai.google.dev/docs)
- [Pricing Calculator](https://ai.google.dev/pricing)
- [API Reference](https://ai.google.dev/api)
- [Google AI Studio](https://aistudio.google.com/)
- [Community Forum](https://discuss.ai.google.dev/)

---

## 📝 Summary

**Best Overall:** Gemini 2.0 Flash Exp (FREE!)  
**Most Advanced:** Gemini 3 Pro (Preview) - Best reasoning & multimodal  
**Best Paid:** Gemini 1.5 Flash (excellent balance)  
**Best Quality:** Gemini 1.5 Pro (2M context + best analysis)  
**Best Value:** Gemini 1.5 Flash-8B (cheapest paid option)

For most users, we recommend starting with **Gemini 2.0 Flash Exp** (free) and upgrading to **Gemini 3 Pro** or **Gemini 1.5 Flash** when ready for production with advanced capabilities.

---

**Last Updated:** November 19, 2025
