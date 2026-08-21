// ABOUTME: Live-quote router that prefers Yahoo Finance and falls back to Finnhub
// ABOUTME: Exists because Finnhub throttles Cloudflare's shared egress IPs, not this key's quota

import { fetchYahooQuote } from './yahooFinance.js';
import { fetchMarketStatus } from './finnhub.js';

/**
 * Fetch a live quote, trying each source in order of reliability from a Worker.
 *
 * Yahoo answers from Cloudflare's egress; Finnhub frequently does not. Finnhub
 * stays wired as a second source so a Yahoo outage degrades to the old behaviour
 * rather than to no quote at all. When both fail the caller falls back again, to
 * the last close from history.
 *
 * @param {string} ticker - Stock ticker symbol (e.g., 'AAPL')
 * @param {string} [finnhubApiKey] - Finnhub API key; without it Finnhub is skipped
 * @returns {Promise<Object>} Quote with isOpen, timestamp, currentPrice, change, changePercent, quoteAge, source, and companyName when the source supplies one
 * @throws {Error} The last source's error, carrying `isRateLimit` when Finnhub was throttled
 */
export async function fetchQuote(ticker, finnhubApiKey) {
  let yahooError;

  try {
    return await fetchYahooQuote(ticker);
  } catch (error) {
    yahooError = error;
    console.warn('[WARN] Yahoo quote failed, trying Finnhub', {
      ticker,
      error: error.message,
    });
  }

  if (!finnhubApiKey) {
    throw yahooError;
  }

  let quote;
  try {
    quote = await fetchMarketStatus(ticker, finnhubApiKey);
  } catch (finnhubError) {
    // Yahoo looked the symbol up and found nothing. That is a stronger answer than
    // "Finnhub was throttled", so carry it forward for the caller's error message.
    if (yahooError.isUnknownSymbol) {
      finnhubError.isUnknownSymbol = true;
    }
    throw finnhubError;
  }

  // No companyName here: Finnhub's quote endpoint does not carry one, and the
  // caller already holds a cached name for any ticker looked up in the last
  // three days. Leaving it undefined keeps that cached name in place.
  return { ...quote, source: 'finnhub' };
}
