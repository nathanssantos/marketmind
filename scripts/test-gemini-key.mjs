#!/usr/bin/env node

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env') });

const apiKey = process.env.VITE_GEMINI_API_KEY || process.argv[2];

if (!apiKey) {
  console.error('❌ GEMINI_API_KEY not found!');
  console.error('\nUsage:');
  console.error('  node scripts/test-gemini-key.mjs YOUR_API_KEY');
  console.error('  or set VITE_GEMINI_API_KEY in .env file');
  process.exit(1);
}

console.log('🔑 Testing Gemini API Key...\n');
console.log(`Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}\n`);

const genAI = new GoogleGenerativeAI(apiKey);

const modelsToTest = [
  'gemini-3-pro-preview',
  'gemini-2.0-flash-exp',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
];

async function testModel(modelName) {
  try {
    console.log(`\n📝 Testing: ${modelName}`);
    
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 100,
      },
    });

    const result = await model.generateContent('Say "Hello, this is working!" in one sentence.');
    const response = await result.response;
    const text = response.text();

    console.log(`✅ SUCCESS: ${modelName}`);
    console.log(`   Response: ${text.substring(0, 100)}...`);
    return { model: modelName, status: 'success', text };
  } catch (error) {
    console.log(`❌ FAILED: ${modelName}`);
    console.log(`   Error: ${error.message}`);
    return { model: modelName, status: 'failed', error: error.message };
  }
}

async function main() {
  const results = [];

  for (const modelName of modelsToTest) {
    const result = await testModel(modelName);
    results.push(result);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n\n📊 SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed');

  console.log(`\n✅ Working models (${successful.length}):`);
  successful.forEach(r => console.log(`   - ${r.model}`));

  console.log(`\n❌ Failed models (${failed.length}):`);
  failed.forEach(r => {
    console.log(`   - ${r.model}`);
    console.log(`     ${r.error}`);
  });

  if (successful.length > 0) {
    console.log(`\n✨ Recommended model: ${successful[0].model}`);
  } else {
    console.log('\n⚠️ No models working. Please check:');
    console.log('   1. API key is valid (get it from https://aistudio.google.com/apikey)');
    console.log('   2. API is enabled in your Google Cloud project');
    console.log('   3. Your region is supported');
  }
}

main().catch(console.error);
