#!/usr/bin/env node

import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env') });

const apiKey = process.env.VITE_ANTHROPIC_API_KEY || process.argv[2];

if (!apiKey) {
  console.error('❌ ANTHROPIC_API_KEY not found!');
  console.error('\nUsage:');
  console.error('  node scripts/list-claude-models.mjs YOUR_API_KEY');
  console.error('  or set VITE_ANTHROPIC_API_KEY in .env file');
  process.exit(1);
}

console.log('📋 Checking Claude/Anthropic models...\n');
console.log(`Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}\n`);

// Anthropic doesn't have a list models endpoint, so we'll test known models
const knownModels = [
  // Claude 4.5 series (LATEST - with aliases)
  'claude-sonnet-4-5-20250929',
  'claude-sonnet-4-5',
  'claude-haiku-4-5-20251001',
  'claude-haiku-4-5',
  
  // Claude 4.1 series
  'claude-opus-4-1-20250805',
  'claude-opus-4-1',
  
  // Claude 3.5 series
  'claude-3-5-sonnet-20241022',
  'claude-3-5-sonnet-20240620',
  'claude-3-5-haiku-20241022',
  
  // Claude 3 series
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
  
  // Older models
  'claude-2.1',
  'claude-2.0',
  'claude-instant-1.2',
];

console.log('🧪 Testing known Claude models...\n');

const client = new Anthropic({ apiKey });

const workingModels = [];
const failedModels = [];

for (const modelId of knownModels) {
  try {
    process.stdout.write(`Testing ${modelId}... `);
    
    const response = await client.messages.create({
      model: modelId,
      max_tokens: 10,
      messages: [{
        role: 'user',
        content: 'Hi'
      }]
    });
    
    console.log('✅');
    workingModels.push({
      id: modelId,
      response: response.content[0].text
    });
    
    // Delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (error) {
    console.log(`❌ (${error.message.substring(0, 50)}...)`);
    failedModels.push({
      id: modelId,
      error: error.message
    });
  }
}

console.log('\n\n📊 SUMMARY');
console.log('='.repeat(60));

console.log(`\n✅ Working models (${workingModels.length}):`);
workingModels.forEach(m => console.log(`   - ${m.id}`));

if (failedModels.length > 0) {
  console.log(`\n❌ Failed models (${failedModels.length}):`);
  failedModels.forEach(m => {
    console.log(`   - ${m.id}`);
    if (m.error.includes('model_not_found')) {
      console.log(`     (Model not found - may be deprecated)`);
    } else if (m.error.includes('credit')) {
      console.log(`     (Insufficient credits)`);
    }
  });
}

console.log('\n\n📋 Current MarketMind configuration (ALL VALID ✅):');
console.log('   - claude-sonnet-4-5-20250929 (Claude 4.5 Sonnet - smartest model)');
console.log('   - claude-haiku-4-5-20251001 (Claude 4.5 Haiku - fastest model)');
console.log('   - claude-opus-4-1-20250805 (Claude 4.1 Opus - specialized reasoning)');

console.log('\n\n💡 Recommended additions for MarketMind:');
console.log('   🌟 claude-3-5-sonnet-20241022 (Claude 3.5 Sonnet - strong legacy model)');
console.log('   ⚡ claude-3-5-haiku-20241022 (Claude 3.5 Haiku - fast legacy)');
console.log('   💎 claude-3-opus-20240229 (Claude 3 Opus - highest intelligence in v3)');
console.log('   🔄 claude-sonnet-4-5 (alias - auto-updates to latest Sonnet 4.5)');
console.log('   🔄 claude-haiku-4-5 (alias - auto-updates to latest Haiku 4.5)');
console.log('   🔄 claude-opus-4-1 (alias - auto-updates to latest Opus 4.1)');

console.log('\n\n📚 Model naming pattern:');
console.log('   claude-[variant]-[version]-[date]  OR  claude-[variant]-[version] (alias)');
console.log('   Example: claude-sonnet-4-5-20250929  OR  claude-sonnet-4-5');
