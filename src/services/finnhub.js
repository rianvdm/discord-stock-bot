// ABOUTME: Finnhub API client for fetching stock quotes and historical data
// ABOUTME: Includes timeout handling, retry logic, and ticker suggestion functionality

import { CONFIG } from '../config.js';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

/**
 * Common ticker misspellings and their corrections
 */
const COMMON_TICKER_CORRECTIONS = {
  'APPL': 'AAPL',
  'GOGL': 'GOOGL',
  'GOOGL': 'GOOGL',
  'GOOG': 'GOOG',
  'MSFT': 'MSFT',
  'AMZN': 'AMZN',
  'TSLA': 'TSLA',
  'META': 'META',
  'NVDA': 'NVDA',
  'NFLX': 'NFLX',
  'CLOUDFLARE': 'NET',
  'NET': 'NET',
  'AAPL': 'AAPL',
};

/**
 * Popular tickers for partial match suggestions
 */
const POPULAR_TICKERS = [
  'AAPL', 'GOOGL', 'GOOG', 'MSFT', 'AMZN', 'TSLA', 'META', 
  'NVDA', 'NFLX', 'NET', 'AMD', 'INTC', 'DIS', 'BA', 'V', 'JPM'
];

/**
 * Fetch current stock quote from Finnhub
 * @param {string} ticker - Stock ticker symbol (e.g., 'AAPL')
 * @param {string} apiKey - Finnhub API key
 * @returns {Promise<Object>} Quote data with current price, change, etc.
 * @throws {Error} If API request fails or data is invalid
 */
export async function fetchQuote(ticker, apiKey) {
  const url = `${FINNHUB_BASE_URL}/quote?symbol=${ticker}&token=${apiKey}`;
  
  const data = await fetchWithRetry(url, {
    method: 'GET',
  });

  // Validate response data
  if (!data || typeof data.c !== 'number' || typeof data.pc !== 'number') {
    throw new Error('Invalid data received from Finnhub API');
  }

  // Transform Finnhub response to our format
  return {
    currentPrice: data.c,
    change: data.c - data.pc,
    changePercent: ((data.c - data.pc) / data.pc) * 100,
    high: data.h,
    low: data.l,
    open: data.o,
    previousClose: data.pc,
    timestamp: data.t
  };
}

/**
 * Fetch historical stock data from Finnhub
 * @param {string} ticker - Stock ticker symbol
 * @param {number} days - Number of days of historical data to fetch
 * @param {string} apiKey - Finnhub API key
 * @returns {Promise<Object>} Historical data with closing prices and timestamps
 * @throws {Error} If API request fails or data is invalid
 */
export async function fetchHistoricalData(ticker, days, apiKey) {
  // Calculate timestamps for date range
  const to = Math.floor(Date.now() / 1000); // Current time in seconds
  const from = to - (days * 24 * 60 * 60); // N days ago in seconds

  const url = `${FINNHUB_BASE_URL}/stock/candle?symbol=${ticker}&resolution=D&from=${from}&to=${to}&token=${apiKey}`;
  
  const data = await fetchWithRetry(url, {
    method: 'GET',
  });

  // Check for no_data status
  if (data.s === 'no_data') {
    throw new Error('No historical data available for this ticker');
  }

  // Validate response data
  if (!data || !Array.isArray(data.c) || !Array.isArray(data.t)) {
    throw new Error('Invalid historical data received from Finnhub API');
  }

  return {
    closingPrices: data.c,
    timestamps: data.t,
    status: data.s
  };
}

/**
 * Suggest alternative ticker symbols for potential typos
 * @param {string} ticker - User-entered ticker symbol
 * @returns {string[]} Array of suggested ticker symbols
 */
export function suggestTickers(ticker) {
  if (!ticker || ticker.length === 0) {
    return [];
  }

  const upperTicker = ticker.toUpperCase();
  const suggestions = new Set();

  // Check for exact match in corrections
  if (COMMON_TICKER_CORRECTIONS[upperTicker]) {
    suggestions.add(COMMON_TICKER_CORRECTIONS[upperTicker]);
  }

  // Check for partial matches in popular tickers
  if (upperTicker.length >= 2) {
    for (const popularTicker of POPULAR_TICKERS) {
      // Exact match
      if (popularTicker === upperTicker) {
        suggestions.add(popularTicker);
      }
      // Starts with the input
      else if (popularTicker.startsWith(upperTicker)) {
        suggestions.add(popularTicker);
      }
      // Levenshtein distance of 1 (one character different)
      else if (isCloseMatch(upperTicker, popularTicker)) {
        suggestions.add(popularTicker);
      }
    }
  }

  // Limit to 5 suggestions
  return Array.from(suggestions).slice(0, 5);
}

/**
 * Check if two strings are close matches (Levenshtein distance <= 1)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {boolean} True if strings differ by at most 1 character
 */
function isCloseMatch(str1, str2) {
  if (Math.abs(str1.length - str2.length) > 1) {
    return false;
  }

  let differences = 0;
  const maxLen = Math.max(str1.length, str2.length);
  
  for (let i = 0; i < maxLen; i++) {
    if (str1[i] !== str2[i]) {
      differences++;
      if (differences > 1) {
        return false;
      }
    }
  }

  return differences === 1;
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

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.FINNHUB_TIMEOUT);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle HTTP errors
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Stock ticker not found');
        }
        throw new Error(`Finnhub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
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
        console.warn(`[WARN] Finnhub request failed, retrying (attempt ${attempt + 2}/${maxRetries + 1})`, {
          error: error.message,
          url
        });
      }
    }
  }

  // All retries exhausted
  console.error('[ERROR] Finnhub request failed after all retries', {
    error: lastError?.message,
    url
  });
  throw lastError;
}
