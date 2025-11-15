# AI Integration - Testing Guide

## 🧪 Quick Test

### 1. Install Dependencies

```bash
npm install openai
```

### 2. Test Component

Create a test file or use this code snippet to test the AI integration:

```tsx
import { useAI } from '@renderer/hooks/useAI';

function AITestComponent() {
  const { configure, sendMessage, isConfigured, isLoading, error, activeConversation } = useAI();

  // Configure AI on mount
  useEffect(() => {
    if (!isConfigured) {
      configure({
        provider: 'openai',
        apiKey: 'YOUR_API_KEY_HERE',  // Replace with your actual API key
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 4096,
      });
    }
  }, [isConfigured, configure]);

  const handleTest = async () => {
    await sendMessage('What is a doji candlestick pattern?');
  };

  return (
    <div>
      <button onClick={handleTest} disabled={isLoading || !isConfigured}>
        Test AI
      </button>
      {error && <p>Error: {error}</p>}
      {activeConversation?.messages.map(msg => (
        <div key={msg.id}>
          <strong>{msg.role}:</strong> {msg.content}
        </div>
      ))}
    </div>
  );
}
```

### 3. Browser Console Test

Open browser console and run:

```javascript
// Get AI store
const aiStore = window.__ZUSTAND_STORES__?.ai;

// Configure
aiStore.getState().setSettings({
  provider: 'openai',
  apiKey: 'YOUR_API_KEY',
  model: 'gpt-4o',
});

// Test (requires importing AIService manually)
const { AIService } = await import('/src/renderer/services/ai');
const service = new AIService({
  provider: 'openai',
  apiKey: 'YOUR_API_KEY',
  model: 'gpt-4o',
});

const response = await service.sendMessage([
  { id: '1', role: 'user', content: 'Hello!', timestamp: Date.now() }
]);

console.log(response.text);
```

### 4. Node.js Test Script

Create `scripts/test-ai.mjs`:

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'YOUR_API_KEY',
});

async function test() {
  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful technical analyst.'
        },
        {
          role: 'user',
          content: 'What is a golden cross pattern?'
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    console.log('✓ OpenAI API is working!');
    console.log('\nResponse:');
    console.log(completion.choices[0].message.content);
  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

test();
```

Run it:

```bash
OPENAI_API_KEY=sk-... node scripts/test-ai.mjs
```

### 5. Expected Results

**Successful Response:**
```
✓ OpenAI API is working!

Response:
A golden cross is a bullish technical indicator that occurs when a short-term moving average (typically the 50-day MA) crosses above a long-term moving average (typically the 200-day MA). This pattern suggests...
```

**Common Errors:**

1. **Invalid API Key**
```
Error: Incorrect API key provided
```
→ Check your API key at https://platform.openai.com/api-keys

2. **Insufficient Credits**
```
Error: You exceeded your current quota
```
→ Add credits to your OpenAI account

3. **Network Error**
```
Error: fetch failed
```
→ Check your internet connection

### 6. Component Integration Test

The `AITest.tsx` component in `src/renderer/components/` provides a full UI test:

1. Enter your API key
2. Click "Configure AI"
3. Type a message
4. See the AI response

To use it, temporarily add to `App.tsx`:

```tsx
import { AITest } from './components/AITest';

// In your App component
<AITest />
```

---

## 📊 Testing Chart Analysis

```tsx
const { analyzeChart } = useAI();

// Capture chart as base64 image
const canvas = document.querySelector('canvas');
const chartImage = canvas.toDataURL('image/png');

// Analyze
const analysis = await analyzeChart({
  chartImage,
  candles: marketData.candles,
  context: 'Bitcoin 1-hour chart',
});

console.log('Signal:', analysis.signals?.[0]?.signal);
console.log('Confidence:', analysis.confidence);
console.log('Analysis:', analysis.text);
```

---

## 🔍 Debugging

### Enable Logging

```tsx
// In your component
useEffect(() => {
  const unsubscribe = useAIStore.subscribe(
    (state) => state.isLoading,
    (isLoading) => console.log('AI Loading:', isLoading)
  );
  
  return unsubscribe;
}, []);
```

### Check Store State

```tsx
const storeState = useAIStore.getState();
console.log('Store:', storeState);
```

### Validate API Key

```tsx
const isValidApiKey = (key: string) => {
  return key.startsWith('sk-') && key.length > 20;
};
```

---

## ✅ Integration Checklist

- [ ] OpenAI SDK installed
- [ ] API key configured
- [ ] Can send basic message
- [ ] Can analyze chart image
- [ ] Conversations are saved
- [ ] Error handling works
- [ ] Loading states work
- [ ] LocalStorage persistence works

---

**Next Steps:** Once basic testing is complete, proceed with UI components (Chat Sidebar, Settings Modal).
