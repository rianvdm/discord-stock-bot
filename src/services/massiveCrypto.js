// ABOUTME: Massive.com crypto API client for fetching cryptocurrency data
// ABOUTME: Handles crypto-specific endpoints with timeout handling and retry logic

import { CONFIG } from '../config.js';

const MASSIVE_BASE_URL = 'https://api.massive.com';

/**
 * Fetch historical cryptocurrency data from Massive.com
 * @param {string} polygonTicker - Polygon.io crypto ticker (e.g., 'X:BTCUSD')
 * @param {number} days - Number of days of historical data to fetch
 * @param {string} apiKey - Massive.com API key
 * @returns {Promise<Object>} Historical data with closing prices and timestamps
 * @throws {Error} If API request fails or data is invalid
 */
export async function fetchCryptoHistoricalData(polygonTicker, days, apiKey) {
  // Calculate date range in YYYY-MM-DD format
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  
  const to = toDate.toISOString().split('T')[0];
  const from = fromDate.toISOString().split('T')[0];

  const url = `${MASSIVE_BASE_URL}/v2/aggs/ticker/${polygonTicker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&apiKey=${apiKey}`;
  
  const data = await fetchWithRetry(url, {
    method: 'GET',
  });

  // Validate response data
  if (!data || !data.results || !Array.isArray(data.results)) {
    throw new Error('No historical data available for this cryptocurrency');
  }

  if (data.results.length === 0) {
    throw new Error('No historical data available for this cryptocurrency');
  }

  // Extract closing prices and timestamps
  const closingPrices = data.results.map(r => r.c);
  const timestamps = data.results.map(r => Math.floor(r.t / 1000)); // Convert from ms to seconds

  return {
    closingPrices,
    timestamps,
    status: 'ok'
  };
}

/**
 * Fetch current crypto quote from Massive.com
 * @param {string} polygonTicker - Polygon.io crypto ticker (e.g., 'X:BTCUSD')
 * @param {string} apiKey - Massive.com API key
 * @returns {Promise<Object>} Quote data with current price, change, etc.
 * @throws {Error} If API request fails or data is invalid
 */
export async function fetchCryptoQuote(polygonTicker, apiKey) {
  const url = `${MASSIVE_BASE_URL}/v2/aggs/ticker/${polygonTicker}/prev?adjusted=true&apiKey=${apiKey}`;
  
  const data = await fetchWithRetry(url, {
    method: 'GET',
  });

  // Validate response data
  if (!data || !data.results || data.results.length === 0) {
    throw new Error('Invalid data received from Massive.com API');
  }

  const result = data.results[0];
  
  // Validate required fields
  if (typeof result.c !== 'number' || typeof result.o !== 'number') {
    throw new Error('Invalid data received from Massive.com API');
  }

  // Transform Massive.com response to our format
  const changeAmount = result.c - result.o;
  const changePercent = ((result.c - result.o) / result.o) * 100;
  
  return {
    ticker: polygonTicker,
    currentPrice: result.c,
    changeAmount: changeAmount,
    changePercent: changePercent,
    high: result.h,
    low: result.l,
    open: result.o,
    previousClose: result.o,
    timestamp: Math.floor(result.t / 1000), // Convert from ms to seconds
    volume: result.v || 0
  };
}

/**
 * Fetch with timeout, retry logic, and error handling
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {Error} If request fails after retries
 */
async function fetchWithRetry(url, options = {}) {
  const maxRetries = 1;
  let lastError;
  const startTime = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const attemptStart = Date.now();
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.MASSIVE_TIMEOUT);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      // Handle HTTP errors
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Cryptocurrency not found');
        }
        throw new Error(`Massive.com API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Performance: Log API response time
      const duration = Date.now() - attemptStart;
      const totalDuration = Date.now() - startTime;
      console.log('[PERF] Massive.com Crypto API response time', {
        duration: `${duration}ms`,
        totalDuration: `${totalDuration}ms`,
        attempt: attempt + 1,
        cached: false,
      });
      
      // Debug: log response for troubleshooting
      console.log('[DEBUG] Massive.com Crypto API response:', JSON.stringify(data).substring(0, 200));
      
      // Check for API error in response body (Massive.com returns 200 with error field)
      if (data.status === 'ERROR' || data.error) {
        throw new Error(data.error || data.message || 'Unknown API error');
      }
      
      return data;

    } catch (error) {
      lastError = error;

      // Don't retry on 404, validation errors, or abort/timeout errors
      if (error.message.includes('not found') || 
          error.message.includes('Invalid data') ||
          error.message.includes('aborted') ||
          error.name === 'AbortError') {
        throw error;
      }

      // If this wasn't the last attempt, wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, etc.
        await new Promise(resolve => setTimeout(resolve, delay));
        console.warn(`[WARN] Massive.com crypto request failed, retrying (attempt ${attempt + 2}/${maxRetries + 1})`, {
          error: error.message,
          url
        });
      }
    }
  }

  // All retries exhausted
  console.error('[ERROR] Massive.com crypto request failed after all retries', {
    error: lastError?.message,
    url
  });
  throw lastError;
}
