// ABOUTME: Manual test script for Massive.com API integration
// ABOUTME: Tests real API calls with your actual API key from .dev.vars

import { fetchQuote, fetchHistoricalData, suggestTickers } from '../src/services/massive.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load API key from .dev.vars
function loadApiKey() {
  const devVarsPath = path.join(__dirname, '..', '.dev.vars');
  
  if (!fs.existsSync(devVarsPath)) {
    console.error('❌ .dev.vars file not found!');
    console.error('   Create .dev.vars in the project root with:');
    console.error('   MASSIVE_API_KEY=your_api_key_here');
    process.exit(1);
  }

  const content = fs.readFileSync(devVarsPath, 'utf-8');
  const match = content.match(/MASSIVE_API_KEY=(.+)/);
  
  if (!match) {
    console.error('❌ MASSIVE_API_KEY not found in .dev.vars');
    process.exit(1);
  }

  return match[1].trim();
}

async function testMassive() {
  console.log('🧪 Testing Massive.com API Integration\n');
  console.log('═'.repeat(60));
  
  const apiKey = loadApiKey();
  console.log('✅ API key loaded from .dev.vars\n');

  // Test 1: Fetch quote for Apple
  console.log('📊 Test 1: Fetching quote for AAPL...');
  console.log('─'.repeat(60));
  try {
    const quote = await fetchQuote('AAPL', apiKey);
    console.log('✅ Success!');
    console.log(`   Current Price: $${quote.currentPrice.toFixed(2)}`);
    console.log(`   Change: $${quote.change.toFixed(2)} (${quote.changePercent.toFixed(2)}%)`);
    console.log(`   High: $${quote.high.toFixed(2)}`);
    console.log(`   Low: $${quote.low.toFixed(2)}`);
    console.log(`   Open: $${quote.open.toFixed(2)}`);
    console.log(`   Previous Close: $${quote.previousClose.toFixed(2)}`);
    console.log(`   Timestamp: ${new Date(quote.timestamp * 1000).toLocaleString()}`);
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
  console.log();

  // Test 2: Fetch historical data
  console.log('📈 Test 2: Fetching 7-day historical data for NET...');
  console.log('─'.repeat(60));
  try {
    const history = await fetchHistoricalData('NET', 7, apiKey);
    console.log('✅ Success!');
    console.log(`   Data points: ${history.closingPrices.length}`);
    console.log(`   Closing prices: $${history.closingPrices.map(p => p.toFixed(2)).join(', $')}`);
    console.log(`   Status: ${history.status}`);
    
    if (history.closingPrices.length > 0) {
      const first = history.closingPrices[0];
      const last = history.closingPrices[history.closingPrices.length - 1];
      const change = ((last - first) / first * 100).toFixed(2);
      console.log(`   7-day change: ${change}%`);
    }
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
  console.log();

  // Test 3: Test ticker suggestions
  console.log('🔍 Test 3: Testing ticker suggestions...');
  console.log('─'.repeat(60));
  const typos = ['APPL', 'GOGL', 'MSFT', 'TSLA'];
  for (const typo of typos) {
    const suggestions = suggestTickers(typo);
    console.log(`   "${typo}" → [${suggestions.join(', ')}]`);
  }
  console.log();

  // Test 4: Test invalid ticker
  console.log('❌ Test 4: Testing invalid ticker (should fail gracefully)...');
  console.log('─'.repeat(60));
  try {
    await fetchQuote('INVALIDTICKER123', apiKey);
    console.log('⚠️  Unexpected success - this should have failed');
  } catch (error) {
    console.log('✅ Correctly rejected invalid ticker');
    console.log(`   Error: ${error.message}`);
  }
  console.log();

  console.log('═'.repeat(60));
  console.log('✅ All tests complete!\n');
}

// Run tests
testMassive().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
