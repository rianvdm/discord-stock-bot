// Quick test script to verify Finnhub integration
// Run: node test-finnhub.js

import { fetchMarketStatus } from '../src/services/finnhub.js';

const FINNHUB_API_KEY = 'd4f4qjpr01qkcvvgj5jgd4f4qjpr01qkcvvgj5k0';

async function testFinnhub() {
  console.log('🧪 Testing Finnhub Integration\n');
  
  // Test 1: Regular stock (should be closed outside market hours)
  console.log('Test 1: AAPL (Regular stock)');
  try {
    const aapl = await fetchMarketStatus('AAPL', FINNHUB_API_KEY);
    console.log('✅ Success!');
    console.log('   Market Status:', aapl.isOpen ? '🟢 OPEN' : '🔴 CLOSED');
    console.log('   Current Price: $' + aapl.currentPrice);
    console.log('   Quote Age:', Math.floor(aapl.quoteAge / 60), 'minutes old');
    console.log('   Change: $' + aapl.change + ' (' + aapl.changePercent.toFixed(2) + '%)');
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\nTest 2: GOOGL (Another stock)');
  try {
    const googl = await fetchMarketStatus('GOOGL', FINNHUB_API_KEY);
    console.log('✅ Success!');
    console.log('   Market Status:', googl.isOpen ? '🟢 OPEN' : '🔴 CLOSED');
    console.log('   Current Price: $' + googl.currentPrice);
    console.log('   Quote Age:', Math.floor(googl.quoteAge / 60), 'minutes old');
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\nTest 3: Invalid Ticker (Should fail gracefully)');
  try {
    const invalid = await fetchMarketStatus('INVALID123', FINNHUB_API_KEY);
    console.log('✅ Got response:', invalid);
  } catch (error) {
    console.log('✅ Correctly rejected:', error.message);
  }
  
  console.log('\n✨ Testing complete!');
}

testFinnhub();
