#!/usr/bin/env node

import OpenAI from 'openai';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env') });

const apiKey = process.env.VITE_OPENAI_API_KEY || process.argv[2];

if (!apiKey) {
  console.error('❌ OPENAI_API_KEY not found!');
  console.error('\nUsage:');
  console.error('  node scripts/list-openai-models.mjs YOUR_API_KEY');
  console.error('  or set VITE_OPENAI_API_KEY in .env file');
  process.exit(1);
}

console.log('📋 Listing available OpenAI models...\n');
console.log(`Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}\n`);

const openai = new OpenAI({ apiKey });

try {
  const models = await openai.models.list();
  
  const chatModels = models.data
    .filter(model => 
      model.id.includes('gpt') || 
      model.id.includes('o1') || 
      model.id.includes('o3')
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  
  console.log(`✅ Found ${chatModels.length} chat models:\n`);
  
  const categorized = {
    'GPT-4o': [],
    'GPT-4': [],
    'GPT-3.5': [],
    'o1/o3': [],
    'Other': []
  };
  
  chatModels.forEach(model => {
    if (model.id.includes('gpt-4o')) {
      categorized['GPT-4o'].push(model.id);
    } else if (model.id.includes('gpt-4')) {
      categorized['GPT-4'].push(model.id);
    } else if (model.id.includes('gpt-3.5')) {
      categorized['GPT-3.5'].push(model.id);
    } else if (model.id.includes('o1') || model.id.includes('o3')) {
      categorized['o1/o3'].push(model.id);
    } else {
      categorized['Other'].push(model.id);
    }
  });
  
  Object.entries(categorized).forEach(([category, models]) => {
    if (models.length > 0) {
      console.log(`\n📦 ${category}:`);
      models.forEach(id => console.log(`   - ${id}`));
    }
  });
  
  console.log('\n\n💡 Recommended models for MarketMind:');
  console.log('   🌟 gpt-4o (best quality, vision support)');
  console.log('   ⚡ gpt-4o-mini (fast, cheap, great balance)');
  console.log('   🧠 o1-preview / o1-mini (reasoning models)');
  
  console.log('\n\n📊 Current MarketMind configuration:');
  console.log('   - gpt-4o ✅');
  console.log('   - gpt-4o-mini ✅');
  
} catch (error) {
  console.error('❌ Error listing models:', error.message);
  
  if (error.message.includes('401')) {
    console.log('\n⚠️ Invalid API key. Get one from: https://platform.openai.com/api-keys');
  }
}
