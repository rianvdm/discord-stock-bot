// ABOUTME: Finnhub API client for real-time stock quotes, used as the fallback quote source
// ABOUTME: Primary is Yahoo Finance, because Finnhub throttles Cloudflare's shared egress IPs

import { CONFIG } from '../config.js';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

/**
 * Error thrown when Finnhub responds 429. Carries `isRateLimit` so callers can
 * distinguish throttling from a genuinely unknown ticker — the two used to be
 * conflated and surfaced to users as "ticker not found".
 */
export class FinnhubRateLimitError extends Error {
  constructor(message = 'Finnhub API rate limit exceeded') {
    super(message);
    this.name = 'FinnhubRateLimitError';
    this.isRateLimit = true;
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch market status, retrying on 429.
 *
 * Finnhub throttles by source as well as by key: Workers egress from shared
 * Cloudflare IPs, so a request can be rate limited while the key's own quota is
 * largely unused (observed 2026-08-18 — the Worker got 429s while the same key
 * from a laptop reported x-ratelimit-remaining: 44 of 60). Those 429s are
 * transient, so a couple of short retries usually clears them.
 *
 * @param {string} ticker - Stock ticker symbol (e.g., 'AAPL')
 * @param {string} apiKey - Finnhub API key
 * @returns {Promise<Object>} Market status with isOpen boolean and timestamp
 * @throws {FinnhubRateLimitError} If still rate limited after retries
 * @throws {Error} If API request fails or data is invalid
 */
export async function fetchMarketStatus(ticker, apiKey) {
  const maxAttempts = CONFIG.FINNHUB_MAX_ATTEMPTS;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetchMarketStatusOnce(ticker, apiKey);
    } catch (error) {
      lastError = error;

      // Only 429s are worth retrying. A bad key or unknown ticker will not fix
      // itself, and retrying would just burn more of the per-minute quota.
      if (!error.isRateLimit || attempt === maxAttempts) {
        throw error;
      }

      // Exponential backoff with jitter, so parallel invocations do not retry
      // in lockstep and re-trigger the same throttle.
      const backoff = CONFIG.FINNHUB_RETRY_BASE_MS * Math.pow(2, attempt - 1);
      const delay = backoff + Math.floor(Math.random() * CONFIG.FINNHUB_RETRY_BASE_MS);
      console.warn('[WARN] Finnhub rate limited, retrying', {
        ticker,
        attempt,
        maxAttempts,
        delay: `${delay}ms`
      });
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Single market-status attempt. Split out so retry logic stays readable.
 * @param {string} ticker - Stock ticker symbol
 * @param {string} apiKey - Finnhub API key
 * @returns {Promise<Object>} Market status
 */
async function fetchMarketStatusOnce(ticker, apiKey) {
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
        throw new FinnhubRateLimitError();
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

    // Finnhub answers 200 with every field zeroed when it has no trade for the
    // symbol: an unknown ticker, or a new listing before its first trade. That
    // is the absence of a quote, and the caller treats a quote as proof that the
    // ticker exists, so it must not pass as a $0 price.
    if (data.c <= 0) {
      throw new Error(`Finnhub has no price for ${ticker}`);
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
