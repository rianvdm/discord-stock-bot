// ABOUTME: Finnhub crypto API client for fetching real-time cryptocurrency quotes
// ABOUTME: Uses Finnhub's crypto endpoints for exchanges like Binance

import { CONFIG } from '../config.js';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

/**
 * Fetch real-time crypto quote from Finnhub
 * Finnhub crypto format: use exchange prefix (e.g., 'BINANCE:BTCUSDT')
 * 
 * @param {string} cryptoSymbol - Crypto symbol (e.g., 'BTC', 'ETH')
 * @param {string} apiKey - Finnhub API key
 * @returns {Promise<Object>} Crypto quote with current price, change, etc.
 * @throws {Error} If API request fails or data is invalid
 */
export async function fetchCryptoQuote(cryptoSymbol, apiKey) {
  // Map to Binance format (most liquid exchange)
  const binanceSymbol = `BINANCE:${cryptoSymbol}USDT`;
  const url = `${FINNHUB_BASE_URL}/quote?symbol=${binanceSymbol}&token=${apiKey}`;
  
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
        throw new Error(`Cryptocurrency ${cryptoSymbol} not found on Finnhub`);
      } else if (response.status === 429) {
        throw new Error('Finnhub API rate limit exceeded');
      } else if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid Finnhub API key');
      }
      throw new Error(`Finnhub API error: ${response.status}`);
    }

    const data = await response.json();
    const duration = Date.now() - startTime;

    console.log('[INFO] Finnhub crypto quote fetched', {
      symbol: cryptoSymbol,
      duration: `${duration}ms`,
      timestamp: data.t
    });

    // Validate response data
    // Finnhub returns: { c, d, dp, h, l, o, pc, t }
    // c = current price, t = timestamp (unix seconds)
    if (typeof data.t !== 'number' || typeof data.c !== 'number') {
      throw new Error('Invalid data received from Finnhub Crypto API');
    }

    // Check if data is valid (non-zero)
    if (data.c === 0 && data.pc === 0) {
      throw new Error(`No trading data available for ${cryptoSymbol}`);
    }

    // Crypto markets are 24/7, so we always consider them "open"
    // But we can check data freshness
    const currentTime = Math.floor(Date.now() / 1000);
    const quoteAge = currentTime - data.t;

    return {
      currentPrice: data.c,
      change: data.d,
      changePercent: data.dp,
      high: data.h,
      low: data.l,
      open: data.o,
      previousClose: data.pc,
      timestamp: data.t,
      quoteAge, // Age of the quote in seconds
      isOpen: true, // Crypto markets are always open
      exchange: 'BINANCE'
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error.name === 'AbortError') {
      console.error('[ERROR] Finnhub crypto request timeout', {
        symbol: cryptoSymbol,
        duration: `${duration}ms`,
        timeout: CONFIG.FINNHUB_TIMEOUT
      });
      throw new Error(`Finnhub Crypto API request timeout after ${CONFIG.FINNHUB_TIMEOUT}ms`);
    }

    console.error('[ERROR] Finnhub crypto request failed', {
      symbol: cryptoSymbol,
      duration: `${duration}ms`,
      error: error.message
    });
    
    throw error;
  }
}

/**
 * Fetch crypto candles (OHLC data) from Finnhub
 * @param {string} cryptoSymbol - Crypto symbol (e.g., 'BTC', 'ETH')
 * @param {string} resolution - Time resolution (1, 5, 15, 30, 60, D, W, M)
 * @param {number} from - Unix timestamp (seconds)
 * @param {number} to - Unix timestamp (seconds)
 * @param {string} apiKey - Finnhub API key
 * @returns {Promise<Object>} Candle data
 */
export async function fetchCryptoCandles(cryptoSymbol, resolution, from, to, apiKey) {
  const binanceSymbol = `BINANCE:${cryptoSymbol}USDT`;
  const url = `${FINNHUB_BASE_URL}/crypto/candle?symbol=${binanceSymbol}&resolution=${resolution}&from=${from}&to=${to}&token=${apiKey}`;
  
  const startTime = Date.now();
  
  try {
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

    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status}`);
    }

    const data = await response.json();
    const duration = Date.now() - startTime;

    console.log('[INFO] Finnhub crypto candles fetched', {
      symbol: cryptoSymbol,
      duration: `${duration}ms`,
      candles: data.c?.length || 0
    });

    // Validate response
    if (data.s !== 'ok' || !data.c || data.c.length === 0) {
      throw new Error('No candle data available');
    }

    return {
      closePrices: data.c,
      highPrices: data.h,
      lowPrices: data.l,
      openPrices: data.o,
      timestamps: data.t,
      volumes: data.v,
      status: data.s
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('[ERROR] Finnhub crypto candles failed', {
      symbol: cryptoSymbol,
      duration: `${duration}ms`,
      error: error.message
    });
    
    throw error;
  }
}
