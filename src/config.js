// ABOUTME: Configuration constants for the Discord Stock Bot
// ABOUTME: Contains rate limits, cache TTLs, timeouts, and display settings

/**
 * Global configuration constants for the Discord Stock Bot
 * 
 * @constant {Object} CONFIG
 * @property {number} RATE_LIMIT_WINDOW_SECONDS - Rate limit window in seconds
 * @property {number} RATE_LIMIT_MAX_REQUESTS - Maximum requests allowed per window (5 per minute)
 * @property {number} CACHE_TTL_PRICE - Cache TTL for stock prices in seconds (5 minutes)
 * @property {number} CACHE_TTL_HISTORY - Cache TTL for historical data in seconds (1 hour)
 * @property {number} CACHE_TTL_SUMMARY - Cache TTL for AI summaries in seconds (8 hours)
 * @property {number} DEFAULT_PERIOD_DAYS - Default number of days for historical data
 * @property {number} STOCK_HISTORY_DAYS - Calendar days to fetch for stocks to get ~30 trading days
 * @property {number} CRYPTO_HISTORY_DAYS - Calendar days to fetch for crypto (trades 24/7)
 * @property {number} MASSIVE_TIMEOUT - API timeout for Massive.com requests in milliseconds
 * @property {number} WAIT_UNTIL_LIMIT - Workers' ctx.waitUntil() limit after the response, in milliseconds
 * @property {number} OPENAI_TIMEOUT - API timeout for OpenAI requests in milliseconds
 * @property {string} AI_SUMMARY_PROVIDER - Active AI summary provider ('perplexity' or 'openai')
 * @property {number} PERPLEXITY_TIMEOUT - API timeout for Perplexity requests in milliseconds
 * @property {string[]} SUPPORTED_MARKETS - Supported stock markets (currently US only)
 * @property {number} CHART_HEIGHT - ASCII sparkline chart height (number of characters)
 * @property {number} EMBED_COLOR_POSITIVE - Discord embed color for positive price changes (green)
 * @property {number} EMBED_COLOR_NEGATIVE - Discord embed color for negative price changes (red)
 * @property {number} EMBED_COLOR_NEUTRAL - Discord embed color for neutral/no change (gray)
 */
export const CONFIG = {
  // Rate Limiting
  RATE_LIMIT_WINDOW_SECONDS: 60,  // Time window for rate limiting (seconds)
  RATE_LIMIT_MAX_REQUESTS: 5,     // Max requests allowed per window

  // Cache TTLs (seconds)
  CACHE_TTL_PRICE: 300,        // 5 minutes
  CACHE_TTL_HISTORY: 3600,     // 1 hour
  CACHE_TTL_SUMMARY: 28800,    // 8 hours
  CACHE_TTL_COMPANY_PROFILE: 259200,  // 3 days (company names rarely change)
  CACHE_TTL_MARKET_STATUS: 60, // 1 minute (market status changes frequently)

  // Stock Data
  DEFAULT_PERIOD_DAYS: 30,     // Future: make configurable per command
  STOCK_HISTORY_DAYS: 42,      // Request 42 calendar days to get ~30 trading days (excluding weekends)
  CRYPTO_HISTORY_DAYS: 30,     // Crypto trades 24/7, so 30 calendar days = 30 data points

  // API Timeouts (milliseconds)
  // Commands run inside ctx.waitUntil() after the deferred reply, and Workers cancel
  // waitUntil work 30 seconds after the response, silently: the user never gets a
  // follow-up. Discord's 15-minute follow-up window doesn't help, because the Worker
  // is gone by then. So the whole command, including its error follow-up, must
  // finish inside WAIT_UNTIL_LIMIT. The AI summary is optional, so it gets the
  // shortest leash that still fits it; a slow summary is dropped and the price posts.
  WAIT_UNTIL_LIMIT: 30000,  // Workers platform limit, not tunable
  MASSIVE_TIMEOUT: 10000,   // 10 seconds for stock data
  OPENAI_TIMEOUT: 20000,    // 20 seconds for AI summary with web search (7-day max seen: 16.4 s)
  PERPLEXITY_TIMEOUT: 20000, // 20 seconds for AI summary with web search
  FINNHUB_TIMEOUT: 5000,    // 5 seconds for real-time market status check
  YAHOO_TIMEOUT: 5000,      // 5 seconds for the primary live quote
  COMMAND_TIMEOUT: 25000,   // 25 seconds overall, leaving time to send the error follow-up

  // Finnhub 429 retry. Finnhub throttles by source as well as by key, and Workers
  // share Cloudflare egress IPs, so quotes can be rate limited even when the key's
  // own quota is mostly unused. Measured from the PDX colo on 2026-08-21: 13 of 20
  // calls returned an nginx 429 carrying no x-ratelimit-* headers, while the calls
  // that got through reported 58 of 60 remaining on the key. Finnhub is therefore
  // the fallback quote source, not the primary one, and these retries only cover
  // the case where Yahoo is also unavailable.
  // Worst case added latency: 200 + 400 = 600ms plus jitter, well inside FINNHUB_TIMEOUT.
  FINNHUB_MAX_ATTEMPTS: 3,      // 1 initial attempt + 2 retries
  FINNHUB_RETRY_BASE_MS: 200,   // exponential base; jitter up to this much is added

  // Market Configuration
  SUPPORTED_MARKETS: ['US'],   // Future: add international

  // AI Provider
  AI_SUMMARY_PROVIDER: 'openai', // 'perplexity' or 'openai' — one line to switch

  // Display
  CHART_HEIGHT: 7,             // ASCII chart resolution
  EMBED_COLOR_POSITIVE: 0x00ff00,  // Green
  EMBED_COLOR_NEGATIVE: 0xff0000,  // Red
  EMBED_COLOR_NEUTRAL: 0x808080,   // Gray
};
