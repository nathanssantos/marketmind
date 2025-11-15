#!/usr/bin/env node

import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.argv[2];

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not provided');
  console.log('\nUsage:');
  console.log('  GEMINI_API_KEY=your_key node scripts/test-gemini.mjs');
  console.log('  node scripts/test-gemini.mjs your_key');
  process.exit(1);
}

console.log('🔍 Testing Gemini API Connection...\n');

const testModels = [
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

async function testModel(modelName) {
  console.log(`\n📊 Testing ${modelName}...`);
  
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 100,
      }
    });

    console.log(`  ✓ Model created successfully`);

    const prompt = 'Say "Hello from Gemini!" and nothing else.';
    console.log(`  → Sending test message...`);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log(`  ✓ Response received!`);
    console.log(`  📝 Response: "${text.trim()}"`);
    console.log(`  ✅ ${modelName} is working!`);
    
    return true;
  } catch (error) {
    console.error(`  ❌ Error with ${modelName}:`);
    console.error(`  📋 Message: ${error.message}`);
    
    if (error.message.includes('401')) {
      console.error(`  🔑 Invalid API key`);
    } else if (error.message.includes('429')) {
      console.error(`  ⏱️  Rate limit exceeded (wait 1 minute)`);
    } else if (error.message.includes('404')) {
      console.error(`  🚫 Model not found or unavailable`);
    } else if (error.message.includes('SAFETY')) {
      console.error(`  ⚠️  Safety filter triggered`);
    }
    
    return false;
  }
}

async function testChat(modelName) {
  console.log(`\n💬 Testing Chat with ${modelName}...`);
  
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });

    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: 'Hello!' }],
        },
        {
          role: 'model',
          parts: [{ text: 'Hi there! How can I help you?' }],
        },
      ],
    });

    console.log(`  ✓ Chat created successfully`);

    const result = await chat.sendMessage([{ text: 'What is 2+2?' }]);
    const response = await result.response;
    const text = response.text();

    console.log(`  ✓ Chat response received!`);
    console.log(`  📝 Response: "${text.trim()}"`);
    console.log(`  ✅ Chat functionality working!`);
    
    return true;
  } catch (error) {
    console.error(`  ❌ Chat error:`, error.message);
    return false;
  }
}

async function main() {
  console.log('API Key:', GEMINI_API_KEY.substring(0, 10) + '...');
  console.log('='.repeat(60));

  const results = {
    models: {},
    chat: false,
  };

  for (const modelName of testModels) {
    results.models[modelName] = await testModel(modelName);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const workingModel = testModels.find(m => results.models[m]);
  if (workingModel) {
    results.chat = await testChat(workingModel);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 SUMMARY');
  console.log('='.repeat(60));

  console.log('\nModels:');
  for (const [model, working] of Object.entries(results.models)) {
    console.log(`  ${working ? '✅' : '❌'} ${model}`);
  }

  console.log(`\nChat: ${results.chat ? '✅' : '❌'}`);

  const allWorking = Object.values(results.models).every(v => v) && results.chat;
  
  console.log('\n' + '='.repeat(60));
  if (allWorking) {
    console.log('✅ ALL TESTS PASSED! Gemini is working perfectly!');
  } else {
    console.log('⚠️  SOME TESTS FAILED. Check errors above.');
  }
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error);
