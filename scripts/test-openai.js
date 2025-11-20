// ABOUTME: Test script to verify OpenAI service works with real API credentials
// ABOUTME: Run this to confirm OpenAI integration before deployment

import { generateAISummary } from '../src/services/openai.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .dev.vars manually
const devVarsPath = path.join(__dirname, '..', '.dev.vars');

if (fs.existsSync(devVarsPath)) {
  const content = fs.readFileSync(devVarsPath, 'utf-8');
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  }
  console.log('✅ Loaded .dev.vars file\n');
} else {
  console.error('❌ .dev.vars file not found!');
  console.error('Please create .dev.vars in project root with:');
  console.error('OPENAI_API_KEY=your_key_here\n');
  process.exit(1);
}

async function testOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found in .dev.vars');
    console.error('Please add: OPENAI_API_KEY=your_key_here\n');
    process.exit(1);
  }

  console.log('🧪 Testing OpenAI Service\n');
  console.log('API Key:', apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4));
  console.log('');

  // Test cases
  const testCases = [
    { ticker: 'AAPL', companyName: 'Apple Inc.' },
    { ticker: 'NET', companyName: 'Cloudflare Inc.' },
    { ticker: 'TSLA', companyName: 'Tesla Inc.' },
  ];

  for (const testCase of testCases) {
    try {
      console.log(`\n📊 Testing ${testCase.ticker} (${testCase.companyName})...`);
      console.log('─'.repeat(80));
      
      const startTime = Date.now();
      const summary = await generateAISummary(testCase.ticker, testCase.companyName, apiKey);
      const duration = Date.now() - startTime;
      
      console.log('✅ Success!');
      console.log(`⏱️  Response time: ${duration}ms`);
      console.log(`📝 Summary (${summary.length} chars):\n`);
      console.log(summary);
      console.log('\n' + '─'.repeat(80));
      
      // Validate summary
      const sentenceCount = (summary.match(/[.!?]+/g) || []).length;
      console.log(`📏 Sentence count: ${sentenceCount}`);
      
      if (sentenceCount < 2) {
        console.warn('⚠️  Warning: Summary seems too short (< 2 sentences)');
      } else if (sentenceCount > 6) {
        console.warn('⚠️  Warning: Summary seems too long (> 6 sentences)');
      } else {
        console.log('✅ Summary length is appropriate');
      }
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      console.error('Full error:', error);
    }
  }

  console.log('\n\n🎉 OpenAI service testing complete!');
}

testOpenAI().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
