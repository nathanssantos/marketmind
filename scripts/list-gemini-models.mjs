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
  process.exit(1);
}

console.log('📋 Listing available Gemini models...\n');

const genAI = new GoogleGenerativeAI(apiKey);

try {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey);
  const data = await response.json();
  
  if (data.models) {
    console.log(`✅ Found ${data.models.length} models:\n`);
    
    data.models.forEach(model => {
      console.log(`📦 ${model.name.replace('models/', '')}`);
      if (model.displayName) console.log(`   Display Name: ${model.displayName}`);
      if (model.description) console.log(`   Description: ${model.description}`);
      if (model.supportedGenerationMethods) {
        console.log(`   Supported Methods: ${model.supportedGenerationMethods.join(', ')}`);
      }
      console.log('');
    });
    
    console.log('\n💡 Use these model names in MarketMind settings.');
  } else {
    console.log('❌ No models found or error:', data);
  }
} catch (error) {
  console.error('❌ Error fetching models:', error.message);
}
