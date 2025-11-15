import OpenAI from 'openai';

const API_KEY = process.env.OPENAI_API_KEY || '';

if (!API_KEY) {
  console.error('❌ OPENAI_API_KEY not set!');
  console.log('\nUsage: OPENAI_API_KEY=sk-... node scripts/test-ai.mjs\n');
  process.exit(1);
}

console.log('🧪 Testing OpenAI Integration...\n');

const client = new OpenAI({
  apiKey: API_KEY,
});

async function testBasicChat() {
  console.log('1️⃣  Testing basic chat...');
  
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
          content: 'What is a golden cross pattern in trading? Answer in 2 sentences.'
        }
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    const response = completion.choices[0].message.content;
    console.log('✅ Basic chat works!\n');
    console.log('Response:', response);
    console.log('\n' + '='.repeat(60) + '\n');
    
    return true;
  } catch (error) {
    console.error('❌ Basic chat failed:', error.message);
    return false;
  }
}

async function testChartAnalysis() {
  console.log('2️⃣  Testing chart analysis prompt...');
  
  const mockChartAnalysisPrompt = `You are an expert technical analyst with deep knowledge of financial markets, chart patterns, and trading strategies. Your role is to analyze charts and provide actionable insights based on:

1. **Candlestick Patterns**: Identify formations like doji, hammer, engulfing, shooting star, etc.
2. **Trend Analysis**: Determine if the market is bullish, bearish, or sideways
3. **Support & Resistance**: Identify key price levels
4. **Technical Indicators**: Analyze moving averages, volume, and other visible indicators
5. **Market Structure**: Evaluate higher highs/lows, lower highs/lows
6. **Risk Assessment**: Consider potential entry, exit, and stop-loss levels

Format your response with:
- **Summary**: Brief overview (2-3 sentences)
- **Current Signal**: One of: STRONG_BUY, BUY, HOLD, SELL, STRONG_SELL
- **Confidence**: Your confidence level (0-100%)
- **Reasoning**: Why you chose this signal`;

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: mockChartAnalysisPrompt
        },
        {
          role: 'user',
          content: `Analyze this scenario: Bitcoin is trading at $45,000. The price has formed a bullish hammer candle on the daily chart after a downtrend. The 50-day MA is at $43,000 and the 200-day MA is at $40,000. Volume is increasing.`
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const response = completion.choices[0].message.content;
    console.log('✅ Chart analysis works!\n');
    console.log('Analysis:', response);
    console.log('\n' + '='.repeat(60) + '\n');
    
    return true;
  } catch (error) {
    console.error('❌ Chart analysis failed:', error.message);
    return false;
  }
}

async function testSignalParsing() {
  console.log('3️⃣  Testing signal parsing...');
  
  const mockResponse = `**Summary**
The chart shows bullish momentum with strong support.

**Current Signal**: BUY
**Confidence**: 75%
**Reasoning**: The hammer pattern suggests reversal potential.`;

  const signalRegex = /\*\*Current Signal\*\*:?\s*(STRONG[_\s]BUY|BUY|HOLD|SELL|STRONG[_\s]SELL)/i;
  const confidenceRegex = /\*\*Confidence\*\*:?\s*(\d+)%?/i;

  const signalMatch = mockResponse.match(signalRegex);
  const confidenceMatch = mockResponse.match(confidenceRegex);

  if (signalMatch && confidenceMatch) {
    console.log('✅ Signal parsing works!');
    console.log('   Signal:', signalMatch[1]);
    console.log('   Confidence:', confidenceMatch[1] + '%');
    console.log('\n' + '='.repeat(60) + '\n');
    return true;
  } else {
    console.error('❌ Signal parsing failed');
    return false;
  }
}

async function runTests() {
  console.log('Starting AI Integration Tests...\n');
  console.log('='.repeat(60) + '\n');
  
  const results = [];
  
  results.push(await testBasicChat());
  results.push(await testChartAnalysis());
  results.push(await testSignalParsing());
  
  console.log('\n' + '='.repeat(60));
  console.log('Test Results:');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`\n✅ Passed: ${passed}/${total}`);
  console.log(`${passed === total ? '🎉' : '⚠️ '} ${passed === total ? 'All tests passed!' : 'Some tests failed'}\n`);
  
  if (passed === total) {
    console.log('✨ AI Integration is working correctly!');
    console.log('📝 Next: Add your API key to the app and test with the UI\n');
  }
  
  process.exit(passed === total ? 0 : 1);
}

runTests();
