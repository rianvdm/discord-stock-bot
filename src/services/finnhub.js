// ABOUTME: Finnhub API client for fetching real-time stock market status
// ABOUTME: Uses Finnhub's real-time quote endpoint to determine if market is currently open

import { CONFIG } from '../config.js';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

/**
 * Fetch market status for a given ticker from Finnhub
 * Uses the real-time quote endpoint to determine if market is open
 * 
 * @param {string} ticker - Stock ticker symbol (e.g., 'AAPL')
 * @param {string} apiKey - Finnhub API key
 * @returns {Promise<Object>} Market status with isOpen boolean and timestamp
 * @throws {Error} If API request fails or data is invalid
 */
export async function fetchMarketStatus(ticker, apiKey) {
  const url = `${FINNHUB_BASE_URL}/quote?symbol=${ticker}&token=${apiKey}`;
  
  const startTime = Date.now();
  
  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.FINNHUB_TIMEOUT);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    clearTimeout(timeoutId);

    // Handle HTTP errors
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Ticker ${ticker} not found on Finnhub`);
      } else if (response.status === 429) {
        throw new Error('Finnhub API rate limit exceeded');
      } else if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid Finnhub API key');
      }
      throw new Error(`Finnhub API error: ${response.status}`);
    }

    const data = await response.json();
    const duration = Date.now() - startTime;

    console.log('[INFO] Finnhub quote fetched', {
      ticker,
      duration: `${duration}ms`,
      timestamp: data.t
    });

    // Validate response data
    // Finnhub returns: { c, d, dp, h, l, o, pc, t }
    // c = current price, t = timestamp (unix seconds)
    // If t is 0 or very old, market is closed
    if (typeof data.t !== 'number' || typeof data.c !== 'number') {
      throw new Error('Invalid data received from Finnhub API');
    }

    // Determine if market is open based on data freshness
    // If the quote timestamp is within the last 5 minutes, consider market open
    const currentTime = Math.floor(Date.now() / 1000); // Current time in unix seconds
    const quoteAge = currentTime - data.t; // Age of quote in seconds
    const isOpen = quoteAge < 300; // Market is open if quote is less than 5 minutes old

    return {
      isOpen,
      timestamp: data.t,
      currentPrice: data.c,
      change: data.d,
      changePercent: data.dp,
      quoteAge // Age of the quote in seconds
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error.name === 'AbortError') {
      console.error('[ERROR] Finnhub request timeout', {
        ticker,
        duration: `${duration}ms`,
        timeout: CONFIG.FINNHUB_TIMEOUT
      });
      throw new Error(`Finnhub API request timeout after ${CONFIG.FINNHUB_TIMEOUT}ms`);
    }

    console.error('[ERROR] Finnhub request failed', {
      ticker,
      duration: `${duration}ms`,
      error: error.message
    });
    
    throw error;
  }
}
