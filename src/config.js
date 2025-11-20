// ABOUTME: Configuration constants for the Discord Stock Bot
// ABOUTME: Contains rate limits, cache TTLs, timeouts, and display settings

/**
 * Global configuration constants for the Discord Stock Bot
 * 
 * @constant {Object} CONFIG
 * @property {number} RATE_LIMIT_SECONDS - Rate limit window in seconds (1 query per user per 60 seconds)
 * @property {number} CACHE_TTL_PRICE - Cache TTL for stock prices in seconds (5 minutes)
 * @property {number} CACHE_TTL_HISTORY - Cache TTL for historical data in seconds (1 hour)
 * @property {number} CACHE_TTL_SUMMARY - Cache TTL for AI summaries in seconds (8 hours)
 * @property {number} DEFAULT_PERIOD_DAYS - Default number of days for historical data
 * @property {number} MASSIVE_TIMEOUT - API timeout for Massive.com requests in milliseconds
 * @property {number} OPENAI_TIMEOUT - API timeout for OpenAI requests in milliseconds
 * @property {string[]} SUPPORTED_MARKETS - Supported stock markets (currently US only)
 * @property {number} CHART_HEIGHT - ASCII sparkline chart height (number of characters)
 * @property {number} EMBED_COLOR_POSITIVE - Discord embed color for positive price changes (green)
 * @property {number} EMBED_COLOR_NEGATIVE - Discord embed color for negative price changes (red)
 * @property {number} EMBED_COLOR_NEUTRAL - Discord embed color for neutral/no change (gray)
 */
export const CONFIG = {
  // Rate Limiting
  RATE_LIMIT_SECONDS: 60,
  
  // Cache TTLs (seconds)
  CACHE_TTL_PRICE: 300,        // 5 minutes
  CACHE_TTL_HISTORY: 3600,     // 1 hour
  CACHE_TTL_SUMMARY: 28800,    // 8 hours
  CACHE_TTL_COMPANY_PROFILE: 259200,  // 3 days (company names rarely change)
  CACHE_TTL_MARKET_STATUS: 60, // 1 minute (market status changes frequently)
  
  // Stock Data
  DEFAULT_PERIOD_DAYS: 7,      // Future: make configurable per command
  
  // API Timeouts (milliseconds)
  // Using deferred responses, we have up to 15 minutes
  MASSIVE_TIMEOUT: 10000,   // 10 seconds for stock data
  OPENAI_TIMEOUT: 30000,    // 30 seconds for AI summary with web search
  FINNHUB_TIMEOUT: 5000,    // 5 seconds for real-time market status check
  
  // Market Configuration
  SUPPORTED_MARKETS: ['US'],   // Future: add international
  
  // Display
  CHART_HEIGHT: 7,             // ASCII chart resolution
  EMBED_COLOR_POSITIVE: 0x00ff00,  // Green
  EMBED_COLOR_NEGATIVE: 0xff0000,  // Red
  EMBED_COLOR_NEUTRAL: 0x808080,   // Gray
};
